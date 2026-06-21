import type { RoomSettings } from "@skribbl/shared";
import type { Env } from "../env";
import { getLobbyRoom, listPublicRooms, upsertLobbyRoom, type LobbyUpsert } from "../db/queries";

export const LOBBY_CACHE_KEY = "lobby:public:list";
const LOBBY_CACHE_TTL_SEC = 30;

export function roomInitKey(roomId: string): string {
  return `room:init:${roomId}`;
}

/** Public-facing summary of a room for the lobby browser / existence checks. */
export interface RoomSummary {
  roomId: string;
  isPublic: boolean;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  maxRounds: number;
  roundDurationSec: number;
  hostNickname: string | null;
}

export interface RoomInit {
  settings: RoomSettings;
  isPublic: boolean;
}

/** Public, joinable rooms — served from a short-lived KV cache over D1. */
export async function readPublicLobby(env: Env): Promise<RoomSummary[]> {
  try {
    const cached = await env.KV.get(LOBBY_CACHE_KEY);
    if (cached) return JSON.parse(cached) as RoomSummary[];
  } catch {
    /* fall through to D1 */
  }
  let rooms: RoomSummary[] = [];
  try {
    rooms = (await listPublicRooms(env.DB)).map(toSummary);
  } catch {
    rooms = [];
  }
  try {
    await env.KV.put(LOBBY_CACHE_KEY, JSON.stringify(rooms), { expirationTtl: LOBBY_CACHE_TTL_SEC });
  } catch {
    /* cache is best-effort */
  }
  return rooms;
}

export async function invalidatePublicLobby(env: Env): Promise<void> {
  try {
    await env.KV.delete(LOBBY_CACHE_KEY);
  } catch {
    /* best-effort */
  }
}

/** Existence + metadata for a single room (registry row, else creation meta). */
export async function getRoomMeta(env: Env, roomId: string): Promise<RoomSummary | null> {
  try {
    const row = await getLobbyRoom(env.DB, roomId);
    if (row) return toSummary(row);
  } catch {
    /* fall through to KV creation meta */
  }
  try {
    const raw = await env.KV.get(roomInitKey(roomId));
    if (raw) {
      const init = JSON.parse(raw) as RoomInit;
      return {
        roomId,
        isPublic: init.isPublic,
        phase: "lobby",
        playerCount: 0,
        maxPlayers: init.settings.maxPlayers,
        maxRounds: init.settings.maxRounds,
        roundDurationSec: init.settings.roundDurationSec,
        hostNickname: null,
      };
    }
  } catch {
    /* not found */
  }
  return null;
}

/** Seed an empty registry row at room-creation time (before anyone connects). */
export async function seedLobbyRoom(env: Env, roomId: string, settings: RoomSettings): Promise<void> {
  const row: LobbyUpsert = {
    roomId,
    isPublic: settings.isPublic,
    phase: "lobby",
    playerCount: 0,
    maxPlayers: settings.maxPlayers,
    maxRounds: settings.maxRounds,
    roundDurationSec: settings.roundDurationSec,
    hostNickname: null,
  };
  try {
    await upsertLobbyRoom(env.DB, row);
    await invalidatePublicLobby(env);
  } catch {
    /* best-effort — the DO will (re)register on first connect */
  }
}

function toSummary(row: {
  roomId: string;
  isPublic: boolean;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  maxRounds: number;
  roundDurationSec: number;
  hostNickname: string | null;
}): RoomSummary {
  return {
    roomId: row.roomId,
    isPublic: row.isPublic,
    phase: row.phase,
    playerCount: row.playerCount,
    maxPlayers: row.maxPlayers,
    maxRounds: row.maxRounds,
    roundDurationSec: row.roundDurationSec,
    hostNickname: row.hostNickname,
  };
}
