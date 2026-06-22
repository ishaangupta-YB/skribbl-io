import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { lobbyRooms, wordPacks, words, type LobbyRoomRow, type WordPackRow, type WordRow } from "./schema";

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

/** Return D1 word packs with their words joined in. */
export async function listWordPackRows(
  d1: D1Database,
): Promise<{ id: string; name: string; description: string; isPublic: boolean; createdBy: string | null; words: string[] }[]> {
  const rows = await getDb(d1)
    .select({
      id: wordPacks.id,
      name: wordPacks.name,
      description: wordPacks.description,
      isPublic: wordPacks.isPublic,
      createdBy: wordPacks.createdBy,
      word: words.word,
    })
    .from(wordPacks)
    .leftJoin(words, eq(words.packId, wordPacks.id));

  const byId = new Map<string, { id: string; name: string; description: string; isPublic: boolean; createdBy: string | null; words: string[] }>();
  for (const r of rows) {
    let entry = byId.get(r.id);
    if (!entry) {
      entry = {
        id: r.id,
        name: r.name,
        description: r.description,
        isPublic: r.isPublic,
        createdBy: r.createdBy,
        words: [],
      };
      byId.set(r.id, entry);
    }
    if (r.word) entry.words.push(r.word);
  }
  return [...byId.values()];
}

/** Fetch a single D1 word pack with its words. */
export async function getWordPackById(
  d1: D1Database,
  id: string,
): Promise<{ id: string; name: string; description: string; isPublic: boolean; createdBy: string | null; createdAt: number; words: string[] } | null> {
  const [pack, wordRows] = await Promise.all([
    getDb(d1).select().from(wordPacks).where(eq(wordPacks.id, id)).limit(1),
    getDb(d1).select({ word: words.word }).from(words).where(eq(words.packId, id)),
  ]);
  if (!pack[0]) return null;
  return {
    ...pack[0],
    words: wordRows.map((r) => r.word),
  };
}

/** Flatten the words of the given (custom) pack ids into a single list. */
export async function getPackWords(d1: D1Database, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await getDb(d1)
    .select({ word: words.word })
    .from(words)
    .where(inArray(words.packId, ids));
  return rows.map((r) => r.word);
}

export interface WordPackInsert {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string | null;
  words: string[];
}

/** Insert a custom word pack and its words. */
export async function insertWordPack(d1: D1Database, pack: WordPackInsert): Promise<WordPackRow & { words: string[] }> {
  const db = getDb(d1);
  await db.insert(wordPacks).values({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    isPublic: pack.isPublic,
    createdBy: pack.createdBy,
  });
  if (pack.words.length > 0) {
    await db.insert(words).values(pack.words.map((w) => ({ packId: pack.id, word: w })));
  }
  return { ...pack, createdAt: Date.now() };
}

/** Count the words in a pack. */
export async function countWordsInPack(d1: D1Database, packId: string): Promise<number> {
  const rows = await getDb(d1)
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(words)
    .where(eq(words.packId, packId));
  return rows[0]?.count ?? 0;
}

export type { WordPackRow, WordRow, LobbyRoomRow };
