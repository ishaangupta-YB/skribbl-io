import { applyD1Migrations, env } from "cloudflare:test";

// Setup files run outside per-test storage isolation and may run more than
// once. applyD1Migrations only applies migrations that haven't been applied,
// so calling it here is safe and seeds the bundled word packs into D1.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
