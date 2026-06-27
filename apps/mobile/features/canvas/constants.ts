import { GAME } from "@skribbl/shared";
import type { DrawMode } from "./lib/strokeBatcher";

/** Hum-aligned drawing palette. Values are 6-digit hex to satisfy the contract. */
export const PALETTE: readonly string[] = [
  "#1A1D2A",
  "#7A7664",
  "#C1C1C1",
  "#FCFAF4",
  "#F5D547",
  "#2BA8D8",
  "#E8554F",
  "#5EC891",
  "#B085E0",
  "#F97316",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#92400E",
  "#14532D",
];

export const DEFAULT_COLOR = "#1A1D2A";
export const DEFAULT_BACKGROUND = "#FCFAF4";

/** Brush sizes, kept inside the contract's stroke-width bounds. */
export const BRUSH_SIZES: readonly number[] = [
  GAME.MIN_STROKE_WIDTH + 3, // ~4
  10,
  20,
  Math.min(36, GAME.MAX_STROKE_WIDTH),
];

export const DEFAULT_WIDTH = BRUSH_SIZES[1] ?? 10;
export const DEFAULT_MODE: DrawMode = "draw";
