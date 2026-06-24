import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Phase 4 QA unit-test config for the pure-logic frontend modules (canvas lib,
// realtime client + store). Aliases the workspace contract to its built dist so
// tests run without the Expo app/Metro. Run from the repo root:
//   node_modules/.bin/vitest run --config apps/mobile/vitest.qa.config.ts
export default defineConfig({
  resolve: {
    alias: {
      "@skribbl/shared": resolve(__dirname, "../../packages/shared/dist/index.js"),
    },
  },
  test: {
    include: [
      resolve(__dirname, "features/canvas/lib/**/*.test.ts"),
      resolve(__dirname, "lib/realtime/**/*.test.ts"),
    ],
    environment: "node",
  },
});
