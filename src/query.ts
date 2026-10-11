import { eq, ne, gt, lt, gte, lte, and, asc, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type * as schemaType from "./schema";

type DB = BetterSQLite3Database<typeof schemaType>;

export const operatorMap = {
  "=": eq,
  "!=": ne,
  ">": gt,
  "<": lt,
  ">=": gte,
  "<=": lte,
} as const;

export type Operator = keyof typeof operatorMap;

export type FetchRowsOptions = {
  tableName?: string;
  columns?: string[];
  where?: { column: string; operator: Operator; value: string | number }[];
  orderBy?: { column: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
};

function getColumnByName(table: AnySQLiteTable, columnName: string): unknown {
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

function getAllColumns(table: AnySQLiteTable): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(table)) {
    if (value && typeof value === "object" && "name" in value) {
      result[key] = value;
    }
  }
  return result;
}

function notFoundIn(tableName: string | undefined, columnName: string): never {
  const inTable = tableName ? ` in table "${tableName}"` : "";
  throw new Error(
    `column "${columnName}" not found${inTable}. Use describe-table to see available columns.`,
  );
}

export function fetchRows(
  db: DB,
  table: AnySQLiteTable,
  opts: FetchRowsOptions = {},
): Record<string, unknown>[] {
  const { tableName, columns: selectedColumns, where, orderBy, limit, offset } = opts;

  // Build column selection
  let selectObj: Record<string, unknown> | undefined;
  if (selectedColumns && selectedColumns.length > 0) {
    const allColumns = getAllColumns(table);
    selectObj = {};
    for (const colName of selectedColumns) {
      const col = getColumnByName(table, colName);
      if (!col) notFoundIn(tableName, colName);
      const key = Object.keys(allColumns).find(
        (k) => (allColumns[k] as { name: string }).name === colName,
      );
      if (key) selectObj[key] = col;
    }
  }

  // Build query — dynamic table/column selection requires loose typing
  let query: any = selectObj ? db.select(selectObj as any).from(table) : db.select().from(table);

  // Build where conditions
  if (where && where.length > 0) {
    const conditions = [];
    for (const { column, operator, value } of where) {
      const col = getColumnByName(table, column);
      if (!col) notFoundIn(tableName, column);
      const op = operatorMap[operator];
      conditions.push(op(col as never, value as never));
    }
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  // Build orderBy
  if (orderBy) {
    const col = getColumnByName(table, orderBy.column);
    if (!col) notFoundIn(tableName, orderBy.column);
    query = query.orderBy(orderBy.direction === "desc" ? desc(col as never) : asc(col as never));
  }

  // Apply limit and offset
  if (limit !== undefined) query = query.limit(limit);
  if (offset !== undefined) query = query.offset(offset);

  return query.all() as Record<string, unknown>[];
}
