import { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";
import crypto from "crypto";
import type { AuthenticatedRequest } from "../middleware.js";
import { combinedAuthMiddleware } from "../middleware/apiKey.js";
import { callMcpTool, listMcpTools } from "../lib/mcpClient.js";

interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

interface ToolResultPayload {
  name: string;
  payload: unknown;
}

interface AssistantResponseBody {
  reply: string;
  toolResults: ToolResultPayload[];
  metadata?: Record<string, unknown>;
}

function sanitizeMessages(messages: ChatMessagePayload[]): ChatMessagePayload[] {
  const trimmed = messages.slice(-12); // limit context
  return trimmed.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: typeof message.content === "string"
      ? message.content.slice(0, 4000)
      : "",
  }));
}

function ensureString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ensureString(item))
    .filter((item) => item.length > 0);
}

function buildSystemPrompt(): string {
  return [
    "You are a capable assistant with access to external tools via MCP.",
    "When you use a tool, always explain what you did and what the result was.",
    "After calling a tool, you MUST provide a natural language response describing the action and outcome.",
    "Never return an empty response - always acknowledge what happened.",
    "If a tool call fails, explain the error to the user in a helpful way.",
  ].join("\n");
}

async function callAIChatWithTools({
  apiKey,
  messages,
  tools,
}: {
  apiKey: string;
  messages: { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }[];
  tools: any[];
}) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens: 900,
      tools,
      tool_choice: "auto",
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  if (!message) {
    throw new Error("AI API returned no message");
  }

  return message;
}

async function getOrCreateApiKey(userId: string): Promise<string> {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;

  try {
    db = await getDatabase();
    if (!db) {
      throw new Error("Failed to acquire database connection");
    }

    // Always mint a fresh assistant key (plaintext returned, hashed stored)
    const plaintextKey = `assistant_${userId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    // Store using base64url; middleware now accepts both base64url and base64
    const hashedKey = crypto
      .createHash("sha256")
      .update(plaintextKey)
      .digest("base64url");

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    await db.run(
      `INSERT INTO apikey (
        id,
        userId,
        name,
        prefix,
        start,
        key,
        enabled,
        metadata,
        requestCount,
        refillAmount,
        refillInterval,
        lastRefillAt,
        rateLimitTimeWindow,
        rateLimitMax,
        rateLimitEnabled,
        lastRequest,
        expiresAt,
        permissions,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        "Assistant Key",
        plaintextKey.slice(0, 4),
        plaintextKey.slice(0, 8),
        hashedKey,
        1,
        null,
        0,
        null,
        null,
        null,
        null,
        null,
        0,
        null,
        expiresAt,
        null,
        nowIso,
        nowIso,
      ]
    );

    return plaintextKey;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

type ToolCallResult = Awaited<ReturnType<typeof callMcpTool>>;

function extractToolPayload(result: ToolCallResult): any {
  const textItem = result?.content?.find((item: any) => item?.type === "text");
  if (!textItem || textItem.type !== "text" || typeof (textItem as any).text !== "string") {
    throw new Error("Tool returned no readable text content");
  }

  const raw = (textItem as { text: string }).text.trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function mapMcpToolsToOpenAiTools(mcpTools: any[]) {
  return (mcpTools || []).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

const assistantRoute: FastifyPluginAsync = async function (fastify) {
  if (!(fastify as any).skipAuth) {
    fastify.addHook("preHandler", combinedAuthMiddleware as any);
  } else {
    fastify.addHook(
      "preHandler",
      async (request: AuthenticatedRequest) => {
        request.user = {
          id: "test-user-1",
          email: "test@example.com",
          name: "Test User",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    );
  }

  fastify.post<{ Body: { messages?: ChatMessagePayload[] } }>(
    "/chat",
    async (request, reply) => {
      const aiApiKey = process.env.AI_API_KEY;
      if (!aiApiKey) {
        return reply.status(503).send({
          success: false,
          error: "AI not configured",
          message:
            "Set AI_API_KEY in the backend environment to enable the assistant.",
        });
      }

      const currentUser = (request as AuthenticatedRequest).user;
      if (!currentUser) {
        return reply.status(401).send({
          success: false,
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      const { messages } = request.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return reply.status(400).send({
          success: false,
          error: "Invalid payload",
          message: "messages must be a non-empty array",
        });
      }

      const invalidMessage = messages.find(
        (message) =>
          (message.role !== "user" && message.role !== "assistant") ||
          typeof message.content !== "string" ||
          message.content.trim().length === 0
      );

      if (invalidMessage) {
        return reply.status(400).send({
          success: false,
          error: "Invalid payload",
          message: "Each message must include a role and non-empty content.",
        });
      }

      let userApiKey: string;
      try {
        userApiKey = await getOrCreateApiKey(currentUser.id);
      } catch (error) {
        request.log.error({ error }, "Failed to provision user API key for MCP");
        return reply.status(500).send({
          success: false,
          error: "Internal Server Error",
          message: "Unable to provision API access for assistant actions",
        });
      }

      try {
        const sanitizedMessages = sanitizeMessages(messages);
        const systemPrompt = buildSystemPrompt();

        // Load MCP tools and expose them to the model
        const mcpToolList = await listMcpTools();
        const tools = mapMcpToolsToOpenAiTools((mcpToolList as any)?.tools ?? []);

        const chatMessages: any[] = [
          { role: "system", content: systemPrompt },
          ...sanitizedMessages,
        ];

        const firstResponse = await callAIChatWithTools({
          apiKey: aiApiKey,
          messages: chatMessages,
          tools,
        });

        let currentResponse = firstResponse;
        const collectedToolPayloads: Array<{ name: string; payload: unknown }> = [];
        let turns = 0;
        const MAX_TURNS = 5;

        while (
          currentResponse.tool_calls &&
          Array.isArray(currentResponse.tool_calls) &&
          currentResponse.tool_calls.length > 0 &&
          turns < MAX_TURNS
        ) {
          turns++;
          const toolCalls = currentResponse.tool_calls;
          
          // Add the assistant's tool-call message to history
          chatMessages.push(currentResponse);

          const turnToolResults: { role: "tool"; tool_call_id: string; content: string; name: string }[] = [];

          for (const call of toolCalls) {
            const name = call?.function?.name;
            let args: Record<string, unknown> = {};
            try {
              args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
            } catch {
              args = {};
            }

            // Inject apiKey if not provided
            if (!args.apiKey) {
              args.apiKey = userApiKey;
            }

            try {
              const result = await callMcpTool(name, args);
              const payload = extractToolPayload(result);

              turnToolResults.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(payload ?? {}),
                name,
              });
              collectedToolPayloads.push({ name, payload });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Tool call failed";
              turnToolResults.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: errorMessage }),
                name,
              });
              collectedToolPayloads.push({ name, payload: { error: errorMessage } });
            }
          }

          // Add tool results to history
          chatMessages.push(...turnToolResults);

          // Get next response
          currentResponse = await callAIChatWithTools({
            apiKey: aiApiKey,
            messages: chatMessages,
            tools,
          });
        }

        const replyText = ensureString(currentResponse?.content);
        
        if (!replyText) {
          request.log.error({ response: currentResponse, turns }, "LLM returned no content in response");
          throw new Error("LLM returned no content in response");
        }

        const assistantResponse: AssistantResponseBody = {
          reply: replyText,
          toolResults: collectedToolPayloads,
        };

        return reply.send({
          success: true,
          data: assistantResponse,
        });
      }
      catch (error) {
        request.log.error({ error }, "Assistant chat error");
        return reply.status(502).send({
          success: false,
          error: "Assistant error",
          message:
            error instanceof Error ? error.message : "Failed to process request",
        });
      }
    }
  );
};  

export default assistantRoute;
