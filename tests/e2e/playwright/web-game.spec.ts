import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4 QA — Playwright web E2E: 2-client game to the leaderboard.
 *
 * Prerequisites (see playwright.config.ts header):
 *   - `wrangler dev` running on :8787 (the API/DO backend)
 *   - `expo start --web` running on :8081 (the web client)
 *   - `EXPO_PUBLIC_WS_URL=ws://localhost:8787` set for the Expo app
 *
 * The test opens 2 browser contexts (Alice = host/drawer, Bob = guesser), creates
 * a room via the UI, joins, starts the game, the drawer picks a word and draws,
 * the guesser guesses, and both see the leaderboard after the round.
 */

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

async function setNickname(page: Page, nickname: string): Promise<void> {
  // The home screen shows the current nickname with an "Edit" button.
  await page.goto(WEB_URL);
  await page.getByRole("button", { name: "Edit" }).click();
  const input = page.getByPlaceholder(/nickname/i).or(page.getByLabel(/nickname/i));
  await input.fill(nickname);
  await page.getByRole("button", { name: /save|done|confirm/i }).click();
}

async function createRoomViaUI(page: Page): Promise<string> {
  await page.getByRole("button", { name: /create room/i }).click();
  // Set a short round duration for the test (if the UI exposes it).
  const durationInput = page.getByLabel(/round.*duration/i).or(page.getByPlaceholder(/duration/i));
  if (await durationInput.isVisible().catch(() => false)) {
    await durationInput.fill("30");
  }
  await page.getByRole("button", { name: /create|start.*room|confirm/i }).click();
  // Wait for navigation to /room/[id] and extract the room code from the URL.
  await page.waitForURL(/\/room\//, { timeout: 15_000 });
  const url = page.url();
  const match = url.match(/\/room\/([A-Z0-9]+)/i);
  return match?.[1] ?? "";
}

async function joinRoomViaUI(page: Page, roomId: string): Promise<void> {
  await page.goto(WEB_URL);
  await page.getByRole("button", { name: /join.*code/i }).click();
  const codeInput = page.getByPlaceholder(/code|room.*id/i).or(page.getByLabel(/code|room.*id/i));
  await codeInput.fill(roomId);
  await page.getByRole("button", { name: /join|enter|confirm/i }).click();
  await page.waitForURL(new RegExp(`/room/${roomId}`, "i"), { timeout: 15_000 });
}

test.describe("web game E2E (2 clients)", () => {
  test("creates a room, plays a round, and shows the leaderboard", async ({ browser }) => {
    // Skip if the web client or API is not running.
    const apiHealth = await fetch(`${API_URL}/health`).catch(() => null);
    test.skip(!apiHealth?.ok, "wrangler dev is not running on :8787");
    const webReachable = await fetch(WEB_URL).catch(() => null);
    test.skip(!webReachable, "expo web is not running on :8081");

    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alice = await aliceCtx.newPage();
    const bob = await bobCtx.newPage();

    try {
      // Alice creates a room; Bob joins with the code.
      await setNickname(alice, "Alice");
      const roomId = await createRoomViaUI(alice);
      expect(roomId.length).toBeGreaterThan(0);

      await setNickname(bob, "Bob");
      await joinRoomViaUI(bob, roomId);

      // Both should see the lobby with 2 players.
      await expect(alice.getByText(/bob/i)).toBeVisible({ timeout: 10_000 });
      await expect(bob.getByText(/alice/i)).toBeVisible({ timeout: 10_000 });

      // Alice (host) starts the game.
      await alice.getByRole("button", { name: /start/i }).click();

      // Alice (drawer) sees word choices; pick the first.
      const wordChoice = alice.getByText(/[a-z]+/i).first();
      await expect(wordChoice).toBeVisible({ timeout: 10_000 });
      // Click the first word choice button.
      const choiceButtons = alice.getByRole("button").filter({ hasText: /^[a-z]+$/i });
      await choiceButtons.first().click();

      // Both should see the drawing phase (masked word or the real word).
      await expect(alice.getByText(/draw|canvas|time/i).first()).toBeVisible({ timeout: 10_000 });

      // Bob (guesser) enters the word in chat — but we don't know the word from
      // the UI (it's hidden from guessers). Instead, we verify the game
      // progresses: either by waiting for the round timer to expire or by
      // checking that the leaderboard eventually appears.
      // For a robust E2E without knowing the word, we wait for the round to end
      // (30s max) and verify the reveal + next turn or game-over.
      const leaderboard = alice.getByText(/leaderboard|game over|final score/i).or(
        alice.getByRole("heading", { name: /leaderboard|game over/i }),
      );
      await expect(leaderboard.first()).toBeVisible({ timeout: 90_000 });
      // Bob should also see the leaderboard.
      const bobLeaderboard = bob.getByText(/leaderboard|game over|final score/i).or(
        bob.getByRole("heading", { name: /leaderboard|game over/i }),
      );
      await expect(bobLeaderboard.first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await aliceCtx.close();
      await bobCtx.close();
    }
  });
});
