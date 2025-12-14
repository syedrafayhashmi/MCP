import path from "path";
import fs from "fs";
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

function resolveDefaultServerPath(): string {
  const candidates = [
    // Most reliable in production: app runs from backend/ (Procfile uses `cd backend`)
    path.resolve(process.cwd(), "mcp", "main.js"),
    // Local TS source layout fallback
    path.resolve(__dirname, "..", "..", "mcp", "main.js"),
    // Repo-root fallback (older layout)
    path.resolve(__dirname, "..", "..", "..", "mcp", "main.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Return the most likely path for better error messages.
  return candidates[0] ?? path.resolve(process.cwd(), "mcp", "main.js");
}

function resolveDefaultServerCwd(serverPath: string): string {
  const dir = path.dirname(serverPath);
  if (fs.existsSync(dir)) {
    return dir;
  }
  return process.cwd();
}

let clientPromise: Promise<Client> | null = null;
let transport: StdioClientTransport | null = null;

async function createClient(): Promise<Client> {
  // Avoid PATH issues (e.g. `spawn node ENOENT`) by defaulting to the current Node binary.
  const command = process.env.MCP_SERVER_COMMAND ?? process.execPath;

  const resolvedServerPath = resolveDefaultServerPath();
  const args = process.env.MCP_SERVER_ARGS
    ? process.env.MCP_SERVER_ARGS.split(/\s+/).filter(Boolean)
    : [resolvedServerPath];
  const cwd = process.env.MCP_SERVER_CWD ?? resolveDefaultServerCwd(resolvedServerPath);

  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
  };

  if (process.env.NODE_ENV) {
    env.NODE_ENV = process.env.NODE_ENV;
  }

  if (process.env.API_BASE_URL) {
    env.API_BASE_URL = process.env.API_BASE_URL;
  } else if (process.env.PORT) {
    // Fallback for Heroku/local dynamic ports where API_BASE_URL isn't explicitly set
    env.API_BASE_URL = `http://localhost:${process.env.PORT}/api`;
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
  return client.request({ method: "tools/list", params: {} }, ListToolsResultSchema as any);
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
    CallToolResultSchema as any
  );
}

export async function resetMcpClient() {
  if (transport) {
    await transport.close();
    transport = null;
  }
  clientPromise = null;
}
