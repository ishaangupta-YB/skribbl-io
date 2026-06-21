/**
 * Runtime color tokens.
 *
 * Most styling uses NativeWind `className`s backed by the CSS variables in
 * `global.css`. These hex mirrors exist for the places that can't use classes:
 * the Skia canvas (Agent C), the status bar, the React Navigation theme, and
 * gradient/shadow values. Keep these in sync with `global.css` / `tailwind.config.js`.
 */
export type ColorScheme = "light" | "dark";

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  input: string;
  ring: string;
}

export const lightColors: ThemeColors = {
  background: "#FBFBFE",
  foreground: "#14162E",
  card: "#FFFFFF",
  cardForeground: "#14162E",
  primary: "#5B5BD6",
  primaryForeground: "#FFFFFF",
  secondary: "#F1F1FA",
  secondaryForeground: "#2A2C4A",
  accent: "#EC4899",
  accentForeground: "#FFFFFF",
  muted: "#EFEFF6",
  mutedForeground: "#6B6E84",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",
  border: "#E3E3EE",
  input: "#E3E3EE",
  ring: "#5B5BD6",
};

export const darkColors: ThemeColors = {
  background: "#0B1020",
  foreground: "#ECEEF7",
  card: "#141A2E",
  cardForeground: "#ECEEF7",
  primary: "#8B8BF0",
  primaryForeground: "#0B1020",
  secondary: "#1E2740",
  secondaryForeground: "#ECEEF7",
  accent: "#F472B6",
  accentForeground: "#0B1020",
  muted: "#1E2740",
  mutedForeground: "#9AA0B8",
  success: "#22C55E",
  warning: "#FBBF24",
  danger: "#F87171",
  border: "#28304D",
  input: "#28304D",
  ring: "#8B8BF0",
};

export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** Vivid brush colors offered by the drawing canvas (Agent C). */
export const DRAW_PALETTE: readonly string[] = [
  "#000000",
  "#6B7280",
  "#FFFFFF",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#EC4899",
  "#F43F5E",
  "#78350F",
];

/** Curated avatar background colors (must be 6-digit hex per `avatarSchema`). */
export const AVATAR_COLORS: readonly string[] = [
  "#5B5BD6",
  "#7C3AED",
  "#EC4899",
  "#F43F5E",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#0EA5E9",
];
