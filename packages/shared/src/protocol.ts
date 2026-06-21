import { z } from "zod";
import { GAME } from "./constants";
import {
  avatarSchema,
  chatMessageSchema,
  nicknameSchema,
  playerSchema,
  publicRoomStateSchema,
  roomSettingsSchema,
  scoreEntrySchema,
  strokeSchema,
} from "./schemas";

/* ============================================================
 * Client -> Server messages
 * Connection model: the client opens a WebSocket to
 *   wss://<worker>/api/rooms/:roomId/ws
 * then sends `join` as the first message. The room id lives in the URL and maps
 * to a single Durable Object instance via `idFromName(roomId)`.
 * ============================================================ */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    nickname: nicknameSchema,
    avatar: avatarSchema,
  }),
  /** Host starts the game from the lobby. */
  z.object({ type: z.literal("start") }),
  /** Drawer picks one of the offered words during the `choosing` phase. */
  z.object({ type: z.literal("select-word"), word: z.string() }),
  /** Drawer pushes a coalesced batch of stroke points. */
  z.object({ type: z.literal("draw"), stroke: strokeSchema }),
  z.object({ type: z.literal("draw:clear") }),
  z.object({ type: z.literal("draw:undo") }),
  /** Any non-drawer sends chat; the server decides if it is a correct guess. */
  z.object({ type: z.literal("chat"), text: z.string().trim().min(1).max(GAME.MAX_CHAT_LEN) }),
  z.object({ type: z.literal("react"), emoji: z.string().min(1).max(12) }),
  /** Host-only: tweak settings while in the lobby. */
  z.object({ type: z.literal("settings:update"), settings: roomSettingsSchema.partial() }),
  /** Host-only. */
  z.object({ type: z.literal("kick"), playerId: z.string() }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("ping") }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];

/* ============================================================
 * Server -> Client messages
 * ============================================================ */
export const errorCodeSchema = z.enum([
  "ROOM_FULL",
  "ROOM_NOT_FOUND",
  "NICK_TAKEN",
  "INVALID_MESSAGE",
  "NOT_ALLOWED",
  "GAME_IN_PROGRESS",
  "RATE_LIMITED",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const serverMessageSchema = z.discriminatedUnion("type", [
  /** Full sanitized snapshot — sent on join and after structural changes. */
  z.object({
    type: z.literal("room:state"),
    state: publicRoomStateSchema,
    youId: z.string(),
  }),
  z.object({ type: z.literal("player:joined"), player: playerSchema }),
  z.object({ type: z.literal("player:left"), playerId: z.string() }),
  z.object({ type: z.literal("host:changed"), hostId: z.string() }),

  // ---- turn lifecycle ----
  z.object({
    type: z.literal("turn:choosing"),
    drawerId: z.string(),
    round: z.number().int(),
    durationSec: z.number().int(),
    phaseEndsAt: z.number().int(),
    /** Populated only in the copy sent to the drawer. */
    choices: z.array(z.string()).nullable(),
  }),
  z.object({
    type: z.literal("turn:start"),
    drawerId: z.string(),
    round: z.number().int(),
    maskedWord: z.string(),
    wordLength: z.number().int(),
    durationSec: z.number().int(),
    phaseEndsAt: z.number().int(),
    /** Populated only in the copy sent to the drawer. */
    word: z.string().nullable(),
  }),
  z.object({ type: z.literal("turn:hint"), maskedWord: z.string() }),
  z.object({
    type: z.literal("turn:reveal"),
    word: z.string(),
    scores: z.array(scoreEntrySchema),
  }),

  // ---- drawing ----
  z.object({ type: z.literal("draw"), playerId: z.string(), stroke: strokeSchema }),
  z.object({ type: z.literal("draw:clear") }),
  z.object({ type: z.literal("draw:undo") }),

  // ---- chat / social ----
  z.object({ type: z.literal("chat"), message: chatMessageSchema }),
  z.object({
    type: z.literal("guess:correct"),
    playerId: z.string(),
    nickname: z.string(),
    points: z.number().int(),
  }),
  z.object({ type: z.literal("scores:update"), scores: z.array(scoreEntrySchema) }),
  z.object({ type: z.literal("react"), playerId: z.string(), emoji: z.string() }),

  // ---- end of game ----
  z.object({ type: z.literal("game:over"), leaderboard: z.array(scoreEntrySchema) }),

  // ---- infra ----
  z.object({ type: z.literal("error"), code: errorCodeSchema, message: z.string() }),
  z.object({ type: z.literal("pong") }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ServerMessageType = ServerMessage["type"];

/* ============================================================
 * Parsing / encoding helpers (used by both client and DO)
 * ============================================================ */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  const json = typeof raw === "string" ? safeJson(raw) : raw;
  if (json === undefined) return { ok: false, error: "invalid JSON" };
  const result = clientMessageSchema.safeParse(json);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.message };
}

export function parseServerMessage(raw: unknown): ParseResult<ServerMessage> {
  const json = typeof raw === "string" ? safeJson(raw) : raw;
  if (json === undefined) return { ok: false, error: "invalid JSON" };
  const result = serverMessageSchema.safeParse(json);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.message };
}

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
