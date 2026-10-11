import type { McpServer } from "@modelcontextprotocol/server";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "./schema";
import type { Tables } from "./schema";

type DB = BetterSQLite3Database<typeof schemaType>;

export function registerResources(server: McpServer, db: DB, tables: Tables) {
  for (const [name, table] of Object.entries(tables)) {
    const uri = `db://tables/${name}`;
    server.registerResource(
      name,
      uri,
      {
        title: `${name} table`,
        description: `All rows in the ${name} table as a JSON array.`,
        mimeType: "application/json",
      },
      async (resourceUri) => {
        const rows = db
          .select()
          .from(table as never)
          .all() as Record<string, unknown>[];
        return {
          contents: [
            {
              uri: resourceUri.href,
              mimeType: "application/json",
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      },
    );
  }
}
