# mcp-to-db

**Expose any SQLite database as read-only MCP tools for AI assistants.**

mcp-to-db is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that turns a SQLite database into a set of tools AI assistants can use — list tables, inspect schemas, and run SELECT queries with filtering, ordering, and pagination. Data modification is intentionally blocked.

## Quick start

```bash
pnpm install
pnpm db:push       # create tables
pnpm seed          # load sample data
pnpm dev           # start server on http://127.0.0.1:3000/mcp
```

The sample data is an e-commerce database with 3 users, 5 products, 4 orders, and 9 order items — ready for testing.

## Tools

The server exposes three read-only tools:

| Tool | Description |
|---|---|
| `list-tables` | Lists all table names in the database |
| `describe-table` | Shows columns, types, nullability, defaults, primary keys, and foreign keys for a given table |
| `query-table` | SELECT queries with optional filters (`=`, `!=`, `>`, `<`, `>=`, `<=`), column selection, ordering, and pagination (`limit`/`offset`) |

## Resources

The server exposes one resource per table, each returning the full table as a JSON array:

| URI | Content |
|---|---|
| `db://tables/users` | All rows in the `users` table |
| `db://tables/products` | All rows in the `products` table |
| `db://tables/orders` | All rows in the `orders` table |
| `db://tables/order_items` | All rows in the `order_items` table |

Each resource has `mimeType: application/json`. Reading `db://tables/products` returns the products as pretty-printed JSON.

### query-table details

```json
{
  "table": "orders",
  "columns": ["id", "status", "total", "created_at"],
  "where": [{ "column": "status", "operator": "=", "value": "paid" }],
  "orderBy": { "column": "created_at", "direction": "desc" },
  "limit": 20,
  "offset": 0
}
```

All `where` conditions are ANDed together. Maximum `limit` is 1000 rows.

## Schema

The sample e-commerce schema:

- **users** — `id`, `email`, `name`, `created_at`
- **products** — `id`, `name`, `description`, `price` (cents), `stock`, `created_at`
- **orders** — `id`, `user_id` → users, `status` (pending/paid/shipped/delivered/cancelled), `total` (cents), `created_at`
- **order_items** — `id`, `order_id` → orders, `product_id` → products, `quantity`, `unit_price` (cents)

## Usage with MCP clients

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ecommerce-db": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/mcp-to-db", "dev"]
    }
  }
}
```

### Any MCP client

Point your client to `http://127.0.0.1:3000/mcp`.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the MCP server |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:push` | Push schema to SQLite (creates `data/db.sqlite`) |
| `pnpm seed` | Seed with sample e-commerce data |
| `pnpm test` | Run tests (Vitest) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `oxlint .` |
| `pnpm format` | `oxfmt .` |

## Adapting to your own database

1. Edit `src/schema.ts` — define your Drizzle ORM tables.
2. Run `pnpm db:push` to create tables.
3. Optionally update or replace `seed.ts`.
4. Start the server with `pnpm dev`.

The tool registration in `src/tools.ts` and all three tool implementations are schema-agnostic — they adapt to whatever tables you define.

## How it works

```
┌──────────────┐    MCP/HTTP      ┌─────────────────────┐
│  AI Assistant │ ◄─────────────► │  MCP Server (3000)   │
│  (Claude, etc) │   tools+resources│  list-tables         │
└──────────────┘                  │  describe-table      │
                                  │  query-table         │
                                  │  db://tables/*       │
                                  └─────────┬───────────┘
                                            │
                                      ┌─────▼─────┐
                                      │  SQLite    │
                                      │  (better-  │
                                      │  sqlite3)  │
                                      └───────────┘
```

Built with:
- **[MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)** — Model Context Protocol server framework
- **[Drizzle ORM](https://orm.drizzle.team)** — Type-safe SQL query builder
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — Synchronous SQLite driver
- **[Zod](https://zod.dev)** — Input validation

## License

MIT
