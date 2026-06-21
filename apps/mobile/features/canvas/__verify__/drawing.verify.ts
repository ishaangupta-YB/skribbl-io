/**
 * Pure-logic verification for the drawing board (no React/Skia required):
 * coordinate normalization, stroke batching/throttling, and the segment
 * reconstruction that mirrors a streamed gesture across clients.
 *
 *   ./node_modules/.bin/tsx --tsconfig \
 *     apps/mobile/features/canvas/__verify__/tsconfig.verify.json \
 *     apps/mobile/features/canvas/__verify__/drawing.verify.ts
 */
import type { Point, Stroke } from "@skribbl/shared";
import { toNormalized, toPixels } from "../lib/coords";
import { StrokeBatcher } from "../lib/strokeBatcher";
import { appendStrokeSegment } from "../../../lib/realtime/strokes";

// Node-only exit via globalThis so this standalone script never depends on
// @types/node and never breaks the app's typecheck.
const proc = (globalThis as unknown as { process?: { exit?: (code?: number) => never } }).process;

let failures = 0;
function check(label: string, cond: boolean): void {
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}`);
  if (!cond) failures += 1;
}

function reconstruct(segments: Stroke[]): Stroke[] {
  return segments.reduce<Stroke[]>((acc, seg) => appendStrokeSegment(acc, seg), []);
}

function pts(stroke: Stroke): string {
  return stroke.points.map((p) => `${p.x},${p.y}`).join(" ");
}

/* ---- coords ---- */
{
  const size = { width: 200, height: 100 };
  const n = toNormalized(100, 50, size);
  check("toNormalized maps center to 0.5,0.5", n.x === 0.5 && n.y === 0.5);
  const px = toPixels({ x: 0.5, y: 0.5 }, size);
  check("toPixels round-trips back to pixels", px.x === 100 && px.y === 50);
  const clamped = toNormalized(400, -20, size);
  check("toNormalized clamps out-of-bounds to [0,1]", clamped.x === 1 && clamped.y === 0);
  check("toNormalized guards a zero-size canvas", toNormalized(10, 10, { width: 0, height: 0 }).x === 0);
}

/* ---- batcher: streamed segments reconstruct to the original polyline ---- */
{
  const path: Point[] = [
    { x: 0.0, y: 0.0 },
    { x: 0.1, y: 0.1 },
    { x: 0.2, y: 0.2 },
    { x: 0.3, y: 0.25 },
    { x: 0.4, y: 0.3 },
  ];
  let clock = 0;
  const segments: Stroke[] = [];
  const batcher = new StrokeBatcher({
    color: "#000000",
    width: 6,
    mode: "draw",
    emitIntervalMs: 10,
    onFlush: (s) => segments.push(s),
    now: () => clock,
  });
  const times = [0, 5, 10, 12, 20];
  batcher.begin();
  path.forEach((p, i) => {
    clock = times[i] ?? clock;
    batcher.addPoint(p);
  });
  batcher.end();

  check("batcher emitted multiple throttled segments", segments.length >= 2);
  check("first segment starts a fresh stroke (no bridge point)", segments[0]?.points[0]?.x === 0);
  const rebuilt = reconstruct(segments);
  check("streamed segments reconstruct to exactly one stroke", rebuilt.length === 1);
  check(
    "reconstructed stroke equals the original (de-duped) path",
    pts(rebuilt[0] as Stroke) === path.map((p) => `${p.x},${p.y}`).join(" "),
  );
  check("reconstructed stroke keeps the style", rebuilt[0]?.color === "#000000" && rebuilt[0]?.width === 6);
}

/* ---- batcher: de-dupes repeated points ---- */
{
  const segments: Stroke[] = [];
  const batcher = new StrokeBatcher({
    color: "#fff",
    width: 2,
    mode: "draw",
    emitIntervalMs: 1000,
    onFlush: (s) => segments.push(s),
    now: () => 0,
  });
  batcher.begin();
  batcher.addPoint({ x: 0.5, y: 0.5 });
  batcher.addPoint({ x: 0.5, y: 0.5 });
  batcher.addPoint({ x: 0.5, y: 0.5 });
  batcher.end();
  check("repeated identical points collapse to a single point", segments[0]?.points.length === 1);
}

/* ---- batcher: oversized flush is chunked but still reconstructs ---- */
{
  const segments: Stroke[] = [];
  const batcher = new StrokeBatcher({
    color: "#123456",
    width: 4,
    mode: "draw",
    emitIntervalMs: 1_000_000, // never auto-flush; only end() flushes
    maxPointsPerFrame: 3,
    onFlush: (s) => segments.push(s),
    now: () => 0,
  });
  const path: Point[] = [
    { x: 0.0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.2, y: 0 },
    { x: 0.3, y: 0 },
    { x: 0.4, y: 0 },
  ];
  batcher.begin();
  path.forEach((p) => batcher.addPoint(p));
  batcher.end();
  check("oversized flush splits into <= maxPointsPerFrame chunks", segments.every((s) => s.points.length <= 3));
  const rebuilt = reconstruct(segments);
  check("chunked frames still reconstruct to one stroke", rebuilt.length === 1 && rebuilt[0]?.points.length === 5);
}

/* ---- separate gestures stay separate strokes ---- */
{
  const a: Stroke = { points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }], color: "#000", width: 3, mode: "draw" };
  const b: Stroke = { points: [{ x: 0.6, y: 0.6 }, { x: 0.9, y: 0.9 }], color: "#000", width: 3, mode: "draw" };
  const result = reconstruct([a, b]);
  check("non-contiguous segments remain distinct strokes", result.length === 2);
  const erase: Stroke = { points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 }], color: "#000", width: 3, mode: "erase" };
  check("different mode never merges even if points touch", reconstruct([a, erase]).length === 2);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
proc?.exit?.(failures === 0 ? 0 : 1);
