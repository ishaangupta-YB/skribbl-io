import type { Point, Stroke } from "@skribbl/shared";

/**
 * Drawing-board reconstruction logic, kept pure (no React/zustand) so it can be
 * unit-tested directly and reused by the store.
 *
 * The drawer streams a gesture as several `draw` frames (segments) that overlap
 * by one boundary point (see `StrokeBatcher`). `appendStrokeSegment` stitches a
 * newly-received segment onto the previous stroke when they share that boundary
 * and style, so every client ends up with identical full strokes — which also
 * makes `draw:undo` remove a whole stroke rather than a fragment.
 */
function eqPoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function canMergeSegment(prev: Stroke, next: Stroke): boolean {
  if (prev.mode !== next.mode || prev.color !== next.color || prev.width !== next.width) {
    return false;
  }
  const tail = prev.points[prev.points.length - 1];
  const head = next.points[0];
  return Boolean(tail && head && eqPoint(tail, head));
}

/** Returns a NEW strokes array with `segment` merged into or appended to the list. */
export function appendStrokeSegment(strokes: Stroke[], segment: Stroke): Stroke[] {
  const prev = strokes[strokes.length - 1];
  if (prev && canMergeSegment(prev, segment)) {
    const merged: Stroke = { ...prev, points: [...prev.points, ...segment.points.slice(1)] };
    return [...strokes.slice(0, -1), merged];
  }
  return [...strokes, segment];
}
