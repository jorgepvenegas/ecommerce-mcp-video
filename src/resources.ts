import type { McpServer } from "@modelcontextprotocol/server";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "./schema";
import type { Tables } from "./schema";
import { fetchRows } from "./query";

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
      const rows = fetchRows(db, tables.products as unknown as Record<string, unknown>);
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
