/// <reference types="@cloudflare/workers-types" />
/// <reference types="@cloudflare/vitest-pool-workers" />

import type { Env } from "./src/env";
import type { D1Migration } from "cloudflare:test";

// Bindings available inside Workers Vitest tests (mirrors wrangler.toml + the
// test-only migrations binding injected in vitest.config.ts).
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
