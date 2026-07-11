import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import type { Tables } from "../schema";
import { z } from "zod/v4";

export async function listTables(tables: Tables): Promise<CallToolResult> {
  const names = Object.keys(tables).sort();
  return {
    content: [{ type: "text", text: names.join("\n") }],
  };
}

export function registerListTables(server: McpServer, tables: Tables) {
  server.registerTool(
    "list-tables",
    {
      description: "List all the tables in the database",
      inputSchema: z.object({}),
    },
    async () => listTables(tables),
  );
}
