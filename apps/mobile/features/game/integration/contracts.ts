/**
 * The interfaces Agent D's game flow consumes from the rest of the app.
 *
 * These are intentionally small and explicit so the game screen stays
 * decoupled: it depends on a THEME (tokens) from Agent B and a CONNECTION +
 * CANVAS from Agent C — injected via {@link GameDeps} (see `GameDepsContext`).
 * Standalone stub implementations live in `stubs.tsx`, so this feature runs and
 * is testable before B's scaffold / C's client are merged. When they land, the
 * host (`app/room/[id].tsx`) supplies real deps with the same shape — see
 * `docs/handoffs/frontend-integration.md`.
 */
import type { ComponentType, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { ConnectionStatus, Identity, RoomSnapshot } from "../state/types";

/* ------------------------------------------------------------------ *
 * Design tokens (from Agent B's theme)
 * ------------------------------------------------------------------ */
export interface GameThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  /** Chat-kind accents. */
  correct: string;
  close: string;
  system: string;
  /** Scrim behind modals/overlays. */
  overlay: string;
}

export interface GameTheme {
  isDark: boolean;
  colors: GameThemeColors;
  /** 4px spacing scale: `spacing(2)` → 8. */
  spacing: (steps: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    weightRegular: "400";
    weightMedium: "600";
    weightBold: "800";
    /** Optional custom families; falls back to system. */
    family?: string;
    familyDisplay?: string;
  };
}

/* ------------------------------------------------------------------ *
 * Realtime connection (from Agent C's `useRoomConnection`)
 * ------------------------------------------------------------------ */

/** Outbound actions the game UI can trigger. Drawing is handled inside the canvas. */
export interface GameActions {
  /** Host: start / restart the game. */
  start(): void;
  /** Drawer: pick one of the offered words during `choosing`. */
  selectWord(word: string): void;
  /** Send a chat line (the server decides if it's a correct guess). */
  sendChat(text: string): void;
  /** Send a floating reaction emoji. */
  react(emoji: string): void;
  /** Leave the room. */
  leave(): void;
}

/**
 * What `useRoomConnection` returns. Agent C may feed the snapshot through Agent
 * B's `useRoomStore`; the host adapter composes that store + C's send helpers
 * into this shape. `snapshot` is the reducer output from `state/gameStore.ts`.
 */
export interface RoomConnection {
  status: ConnectionStatus;
  snapshot: RoomSnapshot;
  actions: GameActions;
}

export type UseRoomConnection = (roomId: string, identity: Identity) => RoomConnection;

/* ------------------------------------------------------------------ *
 * Drawing canvas (from Agent C's `<DrawCanvas/>`)
 * ------------------------------------------------------------------ */
export interface DrawCanvasProps {
  /** True only for the active drawer; otherwise the canvas is view-only. */
  editable: boolean;
  style?: StyleProp<ViewStyle>;
}
export type DrawCanvasComponent = ComponentType<DrawCanvasProps>;

/* ------------------------------------------------------------------ *
 * Feedback (expo-haptics / expo-av) — injected so the pure UI stays portable
 * ------------------------------------------------------------------ */
export interface HapticsApi {
  light(): void;
  medium(): void;
  heavy(): void;
  success(): void;
  warning(): void;
  selection(): void;
}

export type GameSoundName =
  | "join"
  | "turnStart"
  | "guessClose"
  | "guessCorrect"
  | "youGuessed"
  | "tick"
  | "timeUp"
  | "reveal"
  | "win"
  | "react";

export interface SoundApi {
  play(name: GameSoundName): void;
}

/* ------------------------------------------------------------------ *
 * The dependency bundle the game screen needs
 * ------------------------------------------------------------------ */
export interface GameDeps {
  theme: GameTheme;
  useRoomConnection: UseRoomConnection;
  DrawCanvas: DrawCanvasComponent;
  haptics: HapticsApi;
  sound: SoundApi;
  identity: Identity;
  /** Navigate away from the room (router back / home). */
  onLeave?: () => void;
}

export interface GameDepsProviderProps {
  deps: GameDeps;
  children: ReactNode;
}
