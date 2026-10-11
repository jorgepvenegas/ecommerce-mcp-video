import type { McpServer } from "@modelcontextprotocol/server";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "./schema";
import type { Tables } from "./schema";

type DB = BetterSQLite3Database<typeof schemaType>;

export function registerResources(server: McpServer, db: DB, tables: Tables) {
  server.registerResource(
    "catalog",
    "https://shop.example.com/catalog",
    {
      title: "Product catalog",
      description: "All products in the store, as a JSON array.",
      mimeType: "application/json",
    },
    async (uri) => {
      const rows = db
        .select()
        .from(tables.products as never)
        .all() as Record<string, unknown>[];
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    },
  );
}
