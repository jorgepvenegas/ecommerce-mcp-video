import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { db } from "./db";
import { tables } from "./schema";
import { createServer } from "node:http";

function factory() {
  const server = new McpServer({
    name: "db-query-server",
    version: "1.0.0",
  });
  registerTools(server);
  registerResources(server, db, tables);
  return server;
}

const handler = createMcpHandler(factory);
const nodeHandler = toNodeHandler(handler);

const httpServer = createServer((req, res) => {
  nodeHandler(req, res);
});

httpServer.listen(3000, "127.0.0.1", () => {
  console.error("MCP server running on http://127.0.0.1:3000/mcp");
});

process.on("SIGINT", async () => {
  await handler.close();
  httpServer.close();
  process.exit(0);
});
