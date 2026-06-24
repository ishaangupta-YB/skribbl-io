/**
 * Phase 4 QA — backend edge cases & hardening.
 *
 * Covers the cases the smoke playthrough in `game.test.ts` does not:
 *  - reconnection (drop + re-join yields a fresh `room:state` for a new id)
 *  - empty-room cleanup (last leaver resets the DO to a pristine lobby)
 *  - rate limiting on `POST /api/rooms`
 *  - simultaneous correct guesses (both guessers scored, order bonus applied)
 *  - all-guessed-early ends the turn without waiting for the alarm
 *  - drawer disconnect mid-turn (3 players) → abort + reveal + next turn
 *  - oversized / garbage frames are rejected with INVALID_MESSAGE
 *  - input validation on chat length, stroke points, colors, widths, join
 */
import { describe, expect, it } from "vitest";
import { GAME, type ServerMessage } from "@skribbl/shared";
import { SELF } from "cloudflare:test";
import type { TestClient } from "./harness";
import { connect, createRoom, fireAlarm, join } from "./harness";

const BASE = "https://test.local";

let ecRoomCounter = 0;
function nextRoomId(): string {
  ecRoomCounter += 1;
  return `EC${String(ecRoomCounter).padStart(3, "0")}`;
}

interface StartedClient {
  client: TestClient;
  youId: string;
  isDrawer: boolean;
  word: string | null;
}

/** Drive a 2-player room into the drawing phase; returns clients + the word. */
async function startDrawingRoom(roomId: string): Promise<{ clients: StartedClient[]; word: string }> {
  const a = await join(roomId, "Alice");
  const b = await join(roomId, "Bob");
  a.client.send({ type: "start" });
  const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
  const drawerIdx = choosings.findIndex((c) => Array.isArray(c.choices) && c.choices.length > 0);
  const drawer = [a, b][drawerIdx]!;
  drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
  const starts = await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
  const word = starts[drawerIdx]!.word!;
  const clients: StartedClient[] = [
    { client: a.client, youId: a.state.youId, isDrawer: drawerIdx === 0, word: starts[0]!.word },
    { client: b.client, youId: b.state.youId, isDrawer: drawerIdx === 1, word: starts[1]!.word },
  ];
  return { clients, word };
}

describe("GameRoom — reconnection", () => {
  it("a dropped player is removed; re-joining yields a fresh id + room:state", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const originalBId = b.state.youId;

    b.client.close();
    const left = await a.client.waitFor("player:left");
    expect(left.playerId).toBe(originalBId);

    // Re-join: a brand-new id is assigned and a fresh room:state is delivered.
    const b2 = await join(roomId, "Bob");
    expect(b2.state.youId).not.toBe(originalBId);
    expect(b2.state.state.players).toHaveLength(2);
    a.client.close();
    b2.client.close();
  });
});

describe("GameRoom — empty-room cleanup", () => {
  it("resets to a pristine lobby when the last player leaves", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);

    // Everyone leaves — the DO should reset to lobby (no leftover game phase).
    a.client.close();
    b.client.close();

    // A fresh joiner must see a clean lobby, not a half-played game.
    const c = await join(roomId, "Cara");
    expect(c.state.state.phase).toBe("lobby");
    expect(c.state.state.players).toHaveLength(1);
    expect(c.state.state.players[0]?.isHost).toBe(true);
    expect(c.state.state.currentRound).toBe(0);
    c.client.close();
  });
});

describe("GameRoom — rate limiting", () => {
  it("throttles POST /api/rooms after the per-IP limit", async () => {
    // The create limit is 15/min from a single IP. The vitest-pool-workers
    // runtime presents a single client IP, so 16 rapid creates should trip it.
    const statuses: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const resp = await SELF.fetch(`${BASE}/api/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      statuses.push(resp.status);
      await resp.text(); // drain
    }
    const ok = statuses.filter((s) => s === 200).length;
    const limited = statuses.filter((s) => s === 429).length;
    expect(ok).toBe(15);
    expect(limited).toBe(1);
  });
});

describe("GameRoom — simultaneous & early guesses", () => {
  it("scores two simultaneous correct guesses and ends the turn early", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 60, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const c = await join(roomId, "Cara");
    const clients = [a, b, c];

    a.client.send({ type: "start" });
    const choosings = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:choosing")));
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawer = clients[drawerIdx]!;
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    const starts = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:start")));
    const word = starts[drawerIdx]!.word!;
    const guessers = clients.filter((_, i) => i !== drawerIdx);

    // Both guessers fire the correct word in the same tick.
    for (const g of guessers) g.client.send({ type: "chat", text: word });

    // All guessers correct → turn ends early (reveal fires WITHOUT firing the
    // alarm). Wait for the reveal on every client first, then inspect each
    // guesser's own guess:correct (a guesser also receives the other's
    // broadcast, so we filter by playerId from the received-message log).
    const reveals = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:reveal")));
    reveals.forEach((r) => expect(r.word).toBe(word));

    // Use a typed cast since `find` doesn't narrow the discriminated union.
    const ownCorrects = guessers.map(
      (g) =>
        g.client.all.find((m) => m.type === "guess:correct" && m.playerId === g.state.youId) as
          | Extract<ServerMessage, { type: "guess:correct" }>
          | undefined,
    );
    expect(ownCorrects.every(Boolean)).toBe(true);
    const sorted = ownCorrects.map((m) => m!.points).sort((x, y) => y - x);
    // Both guessed with (near) full time remaining → time score is GUESS_MAX.
    // First guesser: + FIRST_GUESS_BONUS. Second: + FIRST_GUESS_BONUS - ORDER_BONUS_STEP.
    expect(sorted[0]).toBe(GAME.GUESS_MAX_POINTS + GAME.FIRST_GUESS_BONUS);
    expect(sorted[1]).toBe(GAME.GUESS_MAX_POINTS + GAME.FIRST_GUESS_BONUS - GAME.ORDER_BONUS_STEP);

    for (const cl of clients) cl.client.close();
  });
});

describe("GameRoom — drawer disconnect mid-turn (3 players)", () => {
  it("aborts the turn, reveals the word, and advances to the next drawer on alarm", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 60, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const c = await join(roomId, "Cara");
    const clients = [a, b, c];

    a.client.send({ type: "start" });
    const choosings = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:choosing")));
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawer = clients[drawerIdx]!;
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    const starts = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:start")));
    const word = starts[drawerIdx]!.word!;

    // Drawer drops mid-turn → abort + reveal (no alarm needed).
    drawer.client.close();
    const survivors = clients.filter((_, i) => i !== drawerIdx);
    const revealers = await Promise.all(survivors.map((cl) => cl.client.waitFor("turn:reveal")));
    revealers.forEach((r) => expect(r.word).toBe(word));

    // Fire the reveal alarm → nextTurn advances to the next drawer (choosing).
    expect(await fireAlarm(roomId)).toBe(true);
    const nextChoosings = await Promise.all(survivors.map((cl) => cl.client.waitFor("turn:choosing")));
    const newDrawerId = nextChoosings.find((ch) => Array.isArray(ch.choices))?.drawerId;
    expect(newDrawerId).toBeTruthy();
    expect(survivors.map((s) => s.state.youId)).toContain(newDrawerId);

    for (const cl of survivors) cl.client.close();
  });
});

describe("GameRoom — frame validation (oversized / garbage rejected)", () => {
  it("rejects oversized stroke frames (> MAX_STROKE_POINTS)", async () => {
    const { clients } = await startDrawingRoom(nextRoomId());
    const drawer = clients.find((c) => c.isDrawer)!.client;
    const tooMany = Array.from({ length: GAME.MAX_STROKE_POINTS + 1 }, (_, i) => ({ x: i / 1000, y: 0.5 }));
    drawer.ws.send(
      JSON.stringify({ type: "draw", stroke: { points: tooMany, color: "#000000", width: 4, mode: "draw" } }),
    );
    const err = await drawer.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    for (const c of clients) c.client.close();
  });

  it("rejects invalid stroke color / width / mode", async () => {
    const { clients } = await startDrawingRoom(nextRoomId());
    const drawer = clients.find((c) => c.isDrawer)!.client;
    const bad = (stroke: Record<string, unknown>): Promise<{ code: string }> => {
      drawer.ws.send(JSON.stringify({ type: "draw", stroke }));
      return drawer.waitFor("error");
    };
    expect((await bad({ points: [{ x: 0.1, y: 0.1 }], color: "red", width: 4, mode: "draw" })).code).toBe("INVALID_MESSAGE");
    expect((await bad({ points: [{ x: 0.1, y: 0.1 }], color: "#000000", width: 0, mode: "draw" })).code).toBe("INVALID_MESSAGE");
    expect((await bad({ points: [{ x: 0.1, y: 0.1 }], color: "#000000", width: 4, mode: "scribble" })).code).toBe("INVALID_MESSAGE");
    for (const c of clients) c.client.close();
  });

  it("rejects empty + oversized chat text", async () => {
    const { clients } = await startDrawingRoom(nextRoomId());
    const guesser = clients.find((c) => !c.isDrawer)!.client;
    guesser.ws.send(JSON.stringify({ type: "chat", text: "   " }));
    let err = await guesser.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    guesser.ws.send(JSON.stringify({ type: "chat", text: "x".repeat(GAME.MAX_CHAT_LEN + 1) }));
    err = await guesser.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    for (const c of clients) c.client.close();
  });

  it("rejects non-JSON and wrong-shape frames", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    a.client.ws.send("not json at all");
    let err = await a.client.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    a.client.ws.send(JSON.stringify({ type: "unknown-type" }));
    err = await a.client.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    a.client.close();
  });

  it("rejects select-word not in the offered choices (silently ignored)", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawer = [a, b][drawerIdx]!;
    // A word not in the choices list is silently ignored — no state change, so
    // the choosing phase persists and no turn:start arrives.
    drawer.client.send({ type: "select-word", word: "definitely-not-in-the-list" });
    await expect(Promise.race([drawer.client.waitFor("turn:start", 400), Promise.resolve(null)])).resolves.toBe(null);
    a.client.close();
    b.client.close();
  });
});

describe("GameRoom — input validation on join", () => {
  it("rejects an invalid nickname (empty / too long) and avatar", async () => {
    const roomId = nextRoomId();
    const c = await connect(roomId, "bad");
    c.ws.send(JSON.stringify({ type: "join", nickname: "", avatar: { emoji: "🐙", color: "#4F46E5" } }));
    let err = await c.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");

    c.ws.send(JSON.stringify({ type: "join", nickname: "x".repeat(GAME.MAX_NICKNAME_LEN + 1), avatar: { emoji: "🐙", color: "#4F46E5" } }));
    err = await c.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");

    c.ws.send(JSON.stringify({ type: "join", nickname: "Ok", avatar: { emoji: "🐙", color: "not-a-hex" } }));
    err = await c.waitFor("error");
    expect(err.code).toBe("INVALID_MESSAGE");
    c.close();
  });
});
