import * as z from "zod/v4";
import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import type Database from "better-sqlite3";
import type { Tables } from "../schema";

interface PragmaColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface PragmaForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export async function describeTable(
  sqlite: Database.Database,
  tables: Tables,
  params: { table: string },
): Promise<CallToolResult> {
  const { table: tableName } = params;

  if (!(tableName in tables)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: table "${tableName}" not found. Use list-tables to see available tables.`,
        },
      ],
      isError: true,
    };
  }

  const columns = sqlite.pragma(`table_info(${tableName})`) as PragmaColumnInfo[];
  const foreignKeys = sqlite.pragma(
    `foreign_key_list(${tableName})`,
  ) as PragmaForeignKey[];

  const fkMap = new Map<string, { table: string; to: string }>();
  for (const fk of foreignKeys) {
    fkMap.set(fk.from, { table: fk.table, to: fk.to });
  }

  const header = "name | type | notnull | default | pk | foreign_key";
  const separator = "---|---|---|---|---|---";
  const rows = columns.map((col) => {
    const fk = fkMap.get(col.name);
    const fkStr = fk ? `${fk.table}(${fk.to})` : "";
    return [
      col.name,
      col.type,
      col.notnull ? "YES" : "NO",
      col.dflt_value ?? "",
      col.pk ? "YES" : "NO",
      fkStr,
    ].join(" | ");
  });

  return {
    content: [{ type: "text", text: [header, separator, ...rows].join("\n") }],
  };
}

export function registerDescribeTable(
  server: McpServer,
  sqlite: Database.Database,
  tables: Tables,
) {
  server.registerTool(
    "describe-table",
    {
      description: "Describe the columns and constraints of a table",
      inputSchema: z.object({
        table: z.string().describe("The name of the table to describe"),
      }),
    },
    async (params) => describeTable(sqlite, tables, params),
  );
}
