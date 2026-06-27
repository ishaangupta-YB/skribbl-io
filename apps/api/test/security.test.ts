/**
 * Phase 4 QA — security & anti-cheat invariants (backend).
 *
 * These tests pin the security-critical guarantees from PLAN.md / AGENTS.md:
 *   1. The word NEVER leaks to a guesser except via the legitimate end-of-turn
 *      `turn:reveal` (and the post-game `game:over` carries no word at all).
 *   2. The timer is server-authoritative: only DO alarms advance phases; a
 *      client cannot move the state machine by sending out-of-phase frames.
 *   3. Scoring is server-authoritative: `scores:update` / `guess:correct` are
 *      server-only message types; a client impersonating them is rejected.
 *   4. Authorization: only the host can start / kick / update settings; only
 *      the drawer can draw; the drawer's own correct-word chat is suppressed.
 *   5. The REST surface validates every input (room id, settings, word packs).
 */
import { describe, expect, it } from "vitest";
import { GAME } from "@skribbl/shared";
import { SELF } from "cloudflare:test";
import type { ServerMessage } from "@skribbl/shared";
import { createRoom, fireAlarm, join } from "./harness";

const BASE = "https://test.local";

let secRoomCounter = 0;
function nextRoomId(): string {
  secRoomCounter += 1;
  return `SC${String(secRoomCounter).padStart(3, "0")}`;
}

/** Collect every server message a client receives within a window. */
function collectFor(client: { all: ServerMessage[] }, ms: number): Promise<ServerMessage[]> {
  const startLen = client.all.length;
  return new Promise((resolve) => {
    setTimeout(() => resolve(client.all.slice(startLen)), ms);
  });
}

/** True if any received message exposed the real word to a non-drawer. */
function wordLeakedTo(client: { all: ServerMessage[]; youId: string }, word: string, drawerId: string): boolean {
  if (client.youId === drawerId) return false;
  for (const m of client.all) {
    // turn:reveal legitimately reveals the word to everyone — that is NOT a leak.
    if (m.type === "turn:reveal") continue;
    if (m.type === "turn:start" && m.word !== null && m.word === word) return true;
    if (m.type === "turn:choosing" && Array.isArray(m.choices) && m.choices.includes(word)) return true;
    if (m.type === "room:state" && m.state.word != null && m.state.word === word) return true;
  }
  return false;
}

describe("Security — word never leaks to guessers", () => {
  it("a guesser never sees the word, choices, or a leaky room:state across a full turn", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: true });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const c = await join(roomId, "Cara");
    const clients = [a, b, c];

    a.client.send({ type: "start" });
    const choosings = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:choosing")));
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawerId = clients[drawerIdx]!.state.youId;
    const drawer = clients[drawerIdx]!;
    const choices = choosings[drawerIdx]!.choices!;
    // Anti-cheat: only the drawer's copy carries the choices.
    choosings.forEach((ch, i) => {
      if (i === drawerIdx) expect(ch.choices).toHaveLength(GAME.WORD_CHOICE_COUNT);
      else expect(ch.choices).toBeNull();
    });

    drawer.client.send({ type: "select-word", word: choices[0]! });
    const starts = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:start")));
    const word = starts[drawerIdx]!.word!;
    starts.forEach((s, i) => {
      if (i === drawerIdx) expect(s.word).toBe(word);
      else expect(s.word).toBeNull();
    });

    // Drive alarms until the turn reveals. With hints enabled there may be 1-N
    // hint alarms before the phase-end alarm; fire alarms until turn:reveal
    // arrives (capped to avoid an infinite loop on a regression).
    for (let i = 0; i < 8; i += 1) {
      const alreadyRevealed = clients.every((cl) => cl.client.all.some((m) => m.type === "turn:reveal"));
      if (alreadyRevealed) break;
      await fireAlarm(roomId);
      await new Promise((r) => setTimeout(r, 20));
    }
    await Promise.all(clients.map((cl) => cl.client.waitFor("turn:reveal")));

    // The guessers' entire message log must never contain the word outside the
    // legitimate turn:reveal.
    for (const cl of clients) {
      expect(wordLeakedTo({ all: cl.client.all, youId: cl.state.youId }, word, drawerId)).toBe(false);
    }
    for (const cl of clients) cl.client.close();
  });

  it("game:over carries a leaderboard but no `word` field", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    // 2 players, 1 round = 2 turns. Drive both turns to completion via alarms.
    for (let turn = 0; turn < 2; turn += 1) {
      const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
      const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
      [a, b][drawerIdx]!.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
      await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
      await fireAlarm(roomId); // drawing phase-end → reveal
      await Promise.all([a.client.waitFor("turn:reveal"), b.client.waitFor("turn:reveal")]);
      if (turn === 0) await fireAlarm(roomId); // reveal → next turn's choosing
    }
    // After the 2nd reveal, the next alarm → game:over.
    await fireAlarm(roomId);
    const overs = await Promise.all([a.client.waitFor("game:over"), b.client.waitFor("game:over")]);
    overs.forEach((o) => {
      expect(o.leaderboard.length).toBeLessThanOrEqual(2);
      expect((o as { word?: string }).word).toBeUndefined();
    });
    a.client.close();
    b.client.close();
  });

  it("a guesser's room:state never carries the drawer-only fields", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const choosingA = a.client.all.find((m) => m.type === "turn:choosing")!;
    const _choosingB = b.client.all.find((m) => m.type === "turn:choosing")!;
    void _choosingB;
    const drawerIsA = Array.isArray(choosingA.choices) && (choosingA.choices!.length > 0);
    const guesserState = drawerIsA
      ? b.client.all.filter((m) => m.type === "room:state")
      : a.client.all.filter((m) => m.type === "room:state");
    expect(guesserState.length).toBeGreaterThan(0);
    for (const m of guesserState) {
      const s = (m as { state: { word?: string | null; wordChoices?: string[] | null } }).state;
      expect(s.word).toBeNull();
      expect(s.wordChoices).toBeNull();
    }
    a.client.close();
    b.client.close();
  });
});

describe("Security — server-authoritative state machine", () => {
  it("ignores out-of-phase client frames (no phase advance without an alarm)", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawer = [a, b][drawerIdx]!;

    // select-word during choosing is valid, but a SECOND select-word after the
    // turn has moved to drawing must be a no-op (no second turn:start).
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
    const before = drawer.client.all.length;
    drawer.client.send({ type: "select-word", word: "anything" });
    const received = await collectFor(drawer.client, 250);
    // No new turn:start / turn:choosing — the phase did not regress.
    expect(received.slice(before).some((m) => m.type === "turn:start" || m.type === "turn:choosing")).toBe(false);
    a.client.close();
    b.client.close();
  });

  it("start from a non-host is rejected; start from the host in lobby works", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    b.client.send({ type: "start" }); // Bob is not the host
    const err = await b.client.waitFor("error");
    expect(err.code).toBe("NOT_ALLOWED");
    // The host starting is accepted and drives choosing.
    a.client.send({ type: "start" });
    await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    a.client.close();
    b.client.close();
  });
});

describe("Security — server-only message types are rejected from clients", () => {
  it("rejects a client impersonating scores:update / guess:correct / room:state", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    for (const type of ["scores:update", "guess:correct", "room:state", "turn:reveal", "game:over"]) {
      a.client.ws.send(JSON.stringify({ type }));
      const err = await a.client.waitFor("error");
      expect(err.code).toBe("INVALID_MESSAGE");
    }
    a.client.close();
  });
});

describe("Security — authorization (host-only / drawer-only)", () => {
  it("non-host cannot kick, and a host cannot kick themselves", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const aId = a.state.youId;
    const bId = b.state.youId;

    // Non-host kick → ignored (no error, no player:left).
    b.client.send({ type: "kick", playerId: aId });
    const received = await collectFor(a.client, 250);
    expect(received.some((m) => m.type === "player:left")).toBe(false);

    // Host kicking themselves → ignored.
    a.client.send({ type: "kick", playerId: aId });
    const received2 = await collectFor(b.client, 250);
    expect(received2.some((m) => m.type === "player:left" && m.playerId === aId)).toBe(false);

    // Host kicking the other player → player:left + the kicked socket closes.
    a.client.send({ type: "kick", playerId: bId });
    const left = await a.client.waitFor("player:left");
    expect(left.playerId).toBe(bId);
    a.client.close();
  });

  it("non-host cannot update settings; host can in lobby only", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    // Non-host update → no state change.
    b.client.send({ type: "settings:update", settings: { maxRounds: 5 } });
    const received = await collectFor(a.client, 250);
    expect(received.some((m) => m.type === "room:state")).toBe(false);
    // Host update in lobby → broadcast.
    a.client.send({ type: "settings:update", settings: { maxRounds: 5 } });
    const state = await a.client.waitFor("room:state");
    expect(state.state.settings.maxRounds).toBe(5);
    a.client.close();
    b.client.close();
  });

  it("the drawer's chat containing the exact word is suppressed (not broadcast)", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
    const drawer = [a, b][drawerIdx]!;
    const guesser = [a, b][drawerIdx === 0 ? 1 : 0]!;
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    const starts = await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
    const word = starts[drawerIdx]!.word!;

    const before = guesser.client.all.filter((m) => m.type === "chat").length;
    drawer.client.send({ type: "chat", text: word });
    const after = await collectFor(guesser.client, 300);
    const newChats = after.filter((m) => m.type === "chat");
    // The guesser must NOT receive any chat echo of the exact word from the
    // drawer (the drawer typing the answer is suppressed server-side).
    expect(newChats.length).toBe(0);
    expect(newChats.some((m) => (m as { message?: { text?: string } }).message?.text === word)).toBe(false);
    void before;
    a.client.close();
    b.client.close();
  });
});

describe("Security — REST input validation", () => {
  it("rejects an invalid room id on the WS route (400)", async () => {
    const resp = await SELF.fetch(`${BASE}/api/rooms/ab/ws`, { headers: { Upgrade: "websocket" } });
    expect(resp.status).toBe(400);
  });

  it("rejects oversized / malformed settings on room create (400)", async () => {
    const cases: Record<string, unknown>[] = [
      { maxPlayers: 1 }, // below MIN_PLAYERS_TO_START
      { maxPlayers: 99 }, // above MAX_PLAYERS (20)
      { maxRounds: 0 }, // below MIN_ROUNDS
      { roundDurationSec: 5 }, // below MIN_ROUND_DURATION_SEC
      { wordPackIds: [] }, // min 1
    ];
    for (const body of cases) {
      const resp = await SELF.fetch(`${BASE}/api/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(resp.status).toBe(400);
      await resp.text();
    }
  });

  it("rejects an oversized word pack (> MAX_WORDS_PER_PACK)", async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `word${i}`);
    const resp = await SELF.fetch(`${BASE}/api/word-packs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Big", words: tooMany }),
    });
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("INVALID_MESSAGE");
  });
});
