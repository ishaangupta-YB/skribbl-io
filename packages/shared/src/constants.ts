/**
 * Central game configuration shared by every runtime.
 *
 * The Cloudflare Durable Object is the *authoritative* owner of game state and
 * timers; the Expo client reads the same constants so UI (countdowns, limits,
 * validation) stays in lockstep with the server. Never fork these values.
 */
export const GAME = {
  // ---- room / players ----
  MIN_PLAYERS_TO_START: 2,
  MAX_PLAYERS: 8,
  MIN_NICKNAME_LEN: 1,
  MAX_NICKNAME_LEN: 16,
  MIN_ROOM_ID_LEN: 4,
  MAX_ROOM_ID_LEN: 12,
  MAX_CHAT_LEN: 120,

  // ---- rounds / timing (seconds) ----
  DEFAULT_MAX_ROUNDS: 3,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 10,
  DEFAULT_ROUND_DURATION_SEC: 70,
  MIN_ROUND_DURATION_SEC: 30,
  MAX_ROUND_DURATION_SEC: 180,
  WORD_CHOICE_COUNT: 3,
  WORD_CHOICE_DURATION_SEC: 15,
  TURN_REVEAL_DURATION_SEC: 4,
  ROUND_END_DURATION_SEC: 5,

  // ---- scoring ----
  GUESS_MIN_POINTS: 50,
  GUESS_MAX_POINTS: 250,
  FIRST_GUESS_BONUS: 50,
  ORDER_BONUS_STEP: 10,
  DRAWER_MAX_POINTS: 150,

  // ---- hints (reveal letters as the clock winds down) ----
  HINT_MAX_REVEAL_FRACTION: 0.4,
  HINT_START_FRACTION: 0.5,

  // ---- drawing safety limits (anti-abuse / bandwidth) ----
  MAX_STROKE_POINTS: 600,
  MIN_STROKE_WIDTH: 1,
  MAX_STROKE_WIDTH: 48,

  // ---- networking ----
  HEARTBEAT_INTERVAL_MS: 25_000,
  RECONNECT_GRACE_MS: 20_000,
} as const;

export type GameConfig = typeof GAME;

/** Unambiguous room-code alphabet (no 0/O/1/I to avoid confusion when sharing). */
export const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DEFAULT_ROOM_ID_LEN = 6;

/** Coordinates in draw strokes are normalized to this range (resolution-independent). */
export const CANVAS_COORD_MIN = 0;
export const CANVAS_COORD_MAX = 1;
