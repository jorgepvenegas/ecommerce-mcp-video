import * as z from "zod/v4";
import { eq, ne, gt, lt, gte, lte, and, asc, desc } from "drizzle-orm";
import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "../schema";
import type { Tables } from "../schema";

type DB = BetterSQLite3Database<typeof schemaType>;

const operatorMap = {
  "=": eq,
  "!=": ne,
  ">": gt,
  "<": lt,
  ">=": gte,
  "<=": lte,
} as const;

function getColumnByName(table: Record<string, unknown>, columnName: string) {
  for (const [, value] of Object.entries(table)) {
    if (
      value &&
      typeof value === "object" &&
      "name" in value &&
      (value as { name: string }).name === columnName
    ) {
      return value;
    }
  }
  return null;
}

function getAllColumns(table: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(table)) {
    if (value && typeof value === "object" && "name" in value) {
      result[key] = value;
    }
  }
  return result;
}

function formatResults(results: Record<string, unknown>[]): string {
  if (results.length === 0) return "No rows returned.";
  const columns = Object.keys(results[0]);
  const header = columns.join(" | ");
  const separator = columns.map(() => "---").join(" | ");
  const rows = results.map((row) =>
    columns.map((col) => String(row[col] ?? "NULL")).join(" | "),
  );
  return [header, separator, ...rows].join("\n");
}

export async function queryTable(
  db: DB,
  tables: Tables,
  params: {
    table: string;
    columns?: string[];
    where?: {
      column: string;
      operator: keyof typeof operatorMap;
      value: string | number;
    }[];
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit: number;
    offset: number;
  },
): Promise<CallToolResult> {
  const {
    table: tableName,
    columns: selectedColumns,
    where,
    orderBy,
    limit,
    offset,
  } = params;

  const table = tables[tableName as keyof Tables] as unknown as Record<string, unknown>;
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

  // Validate and build column selection
  let selectObj: Record<string, unknown> | undefined;
  if (selectedColumns && selectedColumns.length > 0) {
    const allColumns = getAllColumns(table);
    selectObj = {};
    for (const colName of selectedColumns) {
      const col = getColumnByName(table, colName);
      if (!col) {
        return {
          content: [
            {
              type: "text",
              text: `Error: column "${colName}" not found in table "${tableName}". Use describe-table to see available columns.`,
            },
          ],
          isError: true,
        };
      }
      const key = Object.keys(allColumns).find(
        (k) => (allColumns[k] as { name: string }).name === colName,
      );
      if (key) selectObj[key] = col;
    }
  }

  // Build query — dynamic table/column selection requires loose typing
  let query: any = selectObj
    ? db.select(selectObj as any).from(table as any)
    : db.select().from(table as any);

  // Build where conditions
  if (where && where.length > 0) {
    const conditions = [];
    for (const { column, operator, value } of where) {
      const col = getColumnByName(table, column);
      if (!col) {
        return {
          content: [
            {
              type: "text",
              text: `Error: column "${column}" not found in table "${tableName}". Use describe-table to see available columns.`,
            },
          ],
          isError: true,
        };
      }
      const op = operatorMap[operator];
      conditions.push(op(col as never, value as never));
    }
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  // Build orderBy
  if (orderBy) {
    const col = getColumnByName(table, orderBy.column);
    if (!col) {
      return {
        content: [
          {
            type: "text",
            text: `Error: column "${orderBy.column}" not found in table "${tableName}". Use describe-table to see available columns.`,
          },
        ],
        isError: true,
      };
    }
    query = query.orderBy(
      orderBy.direction === "desc" ? desc(col as never) : asc(col as never),
    );
  }

  // Apply limit and offset
  query = query.limit(limit).offset(offset);

  // Execute
  const results = query.all() as Record<string, unknown>[];

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
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(100)
          .describe("Max rows to return"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Rows to skip for pagination"),
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
