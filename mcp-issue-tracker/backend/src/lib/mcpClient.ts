import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultServerPath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "mcp",
  "main.js"
);

const defaultServerCwd = path.dirname(defaultServerPath);

let clientPromise: Promise<Client> | null = null;
let transport: StdioClientTransport | null = null;

async function createClient(): Promise<Client> {
  const command = process.env.MCP_SERVER_COMMAND ?? "node";
  const args = process.env.MCP_SERVER_ARGS
    ? process.env.MCP_SERVER_ARGS.split(/\s+/).filter(Boolean)
    : [defaultServerPath];
  const cwd = process.env.MCP_SERVER_CWD ?? defaultServerCwd;

  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
  };

  if (process.env.NODE_ENV) {
    env.NODE_ENV = process.env.NODE_ENV;
  }

  if (process.env.API_BASE_URL) {
    env.API_BASE_URL = process.env.API_BASE_URL;
  }

  transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env,
    stderr: "pipe",
  });

  const client = new Client({
    name: "issues-backend-assistant",
    version: "1.0.0",
  });

  transport.onclose = () => {
    clientPromise = null;
  };

  transport.onerror = () => {
    clientPromise = null;
  };

  await client.connect(transport);
  return client;
}

async function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient();
  }

  return clientPromise;
}

export async function listMcpTools() {
  const client = await getMcpClient();
  return client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
}

export async function callMcpTool(name: string, args?: Record<string, unknown>) {
  const client = await getMcpClient();
  return client.request(
    {
      method: "tools/call",
      params: {
        name,
        arguments: args ?? {},
      },
    },
    CallToolResultSchema
  );
}

export async function resetMcpClient() {
  if (transport) {
    await transport.close();
    transport = null;
  }
  clientPromise = null;
}
