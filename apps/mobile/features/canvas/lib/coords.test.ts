import { describe, expect, it } from "vitest";
import { clamp01, toNormalized, toPixels, type Size } from "./coords";

const SIZE: Size = { width: 200, height: 100 };

describe("clamp01", () => {
  it("clamps below 0 to 0 and above 1 to 1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe("toNormalized", () => {
  it("maps the top-left corner to (0,0) and bottom-right to (1,1)", () => {
    expect(toNormalized(0, 0, SIZE)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(200, 100, SIZE)).toEqual({ x: 1, y: 1 });
  });

  it("maps the center to (0.5, 0.5)", () => {
    expect(toNormalized(100, 50, SIZE)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps out-of-bounds touch points to the canvas", () => {
    expect(toNormalized(-10, -10, SIZE)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(300, 300, SIZE)).toEqual({ x: 1, y: 1 });
  });

  it("returns (0,0) for a zero-size canvas (no division by zero)", () => {
    expect(toNormalized(50, 50, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
    expect(toNormalized(50, 50, { width: -1, height: -1 })).toEqual({ x: 0, y: 0 });
  });
});

describe("toPixels", () => {
  it("is the inverse of toNormalized for in-bounds points", () => {
    const px = toNormalized(123, 45, SIZE);
    const back = toPixels(px, SIZE);
    expect(back.x).toBeCloseTo(123, 5);
    expect(back.y).toBeCloseTo(45, 5);
  });

  it("maps (0,0) → (0,0) and (1,1) → (width,height)", () => {
    expect(toPixels({ x: 0, y: 0 }, SIZE)).toEqual({ x: 0, y: 0 });
    expect(toPixels({ x: 1, y: 1 }, SIZE)).toEqual({ x: 200, y: 100 });
  });
});
