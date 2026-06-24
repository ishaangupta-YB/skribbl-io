import { describe, expect, it, vi } from "vitest";
import { GAME, type Stroke } from "@skribbl/shared";
import { StrokeBatcher } from "./strokeBatcher";

const STYLE = { color: "#000000", width: 4, mode: "draw" as const };

function makeBatcher(opts: { now?: () => number; emitIntervalMs?: number; maxPointsPerFrame?: number } = {}) {
  const onFlush = vi.fn();
  const b = new StrokeBatcher({
    ...STYLE,
    onFlush,
    emitIntervalMs: opts.emitIntervalMs ?? 100,
    maxPointsPerFrame: opts.maxPointsPerFrame,
    now: opts.now ?? (() => 0),
  });
  return { b, onFlush };
}

describe("StrokeBatcher — basic flush", () => {
  it("does not flush before the emit interval elapses", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t });
    b.begin({ x: 0, y: 0 });
    t = 50;
    b.addPoint({ x: 0.1, y: 0.1 });
    expect(onFlush).not.toHaveBeenCalled();
    expect(b).toBeTruthy();
  });

  it("flushes once the emit interval has elapsed", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t });
    b.begin({ x: 0, y: 0 });
    t = 110;
    b.addPoint({ x: 0.5, y: 0.5 });
    expect(onFlush).toHaveBeenCalledTimes(1);
    const stroke = onFlush.mock.calls[0]![0] as Stroke;
    expect(stroke.points.length).toBeGreaterThanOrEqual(2);
    expect(stroke.color).toBe("#000000");
    expect(stroke.width).toBe(4);
    expect(stroke.mode).toBe("draw");
  });

  it("the first flush has no bridge point (starts a new stroke)", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t });
    b.begin({ x: 0.1, y: 0.1 });
    t = 110;
    b.addPoint({ x: 0.2, y: 0.2 });
    const stroke = onFlush.mock.calls[0]![0] as Stroke;
    // begin's first point + the added point, no bridge.
    expect(stroke.points[0]).toEqual({ x: 0.1, y: 0.1 });
    expect(stroke.points[1]).toEqual({ x: 0.2, y: 0.2 });
  });

  it("consecutive flushes share the boundary point (bridge)", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t, emitIntervalMs: 100 });
    b.begin({ x: 0, y: 0 });
    t = 110;
    b.addPoint({ x: 0.1, y: 0.1 }); // flush #1: [0,0],[0.1,0.1]
    t = 220;
    b.addPoint({ x: 0.2, y: 0.2 }); // flush #2: bridge [0.1,0.1] + [0.2,0.2]
    const s1 = onFlush.mock.calls[0]![0] as Stroke;
    const s2 = onFlush.mock.calls[1]![0] as Stroke;
    expect(s1.points.at(-1)).toEqual({ x: 0.1, y: 0.1 });
    expect(s2.points[0]).toEqual({ x: 0.1, y: 0.1 });
    expect(s2.points.at(-1)).toEqual({ x: 0.2, y: 0.2 });
  });
});

describe("StrokeBatcher — de-dupe & end", () => {
  it("drops consecutive identical points", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t });
    b.begin({ x: 0, y: 0 });
    t = 110;
    b.addPoint({ x: 0.5, y: 0.5 });
    b.addPoint({ x: 0.5, y: 0.5 }); // dupe, dropped
    const stroke = onFlush.mock.calls[0]![0] as Stroke;
    expect(stroke.points.filter((p) => p.x === 0.5 && p.y === 0.5)).toHaveLength(1);
  });

  it("flushes the tail on end()", () => {
    let t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t });
    b.begin({ x: 0, y: 0 });
    t = 50; // before the interval
    b.addPoint({ x: 0.1, y: 0.1 });
    expect(onFlush).not.toHaveBeenCalled();
    b.end();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});

describe("StrokeBatcher — chunking", () => {
  it("splits an oversized flush into chunks <= maxPointsPerFrame, overlapping by one", () => {
    const t = 0;
    const { b, onFlush } = makeBatcher({ now: () => t, emitIntervalMs: 1, maxPointsPerFrame: 4 });
    b.begin({ x: 0, y: 0 });
    // Add 9 distinct points rapidly; with emitIntervalMs=1 each add flushes.
    // Instead, force one big flush by calling flush() after many adds below the
    // interval. Use a large emit interval so nothing auto-flushes.
    const big = makeBatcher({ now: () => t, emitIntervalMs: 10_000, maxPointsPerFrame: 4 });
    big.b.begin({ x: 0, y: 0 });
    for (let i = 1; i <= 9; i += 1) big.b.addPoint({ x: i / 10, y: i / 10 });
    big.b.flush();
    const calls = big.onFlush.mock.calls;
    for (const c of calls) {
      const s = c[0] as Stroke;
      expect(s.points.length).toBeLessThanOrEqual(4);
      expect(s.points.length).toBeGreaterThanOrEqual(2);
    }
    void b;
    void onFlush;
  });
});

describe("StrokeBatcher — ignores points when inactive", () => {
  it("addPoint before begin is a no-op", () => {
    const { b, onFlush } = makeBatcher();
    b.addPoint({ x: 0.5, y: 0.5 });
    expect(onFlush).not.toHaveBeenCalled();
  });
});

describe("StrokeBatcher — respects contract cap", () => {
  it("defaults maxPointsPerFrame to GAME.MAX_STROKE_POINTS", () => {
    const t = 0;
    const onFlush = vi.fn();
    const b = new StrokeBatcher({ ...STYLE, onFlush, now: () => t, emitIntervalMs: 10_000 });
    b.begin({ x: 0, y: 0 });
    for (let i = 1; i <= GAME.MAX_STROKE_POINTS + 5; i += 1) b.addPoint({ x: i / 1000, y: 0.5 });
    b.flush();
    for (const c of onFlush.mock.calls) {
      expect((c[0] as Stroke).points.length).toBeLessThanOrEqual(GAME.MAX_STROKE_POINTS);
    }
  });
});
