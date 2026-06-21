import { Skia, type SkPath } from "@shopify/react-native-skia";
import type { Point } from "@skribbl/shared";
import { toPixels, type Size } from "./coords";

/**
 * Builds a smoothed Skia path from NORMALIZED points scaled to the current
 * canvas size. Uses quadratic curves through the midpoints of consecutive
 * points (the classic "smooth freehand" technique) so lines look natural at any
 * resolution. A single point becomes a tiny dot so round caps still render.
 */
export function buildSkiaPath(points: Point[], size: Size): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0 || size.width <= 0 || size.height <= 0) return path;

  const first = toPixels(points[0] as Point, size);
  path.moveTo(first.x, first.y);

  if (points.length === 1) {
    // Nudge so a 1-point stroke renders as a dot under a round cap.
    path.lineTo(first.x + 0.1, first.y);
    return path;
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = toPixels(points[i] as Point, size);
    const next = toPixels(points[i + 1] as Point, size);
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path.quadTo(curr.x, curr.y, midX, midY);
  }

  const last = toPixels(points[points.length - 1] as Point, size);
  path.lineTo(last.x, last.y);
  return path;
}
