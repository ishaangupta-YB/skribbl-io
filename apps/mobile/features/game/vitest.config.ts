import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Standalone test config for Agent D's pure game-logic layer.
// Aliases the workspace contract to its built dist so tests run without the
// (not-yet-scaffolded) Expo app. Run from repo root:
//   node_modules/.bin/vitest run --config apps/mobile/features/game/vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      "@skribbl/shared": resolve(__dirname, "../../../../packages/shared/dist/index.js"),
    },
  },
  test: {
    include: [resolve(__dirname, "state/**/*.test.ts")],
    environment: "node",
  },
});
