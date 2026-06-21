import { describe, expect, it } from "vitest";
import { maskWord, type ServerMessage } from "@skribbl/shared";
import {
  MAX_CHAT_HISTORY,
  MAX_LIVE_REACTIONS,
  applyServerMessage,
  createInitialSnapshot,
  reduceMessages,
} from "./gameStore";
import { ALICE, BOB, YOU, guesserTurnFrames, mkRoomState, scoreEntry } from "./fixtures";
import type { RoomSnapshot } from "./types";

const FIXED_NOW = 1_000_000;
const now = () => FIXED_NOW;
let rxId = 0;
const reactionId = () => `rx-${(rxId += 1)}`;

function apply(snap: RoomSnapshot, msg: ServerMessage): RoomSnapshot {
  return applyServerMessage(snap, msg, now, reactionId);
}

describe("createInitialSnapshot", () => {
  it("is an empty, idle room", () => {
    const s = createInitialSnapshot();
    expect(s.status).toBe("idle");
    expect(s.youId).toBeNull();
    expect(s.room).toBeNull();
    expect(s.chat).toEqual([]);
    expect(s.youGuessedCorrect).toBe(false);
  });
});

describe("room:state", () => {
  it("syncs youId, roster and derives a scoreboard when none exists", () => {
    const s = apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: mkRoomState() });
    expect(s.youId).toBe(YOU);
    expect(s.room?.players).toHaveLength(3);
    expect(s.scores.map((x) => x.playerId)).toContain(ALICE);
  });

  it("ANTI-CHEAT: never exposes the word to a guesser even if the frame carries it", () => {
    const leaky = mkRoomState({ phase: "drawing", drawerId: ALICE, word: "tiger", maskedWord: "_____", wordLength: 5 });
    const s = apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: leaky });
    expect(s.word).toBeNull();
    expect(s.maskedWord).toBe("_____");
  });

  it("exposes the word + choices only to the drawer", () => {
    const choosing = mkRoomState({ phase: "choosing", drawerId: YOU, wordChoices: ["cat", "dog", "sun"] });
    const s = apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: choosing });
    expect(s.choices).toEqual(["cat", "dog", "sun"]);
  });
});

describe("turn lifecycle (guesser perspective)", () => {
  it("plays a full turn and ends with the word revealed + scoreboard updated", () => {
    let s = apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: mkRoomState() });
    for (const frame of guesserTurnFrames({ round: 1, phaseEndsAt: FIXED_NOW + 70_000 })) {
      s = apply(s, frame);
    }
    // The reveal info surfaces the real word to the guesser (display reads
    // `reveal.word`; the trailing room:state correctly re-clears `word`).
    expect(s.reveal?.word).toBe("tiger");
    expect(s.word).toBeNull();
    // You guessed correctly this turn → input locks.
    expect(s.youGuessedCorrect).toBe(true);
    expect(s.guessedIds).toEqual(expect.arrayContaining([BOB, YOU]));
    // Scoreboard reflects the reveal frame.
    const you = s.scores.find((x) => x.playerId === YOU);
    expect(you?.score).toBe(230);
  });

  it("resets per-turn state at the next turn:start", () => {
    let s = reduceMessages(
      [{ type: "room:state", youId: YOU, state: mkRoomState() }, ...guesserTurnFrames({ round: 1, phaseEndsAt: FIXED_NOW + 70_000 })],
      createInitialSnapshot(),
      now,
    );
    expect(s.youGuessedCorrect).toBe(true);
    // Next turn begins.
    s = apply(s, {
      type: "turn:choosing",
      drawerId: BOB,
      round: 1,
      durationSec: 15,
      phaseEndsAt: FIXED_NOW + 90_000,
      choices: null,
    });
    expect(s.youGuessedCorrect).toBe(false);
    expect(s.guessedIds).toEqual([]);
    expect(s.reveal).toBeNull();
    expect(s.word).toBeNull();
  });

  it("turn:hint updates only the masked word", () => {
    let s = apply(createInitialSnapshot(), {
      type: "turn:start",
      drawerId: ALICE,
      round: 1,
      maskedWord: maskWord("tiger"),
      wordLength: 5,
      durationSec: 70,
      phaseEndsAt: FIXED_NOW + 70_000,
      word: null,
    });
    s = apply(s, { type: "turn:hint", maskedWord: "t____" });
    expect(s.maskedWord).toBe("t____");
  });
});

describe("turn lifecycle (drawer perspective)", () => {
  it("keeps the word for the drawer through turn:start", () => {
    const s = apply(createInitialSnapshot(), {
      type: "turn:start",
      drawerId: YOU,
      round: 1,
      maskedWord: maskWord("tiger"),
      wordLength: 5,
      durationSec: 70,
      phaseEndsAt: FIXED_NOW + 70_000,
      word: "tiger",
    });
    expect(s.word).toBe("tiger");
  });
});

describe("chat + guess feedback", () => {
  it("captures a private close-guess hint", () => {
    const s = apply(createInitialSnapshot(), {
      type: "chat",
      message: { id: "x", playerId: null, nickname: "", text: '"tigre" is close!', kind: "close", ts: 1 },
    });
    expect(s.guessFeedback).toEqual({ kind: "close", text: '"tigre" is close!', at: FIXED_NOW });
  });

  it("marks your own correct guess with points feedback", () => {
    const base = apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: mkRoomState({ phase: "drawing", drawerId: ALICE }) });
    const s = apply(base, { type: "guess:correct", playerId: YOU, nickname: "You", points: 200 });
    expect(s.youGuessedCorrect).toBe(true);
    expect(s.guessFeedback?.kind).toBe("correct");
    expect(s.guessFeedback?.text).toContain("200");
  });

  it("another player's correct guess does not lock you", () => {
    const s = apply(createInitialSnapshot(), { type: "guess:correct", playerId: ALICE, nickname: "Alice", points: 200 });
    expect(s.youGuessedCorrect).toBe(false);
    expect(s.guessedIds).toEqual([ALICE]);
  });

  it("caps chat history", () => {
    let s = createInitialSnapshot();
    for (let i = 0; i < MAX_CHAT_HISTORY + 20; i += 1) {
      s = apply(s, { type: "chat", message: { id: `m${i}`, playerId: YOU, nickname: "You", text: `${i}`, kind: "chat", ts: i } });
    }
    expect(s.chat).toHaveLength(MAX_CHAT_HISTORY);
    expect(s.chat[s.chat.length - 1]?.text).toBe(`${MAX_CHAT_HISTORY + 19}`);
  });
});

describe("roster mutations", () => {
  const withRoom = () => apply(createInitialSnapshot(), { type: "room:state", youId: YOU, state: mkRoomState() });

  it("adds a joining player", () => {
    const s = apply(withRoom(), { type: "player:joined", player: { id: "p-new", nickname: "Zoe", avatar: { emoji: "🐙", color: "#222222" }, score: 0, isHost: false, isDrawing: false, hasGuessed: false, connected: true } });
    expect(s.room?.players.map((p) => p.id)).toContain("p-new");
  });

  it("removes a leaving player and prunes guessed tracking", () => {
    let s = apply(withRoom(), { type: "guess:correct", playerId: BOB, nickname: "Bob", points: 10 });
    s = apply(s, { type: "player:left", playerId: BOB });
    expect(s.room?.players.map((p) => p.id)).not.toContain(BOB);
    expect(s.guessedIds).not.toContain(BOB);
  });

  it("migrates the host", () => {
    const s = apply(withRoom(), { type: "host:changed", hostId: ALICE });
    expect(s.room?.hostId).toBe(ALICE);
    expect(s.room?.players.find((p) => p.id === ALICE)?.isHost).toBe(true);
    expect(s.room?.players.find((p) => p.id === YOU)?.isHost).toBe(false);
  });
});

describe("reactions", () => {
  it("accumulates and caps floating reactions", () => {
    let s = createInitialSnapshot();
    for (let i = 0; i < MAX_LIVE_REACTIONS + 5; i += 1) {
      s = apply(s, { type: "react", playerId: ALICE, emoji: "🎉" });
    }
    expect(s.reactions).toHaveLength(MAX_LIVE_REACTIONS);
    expect(s.reactions[0]?.id).toBe("rx-6");
  });
});

describe("game:over", () => {
  it("captures the final leaderboard", () => {
    const s = apply(createInitialSnapshot(), {
      type: "game:over",
      leaderboard: [scoreEntry(ALICE, 900), scoreEntry(YOU, 700), scoreEntry(BOB, 500)],
    });
    expect(s.gameOver?.leaderboard[0]?.playerId).toBe(ALICE);
    expect(s.scores).toHaveLength(3);
  });
});

describe("errors", () => {
  it("records protocol errors", () => {
    const s = apply(createInitialSnapshot(), { type: "error", code: "ROOM_FULL", message: "room is full" });
    expect(s.error).toEqual({ code: "ROOM_FULL", message: "room is full", at: FIXED_NOW });
  });
});
