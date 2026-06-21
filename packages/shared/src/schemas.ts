import { z } from "zod";
import { GAME } from "./constants";

/** Lifecycle phases of a game room. Driven server-side by Durable Object alarms. */
export const gamePhaseSchema = z.enum([
  "lobby",
  "choosing",
  "drawing",
  "reveal",
  "round-end",
  "game-over",
]);
export type GamePhase = z.infer<typeof gamePhaseSchema>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/u;

export const avatarSchema = z.object({
  emoji: z.string().min(1).max(12),
  color: z.string().regex(HEX_COLOR, "must be a hex color like #4F46E5"),
});
export type Avatar = z.infer<typeof avatarSchema>;

export const nicknameSchema = z
  .string()
  .trim()
  .min(GAME.MIN_NICKNAME_LEN)
  .max(GAME.MAX_NICKNAME_LEN);

export const roomIdSchema = z
  .string()
  .trim()
  .min(GAME.MIN_ROOM_ID_LEN)
  .max(GAME.MAX_ROOM_ID_LEN);

export const playerSchema = z.object({
  /** Server-assigned, stable for the lifetime of the WebSocket session. */
  id: z.string(),
  nickname: nicknameSchema,
  avatar: avatarSchema,
  score: z.number().int().nonnegative(),
  isHost: z.boolean(),
  isDrawing: z.boolean(),
  hasGuessed: z.boolean(),
  connected: z.boolean(),
});
export type Player = z.infer<typeof playerSchema>;

export const roomSettingsSchema = z.object({
  maxPlayers: z.number().int().min(GAME.MIN_PLAYERS_TO_START).max(GAME.MAX_PLAYERS),
  maxRounds: z.number().int().min(GAME.MIN_ROUNDS).max(GAME.MAX_ROUNDS),
  roundDurationSec: z
    .number()
    .int()
    .min(GAME.MIN_ROUND_DURATION_SEC)
    .max(GAME.MAX_ROUND_DURATION_SEC),
  /** IDs of bundled/D1 word packs to draw from. */
  wordPackIds: z.array(z.string()).min(1),
  /** Optional host-supplied words mixed into the pool. */
  customWords: z.array(z.string().trim().min(1)),
  isPublic: z.boolean(),
  hintsEnabled: z.boolean(),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

export const defaultRoomSettings: RoomSettings = {
  maxPlayers: GAME.MAX_PLAYERS,
  maxRounds: GAME.DEFAULT_MAX_ROUNDS,
  roundDurationSec: GAME.DEFAULT_ROUND_DURATION_SEC,
  wordPackIds: ["default"],
  customWords: [],
  isPublic: false,
  hintsEnabled: true,
};

/**
 * A drawing point. Coordinates are NORMALIZED to [0,1] so a stroke drawn on a
 * phone renders identically on a tablet or the web — fixing the legacy app's
 * device-specific raw dx/dy bug.
 */
export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof pointSchema>;

export const strokeSchema = z.object({
  /** A polyline batch of points (coalesced client-side to save bandwidth). */
  points: z.array(pointSchema).min(1).max(GAME.MAX_STROKE_POINTS),
  color: z.string().regex(HEX_COLOR),
  width: z.number().min(GAME.MIN_STROKE_WIDTH).max(GAME.MAX_STROKE_WIDTH),
  mode: z.enum(["draw", "erase"]),
});
export type Stroke = z.infer<typeof strokeSchema>;

export const chatKindSchema = z.enum(["chat", "system", "correct", "close"]);
export type ChatKind = z.infer<typeof chatKindSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  /** null for system messages. */
  playerId: z.string().nullable(),
  nickname: z.string(),
  text: z.string(),
  kind: chatKindSchema,
  ts: z.number().int(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const scoreEntrySchema = z.object({
  playerId: z.string(),
  nickname: z.string(),
  avatar: avatarSchema,
  score: z.number().int(),
  roundPoints: z.number().int(),
});
export type ScoreEntry = z.infer<typeof scoreEntrySchema>;

/**
 * The sanitized room snapshot broadcast to clients. The server fills the
 * drawer-only fields (`word`, `wordChoices`) per-recipient; guessers receive
 * only `maskedWord` / `wordLength` so the answer can never leak (legacy bug).
 */
export const publicRoomStateSchema = z.object({
  roomId: z.string(),
  phase: gamePhaseSchema,
  settings: roomSettingsSchema,
  players: z.array(playerSchema),
  hostId: z.string().nullable(),
  currentRound: z.number().int(),
  drawerId: z.string().nullable(),
  maskedWord: z.string().nullable(),
  wordLength: z.number().int().nullable(),
  /** Epoch ms when the current timed phase ends (for client countdown sync). */
  phaseEndsAt: z.number().int().nullable(),
  /** Drawer-only fields (omitted/undefined for guessers). */
  word: z.string().nullable().optional(),
  wordChoices: z.array(z.string()).nullable().optional(),
});
export type PublicRoomState = z.infer<typeof publicRoomStateSchema>;
