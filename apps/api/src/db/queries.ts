import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { lobbyRooms, wordPacks, type LobbyRoomRow } from "./schema";

export type Database = DrizzleD1Database<Record<string, never>>;

export function getDb(d1: D1Database): Database {
  return drizzle(d1);
}

export interface LobbyUpsert {
  roomId: string;
  isPublic: boolean;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  maxRounds: number;
  roundDurationSec: number;
  hostNickname: string | null;
}

/** Insert or update the registry row for a room (called by the DO on changes). */
export async function upsertLobbyRoom(d1: D1Database, row: LobbyUpsert): Promise<void> {
  const now = Date.now();
  await getDb(d1)
    .insert(lobbyRooms)
    .values({ ...row, updatedAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: lobbyRooms.roomId,
      set: {
        isPublic: row.isPublic,
        phase: row.phase,
        playerCount: row.playerCount,
        maxPlayers: row.maxPlayers,
        maxRounds: row.maxRounds,
        roundDurationSec: row.roundDurationSec,
        hostNickname: row.hostNickname,
        updatedAt: now,
      },
    });
}

export async function deleteLobbyRoom(d1: D1Database, roomId: string): Promise<void> {
  await getDb(d1).delete(lobbyRooms).where(eq(lobbyRooms.roomId, roomId));
}

export async function getLobbyRoom(d1: D1Database, roomId: string): Promise<LobbyRoomRow | null> {
  const rows = await getDb(d1).select().from(lobbyRooms).where(eq(lobbyRooms.roomId, roomId)).limit(1);
  return rows[0] ?? null;
}

/** Public, joinable rooms (in the lobby phase with at least one player). */
export async function listPublicRooms(d1: D1Database, limit = 50): Promise<LobbyRoomRow[]> {
  return getDb(d1)
    .select()
    .from(lobbyRooms)
    .where(and(eq(lobbyRooms.isPublic, true), eq(lobbyRooms.phase, "lobby"), gt(lobbyRooms.playerCount, 0)))
    .orderBy(desc(lobbyRooms.updatedAt))
    .limit(limit);
}

export async function listWordPackRows(d1: D1Database): Promise<{ id: string; name: string; description: string; words: string[] }[]> {
  const rows = await getDb(d1).select().from(wordPacks);
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, words: r.words ?? [] }));
}

/** Flatten the words of the given (custom) pack ids into a single list. */
export async function getPackWords(d1: D1Database, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await getDb(d1).select({ words: wordPacks.words }).from(wordPacks).where(inArray(wordPacks.id, ids));
  const out: string[] = [];
  for (const r of rows) {
    for (const w of r.words ?? []) out.push(w);
  }
  return out;
}
