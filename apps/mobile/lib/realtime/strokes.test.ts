import { describe, expect, it } from "vitest";
import type { Stroke } from "@skribbl/shared";
import { appendStrokeSegment, canMergeSegment } from "./strokes";

const S = (points: [number, number][], over: Partial<Stroke> = {}): Stroke => ({
  points: points.map(([x, y]) => ({ x, y })),
  color: "#000000",
  width: 4,
  mode: "draw",
  ...over,
});

describe("canMergeSegment", () => {
  it("merges when style matches and prev.tail === next.head", () => {
    expect(canMergeSegment(S([[0, 0], [1, 1]]), S([[1, 1], [2, 2]]))).toBe(true);
  });

  it("does not merge when the boundary points differ", () => {
    expect(canMergeSegment(S([[0, 0], [1, 1]]), S([[1, 2], [2, 2]]))).toBe(false);
  });

  it("does not merge across different colors", () => {
    expect(canMergeSegment(S([[0, 0], [1, 1]]), S([[1, 1], [2, 2]], { color: "#FFFFFF" }))).toBe(false);
  });

  it("does not merge across different widths", () => {
    expect(canMergeSegment(S([[0, 0], [1, 1]]), S([[1, 1], [2, 2]], { width: 8 }))).toBe(false);
  });

  it("does not merge across draw/erase modes", () => {
    expect(canMergeSegment(S([[0, 0], [1, 1]]), S([[1, 1], [2, 2]], { mode: "erase" }))).toBe(false);
  });
});

describe("appendStrokeSegment", () => {
  it("appends a non-continuation segment as a new stroke", () => {
    const out = appendStrokeSegment([S([[0, 0], [1, 1]])], S([[5, 5], [6, 6]]));
    expect(out).toHaveLength(2);
  });

  it("merges a continuation segment, dropping the shared boundary point", () => {
    const out = appendStrokeSegment([S([[0, 0], [1, 1]])], S([[1, 1], [2, 2], [3, 3]]));
    expect(out).toHaveLength(1);
    expect(out[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it("starts a new stroke list when given an empty list", () => {
    const out = appendStrokeSegment([], S([[0, 0], [1, 1]]));
    expect(out).toHaveLength(1);
    expect(out[0]!.points).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const input = [S([[0, 0], [1, 1]])];
    const out = appendStrokeSegment(input, S([[1, 1], [2, 2]]));
    expect(input).toHaveLength(1);
    expect(input[0]!.points).toHaveLength(2);
    expect(out).not.toBe(input);
  });
});
