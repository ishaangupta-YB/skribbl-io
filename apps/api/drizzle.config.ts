import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for the D1 (SQLite) schema. `pnpm db:generate` emits SQL
 * migrations into ./migrations, which are applied with `wrangler d1 migrations
 * apply skribbl` (and, in tests, via readD1Migrations/applyD1Migrations).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
