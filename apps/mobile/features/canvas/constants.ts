import { GAME } from "@skribbl/shared";
import type { DrawMode } from "./lib/strokeBatcher";

/** Default skribbl-style palette. Values are 6-digit hex to satisfy the contract. */
export const PALETTE: readonly string[] = [
  "#000000",
  "#7F7F7F",
  "#C1C1C1",
  "#FFFFFF",
  "#EF4444",
  "#F97316",
  "#FACC15",
  "#22C55E",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#92400E",
  "#14532D",
  "#1E3A8A",
];

export const DEFAULT_COLOR = "#000000";
export const DEFAULT_BACKGROUND = "#FFFFFF";

/** Brush sizes, kept inside the contract's stroke-width bounds. */
export const BRUSH_SIZES: readonly number[] = [
  GAME.MIN_STROKE_WIDTH + 3, // ~4
  10,
  20,
  Math.min(36, GAME.MAX_STROKE_WIDTH),
];

export const DEFAULT_WIDTH = BRUSH_SIZES[1] ?? 10;
export const DEFAULT_MODE: DrawMode = "draw";
