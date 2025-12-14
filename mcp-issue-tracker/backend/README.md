# Backend

## Environment variables

- `AI_API_KEY`: Required to enable the AI assistant.
- `MCP_SERVER_COMMAND`: Optional. Executable to run the MCP stdio server. Defaults to the current Node binary (`process.execPath`).
- `MCP_SERVER_ARGS`: Optional. Arguments for the MCP stdio server. Defaults to the resolved `mcp/main.js` path.
- `MCP_SERVER_CWD`: Optional. Working directory for the MCP stdio server. Defaults to the server script directory.

## Troubleshooting

### Assistant error: `spawn node ENOENT`

This means the backend failed to start the MCP stdio tool server process.

Common causes:
- The MCP server working directory does not exist.
- The MCP server script path is wrong.
- `MCP_SERVER_COMMAND` points to a non-existent executable.

Fix:
- Remove `MCP_SERVER_COMMAND` (recommended) so the backend uses the current Node executable automatically.
- Ensure the MCP server exists at `backend/mcp/main.js` (default).
