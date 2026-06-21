import { GAME } from "./constants";
import { clamp } from "./utils";

/**
 * Points awarded to a guesser. More time remaining + guessing earlier = more
 * points. Replaces the legacy `round((200 / timeTaken) * 10)` formula, which
 * produced unbounded scores for fast guesses.
 */
export function calculateGuesserScore(params: {
  timeRemainingMs: number;
  totalTimeMs: number;
  /** 0 = first correct guesser this turn, 1 = second, ... */
  guessOrder: number;
}): number {
  const { timeRemainingMs, totalTimeMs, guessOrder } = params;
  const safeTotal = Math.max(1, totalTimeMs);
  const timeFraction = clamp(timeRemainingMs / safeTotal, 0, 1);
  const timeScore =
    GAME.GUESS_MIN_POINTS +
    Math.round((GAME.GUESS_MAX_POINTS - GAME.GUESS_MIN_POINTS) * timeFraction);
  const orderBonus = Math.max(
    0,
    GAME.FIRST_GUESS_BONUS - Math.max(0, guessOrder) * GAME.ORDER_BONUS_STEP,
  );
  return timeScore + orderBonus;
}

/**
 * Points for the drawer at the end of a turn, proportional to the share of
 * players who guessed correctly. (The legacy game never rewarded the drawer.)
 */
export function calculateDrawerScore(params: {
  correctGuessers: number;
  totalGuessers: number;
}): number {
  const { correctGuessers, totalGuessers } = params;
  if (totalGuessers <= 0) return 0;
  const ratio = clamp(correctGuessers / totalGuessers, 0, 1);
  return Math.round(GAME.DRAWER_MAX_POINTS * ratio);
}

/** Normalize a guess/word for comparison (trim, lowercase, collapse spaces). */
export function normalizeGuess(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

export function isExactGuess(guess: string, word: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(word);
}

/**
 * "Close" guess detection via Levenshtein distance, so the UI can nudge a player
 * who is one or two characters away ("You're close!"). Exact matches are not
 * considered close.
 */
export function isCloseGuess(guess: string, word: string): boolean {
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (g.length === 0 || g === w) return false;
  const distance = levenshtein(g, w);
  const threshold = w.length <= 4 ? 1 : 2;
  return distance > 0 && distance <= threshold;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j += 1) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] as number) + 1;
      const ins = (curr[j - 1] as number) + 1;
      const sub = (prev[j - 1] as number) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j] as number;
  }
  return prev[n] as number;
}
