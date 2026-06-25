import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4 QA — Playwright web E2E: 2-client game to the leaderboard.
 *
 * Drives the real Expo web client against a live `wrangler dev` backend.
 * Prerequisites:
 *   - `wrangler dev` running on :8787 (the API/DO backend)
 *   - `expo start --web` running on :8081 (or a static web build served there)
 *   - `EXPO_PUBLIC_WS_URL=ws://localhost:8787` set for the Expo app
 *
 * The test opens 2 browser contexts (Alice = host/drawer, Bob = guesser),
 * creates a room via the UI, joins, starts the game, the drawer picks a word,
 * the guesser guesses it, and both see the game-over leaderboard.
 */

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

const DRAW_TIME_MIN = 30; // seconds; matches the backend minimum

async function waitForHealthy(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not become healthy`);
}

async function setNickname(page: Page, nickname: string): Promise<void> {
  await page.goto(WEB_URL);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("home-edit-profile").click();
  await page.waitForURL(/\/settings/, { timeout: 10_000 });
  await page.getByTestId("settings-nickname").fill(nickname);
  // The settings screen auto-saves on change; go back home.
  await page.goto(WEB_URL);
  await page.waitForLoadState("networkidle");
}

async function createRoomViaUI(page: Page): Promise<string> {
  await page.getByTestId("home-create-room").click();
  await page.waitForURL(/\/create/, { timeout: 10_000 });

  // Speed the test up: 1 round, minimum draw time.
  await page.getByTestId("create-rounds-decrease").click();
  await page.getByTestId("create-rounds-decrease").click();
  await expect(page.getByTestId("create-rounds")).toContainText("1");

  while (true) {
    const text = await page.getByTestId("create-draw-time").textContent();
    if (text?.includes(`${DRAW_TIME_MIN}s`)) break;
    await page.getByTestId("create-draw-time-decrease").click();
  }

  await page.getByTestId("create-room-button").click();
  await page.waitForURL(/\/room\//, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");

  // Read the room code from the lobby UI.
  const roomCode = await page.getByTestId("lobby-room-code").textContent();
  expect(roomCode).toBeTruthy();
  return roomCode!.trim();
}

async function joinRoomViaUI(page: Page, roomId: string): Promise<void> {
  await page.goto(WEB_URL);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("home-join-code").click();
  await page.waitForURL(/\/join/, { timeout: 10_000 });
  await page.getByTestId("join-room-code").fill(roomId);
  await page.getByTestId("join-room-button").click();
  await page.waitForURL(new RegExp(`/room/${roomId}`, "i"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function pickFirstWord(page: Page): Promise<string> {
  const choice = page.locator('[data-testid^="word-choice-"]').first();
  await expect(choice).toBeVisible({ timeout: 15_000 });
  const word = await choice.textContent();
  expect(word).toBeTruthy();
  await choice.click();
  return word!.trim().toLowerCase();
}

async function waitForGameOver(page: Page, timeoutMs = 60_000): Promise<void> {
  await expect(page.getByTestId("game-over-leaderboard")).toBeVisible({ timeout: timeoutMs });
}

test.describe("web game E2E (2 clients)", () => {
  test("creates a room, plays a round, and shows the leaderboard", async ({ browser }) => {
    await waitForHealthy(`${API_URL}/health`);
    await waitForHealthy(WEB_URL);

    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alice = await aliceCtx.newPage();
    const bob = await bobCtx.newPage();

    try {
      // Alice sets up the room.
      await setNickname(alice, "Alice");
      const roomId = await createRoomViaUI(alice);
      await expect(alice.getByTestId("lobby-player-list")).toContainText("Alice");

      // Bob joins.
      await setNickname(bob, "Bob");
      await joinRoomViaUI(bob, roomId);

      // Both see the lobby with 2 players.
      await expect(alice.getByTestId("lobby-player-list")).toContainText("Bob", { timeout: 10_000 });
      await expect(bob.getByTestId("lobby-player-list")).toContainText("Alice", { timeout: 10_000 });

      // Alice starts the game.
      await alice.getByTestId("lobby-start-game").click();

      // Alice picks the first word choice and Bob will guess it.
      const word = await pickFirstWord(alice);

      // Wait for the drawing phase to appear for both.
      await expect(alice.getByTestId("word-banner")).toBeVisible({ timeout: 15_000 });
      await expect(bob.getByTestId("word-banner")).toBeVisible({ timeout: 15_000 });

      // Bob guesses the word.
      await bob.getByTestId("chat-input").fill(word);
      await bob.getByTestId("chat-send").click();

      // Both should eventually see the game-over leaderboard.
      await waitForGameOver(alice);
      await waitForGameOver(bob);

      // Sanity check: both players appear in the leaderboard.
      await expect(alice.getByTestId("game-over-leaderboard")).toContainText("Alice");
      await expect(alice.getByTestId("game-over-leaderboard")).toContainText("Bob");
    } finally {
      await aliceCtx.close();
      await bobCtx.close();
    }
  });
});
