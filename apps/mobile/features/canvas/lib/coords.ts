import type { Point } from "@skribbl/shared";

/**
 * Coordinate helpers for the drawing board.
 *
 * Strokes travel over the wire in NORMALIZED [0,1] space (see `pointSchema` in
 * the contract) so a drawing made on a phone renders identically on a tablet or
 * the web — this is the fix for the legacy app's device-specific raw dx/dy bug.
 * Convert on the way out (touch px -> 0..1) and on the way in (0..1 -> px).
 */
export interface Size {
  width: number;
  height: number;
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Touch/layout pixels -> normalized [0,1] point, clamped to the canvas. */
export function toNormalized(px: number, py: number, size: Size): Point {
  if (size.width <= 0 || size.height <= 0) return { x: 0, y: 0 };
  return { x: clamp01(px / size.width), y: clamp01(py / size.height) };
}

/** Normalized [0,1] point -> pixels for the given canvas size. */
export function toPixels(point: Point, size: Size): { x: number; y: number } {
  return { x: point.x * size.width, y: point.y * size.height };
}
