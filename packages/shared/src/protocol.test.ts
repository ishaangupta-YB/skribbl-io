import { describe, expect, it } from "vitest";
import { encode, parseClientMessage, parseServerMessage } from "./protocol";

describe("parseClientMessage", () => {
  it("accepts a valid join message from a JSON string", () => {
    const result = parseClientMessage(
      JSON.stringify({
        type: "join",
        nickname: "Ash",
        avatar: { emoji: "🦊", color: "#4F46E5" },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown message types", () => {
    expect(parseClientMessage({ type: "nope" }).ok).toBe(false);
  });

  it("rejects malformed JSON", () => {
    expect(parseClientMessage("{not json").ok).toBe(false);
  });

  it("enforces chat length bounds", () => {
    expect(parseClientMessage({ type: "chat", text: "" }).ok).toBe(false);
    expect(parseClientMessage({ type: "chat", text: "hello" }).ok).toBe(true);
  });

  it("validates avatar color format", () => {
    const bad = parseClientMessage({
      type: "join",
      nickname: "Ash",
      avatar: { emoji: "🦊", color: "blue" },
    });
    expect(bad.ok).toBe(false);
  });
});

describe("parseServerMessage", () => {
  it("round-trips an encoded server message", () => {
    const result = parseServerMessage(encode({ type: "pong" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.type).toBe("pong");
  });

  it("validates a turn:start payload", () => {
    const result = parseServerMessage({
      type: "turn:start",
      drawerId: "p1",
      round: 1,
      maskedWord: "_ _ _",
      wordLength: 3,
      durationSec: 70,
      phaseEndsAt: Date.now() + 70_000,
      word: null,
    });
    expect(result.ok).toBe(true);
  });
});
