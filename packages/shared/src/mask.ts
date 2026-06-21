import { GAME } from "./constants";
import { clampInt } from "./utils";

function isLetterLike(ch: string): boolean {
  return /[a-z0-9]/iu.test(ch);
}

/** Fully hidden mask: letters -> "_", spaces preserved, punctuation kept. */
export function maskWord(word: string): string {
  return [...word]
    .map((ch) => {
      if (/\s/u.test(ch)) return " ";
      return isLetterLike(ch) ? "_" : ch;
    })
    .join("");
}

/** Maximum number of letters a hint is ever allowed to reveal for a word. */
export function maxHintLetters(word: string): number {
  const letters = [...word].filter(isLetterLike).length;
  return Math.floor(letters * GAME.HINT_MAX_REVEAL_FRACTION);
}

/**
 * Reveal `count` letters of `word`, spread evenly and deterministically so every
 * client renders the exact same hint. Non-letters are always shown.
 */
export function revealLetters(word: string, count: number): string {
  const chars = [...word];
  const letterPositions = chars
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => isLetterLike(ch))
    .map(({ i }) => i);

  const revealCount = clampInt(count, 0, letterPositions.length);
  const revealed = new Set(pickSpread(letterPositions, revealCount));

  return chars
    .map((ch, i) => {
      if (/\s/u.test(ch)) return " ";
      if (!isLetterLike(ch)) return ch;
      return revealed.has(i) ? ch : "_";
    })
    .join("");
}

/** Choose `count` items evenly spread across `items` (deterministic). */
function pickSpread(items: number[], count: number): number[] {
  if (count <= 0) return [];
  if (count >= items.length) return [...items];
  const out: number[] = [];
  const step = items.length / count;
  for (let k = 0; k < count; k += 1) {
    out.push(items[Math.floor(k * step + step / 2)] as number);
  }
  return out;
}
