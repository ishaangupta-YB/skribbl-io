/**
 * Phase 4 QA — live E2E playthrough against `wrangler dev`.
 *
 * Boots `wrangler dev` (apps/api), connects 3 WebSocket clients, and drives a
 * full game (create → join → start → choose → draw → guess → reveal → rounds →
 * leaderboard) directly over the real Cloudflare Worker + Durable Object. No
 * browser required — this is the protocol-level E2E that Playwright would drive
 * the UI through, but faster and CI-friendly.
 *
 * Run from the repo root:
 *   pnpm --filter @skribbl/api exec vitest run --config ../../tests/e2e/vitest.config.ts
 * (or directly: node_modules/.bin/vitest run --config tests/e2e/vitest.config.ts)
 */
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  encode,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "@skribbl/shared";

const REPO_ROOT = resolve(__dirname, "../..");
const PORT = 9787;
const BASE_HTTP = `http://localhost:${PORT}`;
const BASE_WS = `ws://localhost:${PORT}`;

let server: ChildProcess | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  for (const l of [...listeners]) l();
}

class Client {
  ws: WebSocket;
  youId: string | null = null;
  word: string | null = null; // only set if this client is the drawer
  choices: string[] | null = null;
  phase: string = "lobby";
  leaderboard: ServerMessage[] = [];
  revealWord: string | null = null;
  antiCheatViolation = false;
  all: ServerMessage[] = [];

  constructor(roomId: string, nickname: string) {
    this.ws = new WebSocket(`${BASE_WS}/api/rooms/${roomId}/ws`);
    this.ws.on("message", (raw) => {
      const parsed = parseServerMessage(raw.toString());
      if (!parsed.ok) return;
      const msg = parsed.data;
      this.all.push(msg);
      if (msg.type === "room:state") {
        this.youId = msg.youId;
        this.phase = msg.state.phase;
        // Anti-cheat: a guesser must never hold the word during drawing.
        if (msg.state.phase === "drawing" && msg.state.drawerId !== this.youId && msg.state.word != null) {
          this.antiCheatViolation = true;
        }
      }
      if (msg.type === "turn:choosing" && Array.isArray(msg.choices)) this.choices = msg.choices;
      if (msg.type === "turn:start" && msg.word != null) this.word = msg.word;
      if (msg.type === "turn:reveal") this.revealWord = msg.word;
      if (msg.type === "game:over") this.leaderboard.push(msg);
      notify();
    });
    this.ws.on("open", () => {
      this.send({ type: "join", nickname, avatar: { emoji: "🐙", color: "#4F46E5" } });
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
    return this.word != null;
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

function waitUntil<T>(predicate: () => T | undefined | false | null, timeoutMs = 15_000): Promise<T> {
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

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE_HTTP}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("wrangler dev did not become healthy");
}

async function createRoom(settings: Record<string, unknown> = {}): Promise<string> {
  const resp = await fetch(`${BASE_HTTP}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false, ...settings }),
  });
  const json = (await resp.json()) as { roomId: string };
  return json.roomId;
}

beforeAll(async () => {
  // Kill any lingering wrangler dev on the port from a previous run.
  try {
    const { execSync } = await import("node:child_process");
    execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  server = spawn(
    resolve(REPO_ROOT, "apps/api/node_modules/.bin/wrangler"),
    ["dev", "--port", String(PORT)],
    {
      cwd: resolve(REPO_ROOT, "apps/api"),
      env: { ...process.env },
      stdio: "ignore",
    },
  );
  await waitForHealth();
}, 40_000);

afterAll(() => {
  server?.kill("SIGKILL");
  server = null;
});

describe("live wrangler dev playthrough (3 clients)", () => {
  it("plays a full game end-to-end and never leaks the word to guessers", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });

    const a = new Client(roomId, "Alice");
    const b = new Client(roomId, "Bob");
    const c = new Client(roomId, "Cara");
    const clients = [a, b, c];
    await Promise.all(clients.map((cl) => cl.open()));
    await waitUntil(() => (a.all.some((m) => m.type === "room:state") && b.youId && c.youId ? true : null));
    await waitUntil(() => (a.all.filter((m) => m.type === "player:joined").length >= 2 ? true : null));

    // Host starts the game.
    a.send({ type: "start" });

    // Drive every turn until the game ends (1 round, 3 players = 3 turns).
    for (let turn = 0; turn < 3; turn += 1) {
      // Wait for choosing — the drawer gets choices.
      await waitUntil(() => clients.some((cl) => cl.choices !== null && cl.choices.length > 0));
      const drawer = clients.find((cl) => cl.choices !== null)!;
      const word = drawer.choices![0]!;
      drawer.send({ type: "select-word", word });

      // Wait for drawing — the drawer gets the word.
      await waitUntil(() => clients.some((cl) => cl.word !== null));
      const drawerWord = clients.find((cl) => cl.word !== null)!.word!;
      expect(drawerWord).toBe(word);

      // Anti-cheat: only the drawer has the word; guessers see a masked word.
      const guessers = clients.filter((cl) => cl !== drawer);
      // Wait until every guesser has received a turn:start for THIS turn
      // (turn index N → each client should have N+1 turn:start messages).
      await waitUntil(() => guessers.every((g) => g.all.filter((m) => m.type === "turn:start").length >= turn + 1));
      for (const g of guessers) {
        const startMsgs = g.all.filter((m) => m.type === "turn:start") as Extract<ServerMessage, { type: "turn:start" }>[];
        const startMsg = startMsgs[turn]; // the turn:start for the current turn
        expect(startMsg?.word).toBeNull();
        expect(startMsg?.wordLength).toBe(drawerWord.length);
      }

      // All guessers guess the word.
      for (const g of guessers) g.send({ type: "chat", text: drawerWord });

      // Wait for the reveal (all guessed → early end, or alarm-driven).
      await waitUntil(() => clients.every((cl) => cl.revealWord !== null) || clients.every((cl) => cl.all.some((m) => m.type === "turn:reveal")));
      clients.forEach((cl) => (cl.revealWord = null)); // reset for next turn

      // Clear choices/word for the next turn.
      clients.forEach((cl) => {
        cl.choices = null;
        cl.word = null;
      });

      if (turn < 2) {
        // Wait for the next choosing phase (alarm-driven reveal → next turn).
        await waitUntil(() => clients.some((cl) => cl.choices !== null) || clients.some((cl) => cl.all.some((m) => m.type === "game:over")));
      }
    }

    // Game over → leaderboard.
    await waitUntil(() => clients.every((cl) => cl.leaderboard.length > 0));
    clients.forEach((cl) => {
      expect(cl.antiCheatViolation).toBe(false);
      const over = cl.leaderboard[0]!;
      expect(over.leaderboard).toHaveLength(3);
      // Leaderboard is sorted by score descending.
      for (let i = 1; i < over.leaderboard.length; i += 1) {
        expect(over.leaderboard[i - 1]!.score).toBeGreaterThanOrEqual(over.leaderboard[i]!.score);
      }
    });

    for (const cl of clients) cl.close();
  }, 60_000);

  it("rejects a non-host start with NOT_ALLOWED", async () => {
    const roomId = await createRoom();
    const a = new Client(roomId, "Host");
    const b = new Client(roomId, "NonHost");
    await Promise.all([a.open(), b.open()]);
    await waitUntil(() => (a.youId && b.youId ? true : null), 20_000);

    b.send({ type: "start" }); // Bob is not the host
    const err = await waitUntil(() => {
      const e = b.all.find((m) => m.type === "error") as Extract<ServerMessage, { type: "error" }> | undefined;
      return e ? e : null;
    }, 20_000);
    expect(err.code).toBe("NOT_ALLOWED");
    a.close();
    b.close();
  });

  it("migrates host when the host leaves", async () => {
    const roomId = await createRoom();
    const a = new Client(roomId, "Alice");
    const b = new Client(roomId, "Bob");
    await Promise.all([a.open(), b.open()]);
    await waitUntil(() => (a.youId && b.youId ? true : null));
    const originalHost = a.youId;

    a.close();
    // The DO's webSocketClose handler fires asynchronously; allow up to 20s.
    const hostChanged = await waitUntil(() => {
      const e = b.all.find((m) => m.type === "host:changed") as Extract<ServerMessage, { type: "host:changed" }> | undefined;
      return e ? e : null;
    }, 20_000);
    expect(hostChanged.hostId).toBe(b.youId);
    expect(hostChanged.hostId).not.toBe(originalHost);
    b.close();
  });
});
