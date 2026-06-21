import { WORD_PACKS, collectWords, listWordPacks, type RoomSettings, type WordPack } from "@skribbl/shared";
import type { Env } from "../env";
import { getPackWords, listWordPackRows } from "../db/queries";

/**
 * All word packs visible to clients: the bundled packs from `@skribbl/shared`
 * plus any custom packs stored in D1 (D1 rows override bundled ones by id).
 */
export async function listAllWordPacks(env: Env): Promise<WordPack[]> {
  const byId = new Map<string, WordPack>();
  for (const pack of listWordPacks()) byId.set(pack.id, pack);
  try {
    for (const row of await listWordPackRows(env.DB)) {
      byId.set(row.id, { id: row.id, name: row.name, description: row.description, words: row.words });
    }
  } catch {
    /* D1 unavailable — bundled packs are always sufficient to play. */
  }
  return [...byId.values()];
}

/**
 * Build the (lowercased, de-duplicated) word pool for a room. Bundled packs and
 * host custom words come from `@skribbl/shared`; any pack ids that are NOT
 * bundled are looked up as custom packs in D1 and merged in.
 */
export async function buildWordPool(env: Env, settings: RoomSettings): Promise<string[]> {
  const pool = new Set(collectWords(settings.wordPackIds, settings.customWords));
  const customIds = settings.wordPackIds.filter((id) => !WORD_PACKS[id]);
  if (customIds.length > 0) {
    try {
      for (const w of await getPackWords(env.DB, customIds)) {
        const t = w.trim().toLowerCase();
        if (t) pool.add(t);
      }
    } catch {
      /* ignore — fall back to whatever the bundled packs provided. */
    }
  }
  return [...pool];
}
