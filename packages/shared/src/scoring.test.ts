import { describe, expect, it } from "vitest";
import { GAME } from "./constants";
import {
  calculateDrawerScore,
  calculateGuesserScore,
  isCloseGuess,
  isExactGuess,
  levenshtein,
  normalizeGuess,
} from "./scoring";

describe("calculateGuesserScore", () => {
  it("awards more points the more time is left", () => {
    const fast = calculateGuesserScore({
      timeRemainingMs: 60_000,
      totalTimeMs: 60_000,
      guessOrder: 0,
    });
    const slow = calculateGuesserScore({
      timeRemainingMs: 5_000,
      totalTimeMs: 60_000,
      guessOrder: 0,
    });
    expect(fast).toBeGreaterThan(slow);
  });

  it("is bounded by configured min/max (plus first-guess bonus)", () => {
    const max = calculateGuesserScore({
      timeRemainingMs: 60_000,
      totalTimeMs: 60_000,
      guessOrder: 0,
    });
    expect(max).toBe(GAME.GUESS_MAX_POINTS + GAME.FIRST_GUESS_BONUS);

    const min = calculateGuesserScore({
      timeRemainingMs: 0,
      totalTimeMs: 60_000,
      guessOrder: 10,
    });
    expect(min).toBe(GAME.GUESS_MIN_POINTS);
  });

  it("rewards earlier guessers via the order bonus", () => {
    const first = calculateGuesserScore({
      timeRemainingMs: 30_000,
      totalTimeMs: 60_000,
      guessOrder: 0,
    });
    const third = calculateGuesserScore({
      timeRemainingMs: 30_000,
      totalTimeMs: 60_000,
      guessOrder: 2,
    });
    expect(first).toBeGreaterThan(third);
  });
});

describe("calculateDrawerScore", () => {
  it("returns 0 when nobody guessed", () => {
    expect(calculateDrawerScore({ correctGuessers: 0, totalGuessers: 0 })).toBe(0);
    expect(calculateDrawerScore({ correctGuessers: 0, totalGuessers: 3 })).toBe(0);
  });

  it("scales with the fraction of correct guessers", () => {
    expect(calculateDrawerScore({ correctGuessers: 3, totalGuessers: 3 })).toBe(
      GAME.DRAWER_MAX_POINTS,
    );
    expect(calculateDrawerScore({ correctGuessers: 2, totalGuessers: 4 })).toBe(
      Math.round(GAME.DRAWER_MAX_POINTS * 0.5),
    );
  });
});

describe("guess matching", () => {
  it("matches exact guesses ignoring case and surrounding space", () => {
    expect(isExactGuess("  Apple ", "apple")).toBe(true);
    expect(isExactGuess("apples", "apple")).toBe(false);
  });

  it("detects close guesses within edit distance", () => {
    expect(isCloseGuess("aple", "apple")).toBe(true);
    expect(isCloseGuess("xyz", "apple")).toBe(false);
    expect(isCloseGuess("apple", "apple")).toBe(false);
  });

  it("computes Levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("normalizes whitespace", () => {
    expect(normalizeGuess("  Hello   World ")).toBe("hello world");
  });
});
