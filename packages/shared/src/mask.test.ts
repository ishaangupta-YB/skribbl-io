import { describe, expect, it } from "vitest";
import { maskWord, maxHintLetters, revealLetters } from "./mask";

describe("maskWord", () => {
  it("hides letters but keeps spaces and punctuation", () => {
    expect(maskWord("ice cream")).toBe("___ _____");
    expect(maskWord("t-shirt")).toBe("_-_____");
  });
});

describe("revealLetters", () => {
  it("reveals exactly the requested number of letters, deterministically", () => {
    const a = revealLetters("elephant", 3);
    const b = revealLetters("elephant", 3);
    expect(a).toBe(b);
    expect([...a].filter((c) => c !== "_").length).toBe(3);
  });

  it("never reveals more letters than exist", () => {
    expect(revealLetters("cat", 99)).toBe("cat");
  });

  it("reveals nothing for a count of 0", () => {
    expect(revealLetters("cat", 0)).toBe("___");
  });
});

describe("maxHintLetters", () => {
  it("caps hints to the configured fraction", () => {
    expect(maxHintLetters("abcdefghij")).toBeLessThanOrEqual(4);
  });
});
