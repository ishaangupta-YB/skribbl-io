/**
 * Hand-built frame fixtures that mirror, exactly, the sequence
 * `tools/mock-ws-server` emits for a 3-player game. Used by the deterministic
 * reducer/selector tests (the live end-to-end variant lives in
 * `playthrough.test.ts`).
 */
import {
  defaultRoomSettings,
  maskWord,
  type Avatar,
  type Player,
  type PublicRoomState,
  type ScoreEntry,
  type ServerMessage,
} from "@skribbl/shared";

export const YOU = "p-you";
export const ALICE = "p-alice";
export const BOB = "p-bob";

const AVATARS: Record<string, Avatar> = {
  [YOU]: { emoji: "🦊", color: "#4F46E5" },
  [ALICE]: { emoji: "🐼", color: "#EC4899" },
  [BOB]: { emoji: "🐸", color: "#10B981" },
};

const NICKS: Record<string, string> = { [YOU]: "You", [ALICE]: "Alice", [BOB]: "Bob" };

export function mkPlayer(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    nickname: NICKS[id] ?? id,
    avatar: AVATARS[id] ?? { emoji: "🙂", color: "#888888" },
    score: 0,
    isHost: false,
    isDrawing: false,
    hasGuessed: false,
    connected: true,
    ...over,
  };
}

export function mkRoomState(over: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    roomId: "TESTRM",
    phase: "lobby",
    settings: { ...defaultRoomSettings },
    players: [mkPlayer(YOU, { isHost: true }), mkPlayer(ALICE), mkPlayer(BOB)],
    hostId: YOU,
    currentRound: 0,
    drawerId: null,
    maskedWord: null,
    wordLength: null,
    phaseEndsAt: null,
    word: null,
    wordChoices: null,
    ...over,
  };
}

export function scoreEntry(id: string, score: number, roundPoints = 0): ScoreEntry {
  return {
    playerId: id,
    nickname: NICKS[id] ?? id,
    avatar: AVATARS[id] ?? { emoji: "🙂", color: "#888888" },
    score,
    roundPoints,
  };
}

/**
 * The frames a *guesser* (YOU) receives for one full turn where ALICE draws
 * "tiger", BOB guesses correctly, then YOU guess correctly. Mirrors the mock's
 * ordering: turn:choosing → room:state → turn:start → room:state →
 * (hint) → guess:correct/chat/scores:update ×2 → turn:reveal → room:state.
 */
export function guesserTurnFrames(opts: {
  round: number;
  phaseEndsAt: number;
  word?: string;
}): ServerMessage[] {
  const word = opts.word ?? "tiger";
  const masked = maskWord(word);
  return [
    {
      type: "turn:choosing",
      drawerId: ALICE,
      round: opts.round,
      durationSec: 15,
      phaseEndsAt: opts.phaseEndsAt,
      choices: null, // guessers never receive choices
    },
    {
      type: "room:state",
      youId: YOU,
      state: mkRoomState({
        phase: "choosing",
        currentRound: opts.round,
        drawerId: ALICE,
        phaseEndsAt: opts.phaseEndsAt,
        players: [mkPlayer(YOU, { isHost: true }), mkPlayer(ALICE, { isDrawing: true }), mkPlayer(BOB)],
      }),
    },
    {
      type: "turn:start",
      drawerId: ALICE,
      round: opts.round,
      maskedWord: masked,
      wordLength: word.length,
      durationSec: 70,
      phaseEndsAt: opts.phaseEndsAt,
      word: null, // guessers never receive the word
    },
    {
      type: "room:state",
      youId: YOU,
      state: mkRoomState({
        phase: "drawing",
        currentRound: opts.round,
        drawerId: ALICE,
        maskedWord: masked,
        wordLength: word.length,
        phaseEndsAt: opts.phaseEndsAt,
        players: [mkPlayer(YOU, { isHost: true }), mkPlayer(ALICE, { isDrawing: true }), mkPlayer(BOB)],
      }),
    },
    { type: "guess:correct", playerId: BOB, nickname: "Bob", points: 240 },
    {
      type: "chat",
      message: { id: "c1", playerId: null, nickname: "", text: "Bob guessed the word!", kind: "correct", ts: 1 },
    },
    {
      type: "scores:update",
      scores: [scoreEntry(BOB, 240, 240), scoreEntry(YOU, 0), scoreEntry(ALICE, 0)],
    },
    { type: "guess:correct", playerId: YOU, nickname: "You", points: 230 },
    {
      type: "chat",
      message: { id: "c2", playerId: null, nickname: "", text: "You guessed the word!", kind: "correct", ts: 2 },
    },
    {
      type: "scores:update",
      scores: [scoreEntry(BOB, 240, 240), scoreEntry(YOU, 230, 230), scoreEntry(ALICE, 0)],
    },
    {
      type: "turn:reveal",
      word,
      scores: [scoreEntry(BOB, 240, 240), scoreEntry(YOU, 230, 230), scoreEntry(ALICE, 150, 150)],
    },
    {
      type: "room:state",
      youId: YOU,
      state: mkRoomState({
        phase: "reveal",
        currentRound: opts.round,
        drawerId: ALICE,
        maskedWord: maskWord(word),
        wordLength: word.length,
        phaseEndsAt: opts.phaseEndsAt,
      }),
    },
  ];
}
