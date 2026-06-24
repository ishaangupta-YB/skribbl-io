import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 4 QA — Playwright web E2E config.
 *
 * Drives the Expo web client (expo start --web) against `wrangler dev` to run a
 * 2–3 client game through the real UI to the leaderboard. Requires:
 *
 *   pnpm --filter @skribbl/api dev          # terminal 1 (wrangler dev :8787)
 *   pnpm --filter @skribbl/mobile web       # terminal 2 (expo web :8081)
 *   npx playwright install chromium         # one-time browser download
 *   npx playwright test --config tests/e2e/playwright.config.ts
 *
 * The test opens 3 browser contexts (one per player), creates a room, joins,
 * starts the game, draws, guesses, and verifies the leaderboard renders.
 */
export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
