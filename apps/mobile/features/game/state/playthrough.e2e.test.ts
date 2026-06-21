/**
 * Live end-to-end "mock playthrough": boots the real `tools/mock-ws-server`,
 * connects three WebSocket clients, and drives a full game (choose → draw →
 * guess → reveal → leaderboard) feeding every frame through Agent D's reducer.
 *
 * This proves the game-flow state layer against the actual protocol the way the
 * UI will see it — and asserts the core anti-cheat invariant (a guesser's
 * reducer never holds the real word while drawing). It uses real timers, so it
 * is slower than the deterministic suite; run from the repo root:
 *
 *   node_modules/.bin/vitest run --config apps/mobile/features/game/vitest.config.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { encode, parseServerMessage, type ClientMessage } from "@skribbl/shared";
import { applyServerMessage, createInitialSnapshot } from "./gameStore";
import type { RoomSnapshot } from "./types";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const PORT = 8800 + Math.floor(Math.random() * 400);
const ROOM = "E2EROOM";

let server: ChildProcess;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  for (const l of [...listeners]) l();
}

class Client {
  ws: WebSocket;
  snapshot: RoomSnapshot = createInitialSnapshot();
  /** Set if this client ever saw the real word while drawing as a non-drawer. */
  antiCheatViolation = false;

  constructor(public label: string) {
    this.ws = new WebSocket(`ws://localhost:${PORT}/api/rooms/${ROOM}/ws`);
    this.ws.on("message", (raw) => {
      const parsed = parseServerMessage(raw.toString());
      if (!parsed.ok) return;
      this.snapshot = applyServerMessage(this.snapshot, parsed.data);
      const s = this.snapshot;
      const isDrawer = s.youId != null && s.youId === s.room?.drawerId;
      // A guesser must never hold the real word while drawing (outside of the
      // legitimate end-of-turn reveal).
      if (s.room?.phase === "drawing" && !isDrawer && s.word != null && !s.reveal) {
        this.antiCheatViolation = true;
      }
      notify();
    });
  }

  open(): Promise<void> {
    return new Promise((res, rej) => {
      this.ws.on("open", () => res());
      this.ws.on("error", rej);
    });
  }

  send(msg: ClientMessage): void {
    this.ws.send(encode(msg));
  }

  get isDrawer(): boolean {
    return this.snapshot.youId != null && this.snapshot.youId === this.snapshot.room?.drawerId;
  }

  close(): void {
    this.ws.close();
  }
}

function waitUntil<T>(predicate: () => T | undefined | false | null, timeoutMs = 12_000): Promise<T> {
  return new Promise<T>((res, rej) => {
    const check = () => {
      const value = predicate();
      if (value) {
        cleanup();
        res(value);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      rej(new Error("waitUntil timed out"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      listeners.delete(check);
    };
    listeners.add(check);
    check();
  });
}

async function waitForHealth(timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${PORT}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("mock server did not become healthy");
}

beforeAll(async () => {
  server = spawn(resolve(REPO_ROOT, "node_modules/.bin/tsx"), ["tools/mock-ws-server/src/index.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await waitForHealth();
}, 30_000);

afterAll(() => {
  server?.kill("SIGKILL");
});

describe("live mock playthrough (3 clients)", () => {
  it(
    "plays a full game end-to-end and never leaks the word to guessers",
    async () => {
      const host = new Client("host");
      await host.open();
      host.send({ type: "join", nickname: "Host", avatar: { emoji: "🦊", color: "#4F46E5" } });
      await waitUntil(() => host.snapshot.youId != null);

      const c2 = new Client("c2");
      const c3 = new Client("c3");
      await Promise.all([c2.open(), c3.open()]);
      c2.send({ type: "join", nickname: "Bea", avatar: { emoji: "🐼", color: "#EC4899" } });
      c3.send({ type: "join", nickname: "Cy", avatar: { emoji: "🐸", color: "#10B981" } });

      const clients = [host, c2, c3];
      await waitUntil(() => (host.snapshot.room?.players.length === 3 ? true : null));

      // Shorten to a single round so the game completes quickly.
      host.send({ type: "settings:update", settings: { maxRounds: 1 } });
      await waitUntil(() => (host.snapshot.room?.settings.maxRounds === 1 ? true : null));

      host.send({ type: "start" });

      // Drive every turn until the game ends.
      let safety = 0;
      while (safety < 12) {
        safety += 1;

        // Wait for either the next drawer-in-choosing or the game to end.
        const step = await waitUntil<{ drawer?: Client; done?: boolean }>(() => {
          if (clients.some((c) => c.snapshot.gameOver)) return { done: true };
          const drawer = clients.find(
            (c) => c.snapshot.room?.phase === "choosing" && (c.snapshot.choices?.length ?? 0) > 0,
          );
          return drawer ? { drawer } : null;
        });
        if (step.done || !step.drawer) break;

        const drawer = step.drawer;
        const choice = drawer.snapshot.choices?.[0];
        expect(choice).toBeTruthy();
        drawer.send({ type: "select-word", word: choice as string });

        // Wait until the drawing phase starts and the drawer knows the word.
        await waitUntil(() =>
          drawer.snapshot.room?.phase === "drawing" && drawer.snapshot.word ? true : null,
        );
        const word = drawer.snapshot.word as string;

        // Guessers submit the correct word (the harness peeks; real guessers
        // would type it). This ends the turn once everyone has guessed.
        for (const g of clients.filter((c) => c !== drawer)) {
          g.send({ type: "chat", text: word });
        }

        // Wait for the turn to resolve (reveal) or the game to end.
        await waitUntil(() =>
          clients.some((c) => c.snapshot.gameOver) ||
          clients.every((c) => c.snapshot.room?.phase !== "drawing")
            ? true
            : null,
        );
      }

      await waitUntil(() => (clients.every((c) => c.snapshot.gameOver) ? true : null));

      // Every client ended the game with a 3-player leaderboard.
      for (const c of clients) {
        expect(c.snapshot.gameOver?.leaderboard).toHaveLength(3);
      }
      // Anti-cheat: no guesser ever held the real word during drawing.
      for (const c of clients) {
        expect(c.antiCheatViolation, `${c.label} leaked the word`).toBe(false);
      }
      // Everyone scored something (drawer bonus + guesser points).
      const top = host.snapshot.gameOver?.leaderboard[0];
      expect(top?.score).toBeGreaterThan(0);

      clients.forEach((c) => c.close());
    },
    30_000,
  );
});
