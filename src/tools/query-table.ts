import * as z from "zod/v4";
import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "../schema";
import type { Tables } from "../schema";
import { fetchRows, type Operator } from "../query";

type DB = BetterSQLite3Database<typeof schemaType>;

function formatResults(results: Record<string, unknown>[]): string {
  if (results.length === 0) return "No rows returned.";
  const columns = Object.keys(results[0]);
  const header = columns.join(" | ");
  const separator = columns.map(() => "---").join(" | ");
  const rows = results.map((row) => columns.map((col) => String(row[col] ?? "NULL")).join(" | "));
  return [header, separator, ...rows].join("\n");
}

export async function queryTable(
  db: DB,
  tables: Tables,
  params: {
    table: string;
    columns?: string[];
    where?: { column: string; operator: Operator; value: string | number }[];
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit: number;
    offset: number;
  },
): Promise<CallToolResult> {
  const { table: tableName, columns: selectedColumns, where, orderBy, limit, offset } = params;

  const table = tables[tableName as keyof Tables];
  if (!table) {
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

  const results = fetchRows(db, table, {
    tableName,
    columns: selectedColumns,
    where,
    orderBy,
    limit,
    offset,
  });

  return {
    content: [{ type: "text", text: formatResults(results) }],
  };
}

export function registerQueryTable(server: McpServer, db: DB, tables: Tables) {
  server.registerTool(
    "query-table",
    {
      description:
        "Query a table with optional filtering, ordering, and pagination. All conditions are ANDed together. Only SELECT queries — no data modification.",
      inputSchema: z.object({
        table: z.string().describe("The table to query"),
        columns: z
          .array(z.string())
          .optional()
          .describe("Specific columns to select; defaults to all"),
        where: z
          .array(
            z.object({
              column: z.string(),
              operator: z.enum(["=", "!=", ">", "<", ">=", "<="]),
              value: z.union([z.string(), z.number()]),
            }),
          )
          .optional()
          .describe("Filter conditions, ANDed together"),
        orderBy: z
          .object({
            column: z.string(),
            direction: z.enum(["asc", "desc"]).default("asc"),
          })
          .optional()
          .describe("Sort the results"),
        limit: z.number().int().min(1).max(1000).default(100).describe("Max rows to return"),
        offset: z.number().int().min(0).default(0).describe("Rows to skip for pagination"),
      }),
    },
    async (params) => {
      try {
        return await queryTable(db, tables, params);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
