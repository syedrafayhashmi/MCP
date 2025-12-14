import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import apiBasedTools from "./api-based-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an MCP server
const server = new McpServer({
  name: "issues-tracker-server",
  version: "1.0.0",
});

// Register API-based tools
apiBasedTools(server);

// Register the database schema resource
server.registerResource(
  "database-schema",
  "schema://database",
  {
    title: "Database Schema",
    description: "SQLite schema for the issues database",
    mimeType: "text/plain",
  },
  async (uri) => {
    // Heroku/production runs from `backend/` as the working directory.
    // Prefer cwd, fall back to repo layout.
    const candidates = [
      path.resolve(process.cwd(), "database.sqlite"),
      path.resolve(__dirname, "..", "database.sqlite"),
    ];

    const dbPath =
      candidates.find((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      }) ?? candidates[0];

    let schema = "";
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      const rows = db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
        )
        .all();
      schema = rows.map((row) => row.sql + ";").join("\n");
      db.close();
    } catch (error) {
      schema = `-- Unable to read database schema from ${dbPath}\n-- ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: schema,
        },
      ],
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
