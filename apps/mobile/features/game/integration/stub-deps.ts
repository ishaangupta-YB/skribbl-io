/**
 * Non-component dependency stubs for the game feature (themes, haptics, sound,
 * and the bundled `createStandaloneGameDeps` factory). Component/hook stubs
 * live in `stubs.tsx` to keep Fast Refresh happy.
 */
import type { GameTheme, HapticsApi, SoundApi, GameDeps } from "./contracts";
import { StubDrawCanvas, useStubRoomConnection } from "./stubs";
import type { Identity } from "../state/types";

/* ------------------------------------------------------------------ *
 * Theme stub (Agent B owns the real tokens)
 * ------------------------------------------------------------------ */
const sharedFont: GameTheme["font"] = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 34,
  weightRegular: "400",
  weightMedium: "600",
  weightBold: "800",
};

const sharedRadius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };
const spacing = (steps: number): number => steps * 4;

export const stubDarkTheme: GameTheme = {
  isDark: true,
  spacing,
  radius: sharedRadius,
  font: sharedFont,
  colors: {
    background: "#0F1226",
    surface: "#191D3A",
    surfaceAlt: "#222748",
    card: "#1E2342",
    border: "#2E3566",
    text: "#F5F6FF",
    textMuted: "#9AA0C9",
    textInverse: "#0F1226",
    primary: "#6C5CE7",
    primaryText: "#FFFFFF",
    accent: "#00D2D3",
    success: "#2ECC71",
    danger: "#FF6B6B",
    warning: "#FECA57",
    info: "#54A0FF",
    correct: "#2ECC71",
    close: "#FECA57",
    system: "#9AA0C9",
    overlay: "rgba(8, 10, 24, 0.72)",
  },
};

export const stubLightTheme: GameTheme = {
  isDark: false,
  spacing,
  radius: sharedRadius,
  font: sharedFont,
  colors: {
    background: "#F4F5FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EDEFF7",
    card: "#FFFFFF",
    border: "#E2E5F0",
    text: "#1A1D2E",
    textMuted: "#6B708F",
    textInverse: "#FFFFFF",
    primary: "#6C5CE7",
    primaryText: "#FFFFFF",
    accent: "#0FB9B1",
    success: "#15A85A",
    danger: "#E54848",
    warning: "#E89B0C",
    info: "#3478F6",
    correct: "#15A85A",
    close: "#E89B0C",
    system: "#6B708F",
    overlay: "rgba(20, 22, 40, 0.55)",
  },
};

/* ------------------------------------------------------------------ *
 * Haptics / sound stubs (Agent B wires expo-haptics / expo-av)
 * ------------------------------------------------------------------ */
const noopHaptics: HapticsApi = {
  light: () => {},
  medium: () => {},
  heavy: () => {},
  success: () => {},
  warning: () => {},
  selection: () => {},
};

const noopSound: SoundApi = {
  play: (_name) => {},
};

/* ------------------------------------------------------------------ *
 * Bundled standalone deps
 * ------------------------------------------------------------------ */
export function createStandaloneGameDeps(
  identity: Identity,
  options: { theme?: GameTheme; onLeave?: () => void } = {},
): GameDeps {
  return {
    theme: options.theme ?? stubDarkTheme,
    useRoomConnection: useStubRoomConnection,
    DrawCanvas: StubDrawCanvas,
    haptics: noopHaptics,
    sound: noopSound,
    identity,
    onLeave: options.onLeave,
  };
}
