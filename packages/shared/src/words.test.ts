import { describe, expect, it } from "vitest";
import { collectWords, getRandomWords, getWordPack, WORD_PACKS } from "./words";

/** Tiny seeded RNG so "random" picks are reproducible in tests. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("word packs", () => {
  it("ships a non-empty default pack", () => {
    expect(getWordPack("default")?.words.length ?? 0).toBeGreaterThan(20);
  });

  it("has no duplicate words within a pack", () => {
    for (const pack of Object.values(WORD_PACKS)) {
      expect(new Set(pack.words).size).toBe(pack.words.length);
    }
  });

  it("merges packs and custom words without duplicates", () => {
    const words = collectWords(["default", "animals"], ["MyCustomWord"]);
    expect(new Set(words).size).toBe(words.length);
    expect(words).toContain("mycustomword");
  });
});

describe("getRandomWords", () => {
  it("returns the requested count with no duplicates", () => {
    const pool = collectWords(["default"]);
    const picks = getRandomWords(pool, 3, [], seededRng(1));
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
  });

  it("avoids excluded words when possible", () => {
    const pool = collectWords(["default"]);
    const exclude = pool.slice(0, 3);
    const picks = getRandomWords(pool, 3, exclude, seededRng(2));
    for (const p of picks) expect(exclude).not.toContain(p);
  });

  it("is deterministic for a given seed", () => {
    const pool = collectWords(["default"]);
    expect(getRandomWords(pool, 4, [], seededRng(7))).toEqual(
      getRandomWords(pool, 4, [], seededRng(7)),
    );
  });
});
