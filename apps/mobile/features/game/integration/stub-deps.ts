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
  weightBold: "700",
};

const sharedRadius = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 };
const spacing = (steps: number): number => steps * 4;

export const stubDarkTheme: GameTheme = {
  isDark: true,
  spacing,
  radius: sharedRadius,
  font: sharedFont,
  colors: {
    background: "#232321",
    surface: "#2C2B28",
    surfaceAlt: "#353330",
    card: "#2C2B28",
    border: "#43403A",
    text: "#EDE9DC",
    textMuted: "#A8A291",
    textInverse: "#232321",
    primary: "#E8C93A",
    primaryText: "#232321",
    accent: "#3A9BD0",
    success: "#52B580",
    danger: "#D94B45",
    warning: "#D94B45",
    info: "#E8C93A",
    correct: "#52B580",
    close: "#D94B45",
    system: "#A8A291",
    overlay: "rgba(35, 35, 33, 0.72)",
  },
};

export const stubLightTheme: GameTheme = {
  isDark: false,
  spacing,
  radius: sharedRadius,
  font: sharedFont,
  colors: {
    background: "#F8F6EE",
    surface: "#FCFAF4",
    surfaceAlt: "#F0EDDF",
    card: "#FCFAF4",
    border: "#E8E4D0",
    text: "#1A1D2A",
    textMuted: "#7A7664",
    textInverse: "#FFFFFF",
    primary: "#F5D547",
    primaryText: "#1A1D2A",
    accent: "#2BA8D8",
    success: "#5EC891",
    danger: "#E8554F",
    warning: "#E8554F",
    info: "#F5D547",
    correct: "#5EC891",
    close: "#E8554F",
    system: "#7A7664",
    overlay: "rgba(26, 29, 42, 0.5)",
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
