/**
 * Pure, framework-agnostic types for Agent D's game flow.
 *
 * This layer depends ONLY on `@skribbl/shared` (the frozen contract) so it can
 * be unit-tested with vitest before the Expo app / WS client exist. The React
 * components read a {@link RoomSnapshot} and render it; the reducer in
 * `gameStore.ts` produces that snapshot from the server's `ServerMessage`
 * stream (the exact frames emitted by `tools/mock-ws-server`).
 */
import type {
  Avatar,
  ChatMessage,
  ErrorCode,
  Player,
  PublicRoomState,
  ScoreEntry,
} from "@skribbl/shared";

/** On-device identity (owned by Agent B's `useIdentity`; mirrored here). */
export interface Identity {
  nickname: string;
  avatar: Avatar;
}

/** WebSocket lifecycle state surfaced by Agent C's connection. */
export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

/** A single floating reaction emoji, keyed for animation + expiry. */
export interface ReactionEvent {
  /** Locally-generated unique id (server frames are not deduplicated). */
  id: string;
  playerId: string;
  emoji: string;
  /** epoch ms when received, used to expire the floating bubble. */
  at: number;
}

/** Transient feedback for the local player's own guesses. */
export interface GuessFeedback {
  kind: "close" | "correct";
  text: string;
  /** epoch ms — used to auto-dismiss the toast. */
  at: number;
}

/** The reveal overlay payload, captured from `turn:reveal`. */
export interface RevealInfo {
  word: string;
  scores: ScoreEntry[];
}

/** The last protocol error received (e.g. ROOM_FULL, NOT_ALLOWED). */
export interface RoomError {
  code: ErrorCode;
  message: string;
  at: number;
}

/**
 * The canonical local mirror of a room that the game UI renders.
 *
 * The server is authoritative — this is only an accumulation of the frames it
 * sends. `room:state` rebuilds most of it; the incremental `turn:*`,
 * `scores:update`, `guess:correct`, `player:*` and `chat` frames keep the UI
 * responsive between snapshots (the mock does NOT send a fresh `room:state`
 * after every guess, so we track per-turn progress locally).
 */
export interface RoomSnapshot {
  status: ConnectionStatus;
  youId: string | null;
  /** Last full snapshot (null until the first `room:state`). */
  room: PublicRoomState | null;

  // ---- live, per-turn mirrors (kept fresh between room:state frames) ----
  /** Word the guesser sees (blanks / progressively revealed letters). */
  maskedWord: string | null;
  wordLength: number | null;
  /** The real word — ONLY ever populated in frames addressed to the drawer. */
  word: string | null;
  /** Drawer's word choices during `choosing` (drawer-only). */
  choices: string[] | null;

  // ---- per-turn progress (reset every new turn) ----
  /** Players who have guessed correctly this turn (for live badges). */
  guessedIds: string[];
  /** Whether the local player has already guessed correctly this turn. */
  youGuessedCorrect: boolean;

  // ---- scoreboard / results ----
  /** Latest scoreboard (from `scores:update` / `turn:reveal` / `game:over`). */
  scores: ScoreEntry[];
  /** Active during the `reveal` phase. */
  reveal: RevealInfo | null;
  /** Set once the game ends; carries the final leaderboard. */
  gameOver: { leaderboard: ScoreEntry[] } | null;

  // ---- social / feedback ----
  chat: ChatMessage[];
  reactions: ReactionEvent[];
  guessFeedback: GuessFeedback | null;
  error: RoomError | null;
}

/** Per-row data the scoreboard renders (derived). */
export interface ScoreRow {
  rank: number;
  playerId: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  roundPoints: number;
  isDrawing: boolean;
  hasGuessed: boolean;
  isYou: boolean;
}

/** Derived countdown for the active timed phase. */
export interface Countdown {
  /** Whole seconds remaining (>= 0). */
  secondsLeft: number;
  /** Raw milliseconds remaining (may be negative if the clock overran). */
  msLeft: number;
  /** 0..1 fraction of the phase elapsed (1 = time's up). */
  fractionElapsed: number;
  /** True while a timed phase is active. */
  active: boolean;
}

/** Re-export the contract `Player` for convenience in the UI layer. */
export type { Player };
