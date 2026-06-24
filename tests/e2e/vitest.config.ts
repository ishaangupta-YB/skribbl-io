import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Phase 4 QA E2E test config — drives a live `wrangler dev` instance via
// WebSocket. Aliases the workspace contract to its built dist.
export default defineConfig({
  resolve: {
    alias: {
      "@skribbl/shared": resolve(__dirname, "../../packages/shared/dist/index.js"),
    },
  },
  test: {
    include: [resolve(__dirname, "**/*.e2e.test.ts")],
    environment: "node",
    testTimeout: 90_000,
    hookTimeout: 60_000,
  },
});
