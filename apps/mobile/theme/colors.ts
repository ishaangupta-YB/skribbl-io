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
  background: "#F8F6EE",
  foreground: "#1A1D2A",
  card: "#FCFAF4",
  cardForeground: "#1A1D2A",
  primary: "#F5D547",
  primaryForeground: "#1A1D2A",
  secondary: "#F0EDDF",
  secondaryForeground: "#2A2C37",
  accent: "#2BA8D8",
  accentForeground: "#FFFFFF",
  muted: "#F0EDDF",
  mutedForeground: "#7A7664",
  success: "#5EC891",
  warning: "#E8554F",
  danger: "#E8554F",
  border: "#E8E4D0",
  input: "#E8E4D0",
  ring: "#F5D547",
};

export const darkColors: ThemeColors = {
  background: "#232321",
  foreground: "#EDE9DC",
  card: "#2C2B28",
  cardForeground: "#EDE9DC",
  primary: "#E8C93A",
  primaryForeground: "#232321",
  secondary: "#353330",
  secondaryForeground: "#EDE9DC",
  accent: "#3A9BD0",
  accentForeground: "#FFFFFF",
  muted: "#353330",
  mutedForeground: "#A8A291",
  success: "#52B580",
  warning: "#D94B45",
  danger: "#D94B45",
  border: "#43403A",
  input: "#43403A",
  ring: "#E8C93A",
};

export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** Vivid brush colors offered by the drawing canvas — Hum-aligned ordering. */
export const DRAW_PALETTE: readonly string[] = [
  "#1A1D2A",
  "#7A7664",
  "#FCFAF4",
  "#F5D547",
  "#2BA8D8",
  "#E8554F",
  "#5EC891",
  "#B085E0",
  "#F97316",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#78350F",
];

/** Curated avatar background colors — Hum accent palette (6-digit hex per `avatarSchema`). */
export const AVATAR_COLORS: readonly string[] = [
  "#F5D547",
  "#2BA8D8",
  "#E8554F",
  "#5EC891",
  "#B085E0",
  "#F97316",
  "#3B82F6",
  "#EC4899",
  "#22C55E",
  "#06B6D4",
  "#8B5CF6",
  "#EAB308",
];
