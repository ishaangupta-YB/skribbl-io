import { describe, expect, it } from "vitest";
import { GAME } from "@skribbl/shared";
import { connect, createRoom, fireAlarm, isFullyMasked, join } from "./harness";

let roomCounter = 0;
function nextRoomId(): string {
  roomCounter += 1;
  return `TST${String(roomCounter).padStart(3, "0")}`;
}

describe("GameRoom — join / lobby", () => {
  it("assigns the first joiner as host and broadcasts joins", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    expect(a.state.state.phase).toBe("lobby");
    expect(a.state.state.players[0]?.isHost).toBe(true);
    expect(a.state.youId).toBe(a.state.state.players[0]?.id);

    const b = await join(roomId, "Bob");
    expect(b.state.state.players).toHaveLength(2);
    // Alice should be told Bob joined.
    const joined = await a.client.waitFor("player:joined");
    expect(joined.player.nickname).toBe("Bob");
    a.client.close();
    b.client.close();
  });

  it("rejects messages before join and invalid frames", async () => {
    const roomId = nextRoomId();
    const c = await connect(roomId, "early");
    c.send({ type: "chat", text: "hello?" });
    const err = await c.waitFor("error");
    expect(err.code).toBe("NOT_ALLOWED");

    c.ws.send("this is not json");
    const err2 = await c.waitFor("error");
    expect(err2.code).toBe("INVALID_MESSAGE");
    c.close();
  });

  it("enforces room capacity (ROOM_FULL)", async () => {
    const roomId = await createRoom({ maxPlayers: 2 });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const third = await connect(roomId, "Cara");
    third.send({ type: "join", nickname: "Cara", avatar: { emoji: "🦊", color: "#10B981" } });
    const err = await third.waitFor("error");
    expect(err.code).toBe("ROOM_FULL");
    a.client.close();
    b.client.close();
    third.close();
  });

  it("responds to ping with pong", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    a.client.send({ type: "ping" });
    await a.client.waitFor("pong");
    a.client.close();
  });

  it("only the host can start, and not below the minimum players", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    a.client.send({ type: "start" });
    const err = await a.client.waitFor("error");
    expect(err.code).toBe("NOT_ALLOWED"); // only one player
    a.client.close();
  });
});

describe("GameRoom — full playthrough (anti-cheat + scoring)", () => {
  it("plays a complete game across 3 players with masked words and bounded scores", async () => {
    const roomId = await createRoom({
      maxRounds: 1,
      roundDurationSec: 30,
      hintsEnabled: false,
      isPublic: true,
      wordPackIds: ["default"],
    });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const c = await join(roomId, "Cara");
    const clients = [a, b, c];

    expect(a.state.state.settings.maxRounds).toBe(1);
    expect(c.state.state.players).toHaveLength(3);

    a.client.send({ type: "start" });

    for (let turn = 0; turn < 3; turn += 1) {
      const choosings = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:choosing")));
      const drawerIdx = choosings.findIndex((ch) => Array.isArray(ch.choices) && ch.choices.length > 0);
      expect(drawerIdx).toBeGreaterThanOrEqual(0);
      const choices = choosings[drawerIdx]!.choices!;
      expect(choices).toHaveLength(GAME.WORD_CHOICE_COUNT);
      // Only the drawer receives the word choices.
      choosings.forEach((ch, i) => {
        if (i !== drawerIdx) expect(ch.choices).toBeNull();
      });

      const drawer = clients[drawerIdx]!;
      drawer.client.send({ type: "select-word", word: choices[0]! });

      const starts = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:start")));
      const word = starts[drawerIdx]!.word;
      expect(typeof word).toBe("string");
      const drawerId = starts[drawerIdx]!.drawerId;

      // Anti-cheat: only the drawer gets the word; guessers get a fully masked word.
      starts.forEach((s, i) => {
        if (i === drawerIdx) {
          expect(s.word).toBe(word);
        } else {
          expect(s.word).toBeNull();
          expect(s.wordLength).toBe(word!.length);
          expect(isFullyMasked(s.maskedWord)).toBe(true);
        }
      });

      // The non-drawers guess the (test-known) word.
      const guessers = clients.filter((_, i) => i !== drawerIdx);
      for (const g of guessers) g.client.send({ type: "chat", text: word! });

      const reveals = await Promise.all(clients.map((cl) => cl.client.waitFor("turn:reveal")));
      reveals.forEach((r) => expect(r.word).toBe(word));

      if (turn === 0) {
        // Scoring: drawer earns the full share (everyone guessed); guessers earn points.
        const scores = reveals[0]!.scores;
        const drawerScore = scores.find((s) => s.playerId === drawerId);
        expect(drawerScore?.roundPoints).toBe(GAME.DRAWER_MAX_POINTS);
        for (const g of guessers) {
          const entry = scores.find((s) => s.playerId === g.state.youId);
          expect(entry?.roundPoints ?? 0).toBeGreaterThan(0);
          expect(entry?.roundPoints ?? 0).toBeLessThanOrEqual(GAME.GUESS_MAX_POINTS + GAME.FIRST_GUESS_BONUS);
        }
      }

      // Reveal → next turn (or game over after the last turn) via the DO alarm.
      expect(await fireAlarm(roomId)).toBe(true);
    }

    const overs = await Promise.all(clients.map((cl) => cl.client.waitFor("game:over")));
    overs.forEach((o) => {
      expect(o.leaderboard).toHaveLength(3);
      for (let i = 1; i < o.leaderboard.length; i += 1) {
        expect(o.leaderboard[i - 1]!.score).toBeGreaterThanOrEqual(o.leaderboard[i]!.score);
      }
    });

    for (const cl of clients) cl.client.close();
  });
});

describe("GameRoom — server-authoritative alarms", () => {
  it("auto-picks a word when the choosing timer elapses", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);

    // No word selected — the choosing alarm should auto-start drawing.
    expect(await fireAlarm(roomId)).toBe(true);
    const starts = await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
    const drawer = starts.find((s) => s.word !== null);
    expect(drawer?.word).toBeTruthy();
    a.client.close();
    b.client.close();
  });

  it("ends the turn when the drawing timer elapses (no guesses)", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const drawerIdx = choosings.findIndex((ch) => ch.choices);
    const drawer = [a, b][drawerIdx]!;
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    const starts = await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);
    const word = starts[drawerIdx]!.word!;

    // With hints disabled, the drawing alarm is the phase-end → reveal.
    expect(await fireAlarm(roomId)).toBe(true);
    const reveals = await Promise.all([a.client.waitFor("turn:reveal"), b.client.waitFor("turn:reveal")]);
    reveals.forEach((r) => expect(r.word).toBe(word));
    a.client.close();
    b.client.close();
  });
});

describe("GameRoom — leave / host migration", () => {
  it("migrates host to the next player when the host leaves", async () => {
    const roomId = nextRoomId();
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    const c = await join(roomId, "Cara");

    a.client.close(); // host leaves

    const hostChanged = await b.client.waitFor("host:changed");
    expect(hostChanged.hostId).toBe(b.state.youId);
    const left = await c.client.waitFor("player:left");
    expect(left.playerId).toBe(a.state.youId);

    b.client.close();
    c.client.close();
  });

  it("ends the game if players drop below the minimum mid-game", async () => {
    const roomId = await createRoom({ maxRounds: 3, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);

    b.client.close(); // now only 1 player < MIN_PLAYERS_TO_START
    const over = await a.client.waitFor("game:over");
    expect(over.leaderboard.length).toBeLessThanOrEqual(1);
    a.client.close();
  });
});

describe("GameRoom — guards", () => {
  it("ignores draw events from non-drawers", async () => {
    const roomId = await createRoom({ maxRounds: 1, roundDurationSec: 30, hintsEnabled: false });
    const a = await join(roomId, "Alice");
    const b = await join(roomId, "Bob");
    a.client.send({ type: "start" });
    const choosings = await Promise.all([a.client.waitFor("turn:choosing"), b.client.waitFor("turn:choosing")]);
    const drawerIdx = choosings.findIndex((ch) => ch.choices);
    const drawer = [a, b][drawerIdx]!;
    const guesser = [a, b][drawerIdx === 0 ? 1 : 0]!;
    drawer.client.send({ type: "select-word", word: choosings[drawerIdx]!.choices![0]! });
    await Promise.all([a.client.waitFor("turn:start"), b.client.waitFor("turn:start")]);

    const before = drawer.client.countOf("draw");
    guesser.client.send({ type: "draw", stroke: { points: [{ x: 0.1, y: 0.1 }], color: "#000000", width: 4, mode: "draw" } });
    drawer.client.send({ type: "draw", stroke: { points: [{ x: 0.2, y: 0.2 }], color: "#000000", width: 4, mode: "draw" } });
    // The drawer's stroke is mirrored to the guesser; the guesser's stroke is dropped.
    await guesser.client.waitFor("draw");
    expect(drawer.client.countOf("draw")).toBe(before); // drawer never receives a draw echo
    a.client.close();
    b.client.close();
  });
});
