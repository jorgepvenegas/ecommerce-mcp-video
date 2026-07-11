import { McpServer } from "@modelcontextprotocol/server";
import { registerListTables } from "./tools/list-tables";
import { tables } from "./schema";
import { registerDescribeTable } from "./tools/describe-table";
import { db, sqlite } from "./db";
import { registerQueryTable } from "./tools/query-table";

export function registerTools(server: McpServer) {
  registerListTables(server, tables);
  registerDescribeTable(server, sqlite, tables);
  registerQueryTable(server, db, tables);
}
