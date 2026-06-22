import { WORD_PACKS, collectWords, listWordPacks, type RoomSettings, type WordPack } from "@skribbl/shared";
import type { Env } from "../env";
import { getPackWords, getWordPackById, insertWordPack, listWordPackRows, type WordPackInsert, type WordPackRow } from "../db/queries";

/** Max words per custom pack (anti-abuse). */
export const MAX_WORDS_PER_PACK = 100;

/** Max word length (drawing a 50-char phrase is no fun). */
export const MAX_WORD_LENGTH = 30;

/** Max pack name/description lengths. */
export const MAX_PACK_NAME_LEN = 50;
export const MAX_PACK_DESCRIPTION_LEN = 200;

/** Tiny, conservative deny list for basic profanity filtering. */
const PROFANITY_DENY_LIST = [
  "ass", "asses", "asshole", "assholes",
  "bitch", "bitches",
  "cock", "cocks",
  "crap", "craps",
  "cum", "cums",
  "damn", "damns",
  "dick", "dicks",
  "fag", "fags", "faggot", "faggots",
  "fuck", "fucks", "fucked", "fucking",
  "hell",
  "nigga", "nigger", "niggers",
  "piss", "pisses", "pissed",
  "pussy", "pussies",
  "shit", "shits", "shitty",
  "slut", "sluts",
  "tit", "tits", "titties",
  "twat", "twats",
  "whore", "whores",
];

/** Remove punctuation/accents and lower-case for profanity checking. */
function normalizeForProfanity(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function hasProfanity(word: string): boolean {
  const normalized = normalizeForProfanity(word);
  if (PROFANITY_DENY_LIST.includes(normalized)) return true;
  for (const bad of PROFANITY_DENY_LIST) {
    if (normalized.includes(bad)) return true;
  }
  return false;
}

export interface WordPackValidationResult {
  ok: true;
  words: string[];
}

export interface WordPackValidationError {
  ok: false;
  errors: string[];
}

/**
 * Validate a host-submitted word pack.
 * - Trims whitespace and lower-cases each word.
 * - Removes duplicates.
 * - Enforces word length and count caps.
 * - Rejects basic profanity.
 */
export function validateWordPack(wordsInput: unknown, name?: string): WordPackValidationResult | WordPackValidationError {
  const errors: string[] = [];

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (trimmedName.length === 0) errors.push("Pack name is required.");
    if (trimmedName.length > MAX_PACK_NAME_LEN) errors.push(`Pack name must be ${MAX_PACK_NAME_LEN} characters or fewer.`);
  }

  let raw: string[] = [];
  if (Array.isArray(wordsInput)) {
    raw = wordsInput.map((w) => String(w));
  } else if (typeof wordsInput === "string") {
    raw = wordsInput.split(/[\n,;]+/);
  } else {
    errors.push("Words must be a list or a string of words separated by commas or newlines.");
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const w of raw) {
    const t = w.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    cleaned.push(t);
  }

  if (cleaned.length === 0) errors.push("At least one word is required.");
  if (cleaned.length > MAX_WORDS_PER_PACK) errors.push(`At most ${MAX_WORDS_PER_PACK} words allowed per pack.`);

  const rejectedLengths = cleaned.filter((w) => w.length > MAX_WORD_LENGTH);
  if (rejectedLengths.length > 0) {
    errors.push(`Words must be ${MAX_WORD_LENGTH} characters or fewer (${rejectedLengths.slice(0, 3).join(", ")}${rejectedLengths.length > 3 ? "…" : ""}).`);
  }

  const rejectedProfanity = cleaned.filter((w) => hasProfanity(w));
  if (rejectedProfanity.length > 0) {
    errors.push(`Some words are not allowed (${rejectedProfanity.slice(0, 3).join(", ")}${rejectedProfanity.length > 3 ? "…" : ""}).`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, words: cleaned };
}

/**
 * All word packs visible to clients: the bundled packs from `@skribbl/shared`
 * plus any custom packs stored in D1 (D1 rows override bundled ones by id).
 */
export async function listAllWordPacks(env: Env): Promise<WordPack[]> {
  const byId = new Map<string, WordPack>();
  for (const pack of listWordPacks()) byId.set(pack.id, pack);
  try {
    for (const row of await listWordPackRows(env.DB)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        words: row.words,
      });
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

/** Create a custom word pack in D1. */
export async function createWordPack(env: Env, input: Omit<WordPackInsert, "id">): Promise<WordPackRow & { words: string[] }> {
  const id = crypto.randomUUID();
  return insertWordPack(env.DB, {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    isPublic: input.isPublic,
    createdBy: input.createdBy,
    words: input.words,
  });
}

/** Fetch a single word pack (D1 only — bundled packs are served by `@skribbl/shared`). */
export async function getWordPack(env: Env, id: string): Promise<WordPack | null> {
  // Bundled packs take precedence.
  const bundled = WORD_PACKS[id];
  if (bundled) return bundled;

  try {
    return await getWordPackById(env.DB, id);
  } catch {
    return null;
  }
}
