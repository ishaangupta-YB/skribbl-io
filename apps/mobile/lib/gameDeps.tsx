/**
 * Host-side wiring that turns Agent B's theme + Agent C's realtime client/canvas
 * into the {@link GameDeps} bundle Agent D's `<GameScreen/>` consumes. This is the
 * real-app counterpart to `features/game/integration/stubs.tsx`; the room route
 * (`app/room/[id].tsx`) builds deps from here. See `docs/handoffs/frontend-integration.md`.
 *
 * Note: C's `useRoomConnection` drives C's `useRoomStore` (canvas strokes + draw
 * gating). We additionally fold the SAME connection's frames through D's reducer to
 * produce the `RoomSnapshot` D's UI renders, and publish the live connection to the
 * canvas via a small zustand bridge (one room is active at a time).
 */
import React, { useEffect, useMemo, useState } from "react";
import type { ViewStyle } from "react-native";
import { create } from "zustand";
import { DrawingBoard } from "@/features/canvas";
import {
  applyServerMessage,
  createInitialSnapshot,
  GameDepsProvider,
} from "@/features/game";
import type {
  DrawCanvasProps,
  GameActions,
  GameDeps,
  GameTheme,
  Identity,
  RoomSnapshot,
  UseRoomConnection,
} from "@/features/game";
import { useGameHaptics } from "@/lib/haptics";
import { RoomConnection, useRoomConnection as useClientConnection } from "@/lib/realtime";
import { useIdentity } from "@/lib/store";
import { useGameSound } from "@/lib/sound";
import { useTheme } from "@/theme";

/* ------------------------------------------------------------------ *
 * Connection bridge — shares the live socket from the game's
 * `useRoomConnection` adapter down to the injected `<DrawCanvas/>`.
 * ------------------------------------------------------------------ */
interface ConnectionBridge {
  connection: RoomConnection | null;
  setConnection: (connection: RoomConnection | null) => void;
}

const useConnectionBridge = create<ConnectionBridge>((set) => ({
  connection: null,
  setConnection: (connection) => set({ connection }),
}));

/* ------------------------------------------------------------------ *
 * Theme adapter — map Agent B's `useTheme()` tokens onto D's `GameTheme`.
 * ------------------------------------------------------------------ */
function useGameTheme(): GameTheme {
  const { colors, isDark } = useTheme();
  return useMemo<GameTheme>(
    () => ({
      isDark,
      spacing: (steps: number) => steps * 4,
      radius: { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 },
      font: {
        xs: 11,
        sm: 13,
        md: 15,
        lg: 18,
        xl: 24,
        xxl: 34,
        weightRegular: "400",
        weightMedium: "600",
        weightBold: "800",
      },
      colors: {
        background: colors.background,
        surface: colors.card,
        surfaceAlt: colors.muted,
        card: colors.card,
        border: colors.border,
        text: colors.foreground,
        textMuted: colors.mutedForeground,
        textInverse: "#FFFFFF",
        primary: colors.primary,
        primaryText: colors.primaryForeground,
        accent: colors.accent,
        success: colors.success,
        danger: colors.danger,
        warning: colors.warning,
        info: colors.primary,
        correct: colors.success,
        close: colors.warning,
        system: colors.mutedForeground,
        overlay: isDark ? "rgba(4, 6, 16, 0.72)" : "rgba(20, 22, 40, 0.5)",
      },
    }),
    [colors, isDark],
  );
}

/* ------------------------------------------------------------------ *
 * Connection adapter — C's client → D's `{ status, snapshot, actions }`.
 * ------------------------------------------------------------------ */
const useRealRoomConnection: UseRoomConnection = (roomId, identity) => {
  // Drives C's store (canvas strokes + `selectCanDraw`) and owns the socket.
  const client = useClientConnection(roomId, identity);
  const setConnection = useConnectionBridge((s) => s.setConnection);
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => createInitialSnapshot());
  const [prevConnection, setPrevConnection] = useState<RoomConnection | null>(null);

  const { connection, start, selectWord, sendChat, react, leave } = client;

  // Reset snapshot whenever the connection instance changes (recommended pattern for
  // derived state from a prop, not inside an effect).
  if (connection !== prevConnection) {
    setPrevConnection(connection);
    setSnapshot({ ...createInitialSnapshot(), status: connection?.status ?? "connecting" });
  }

  // Fold server messages into the snapshot. Keep the listener effect separate so it
  // never triggers a cascading reset-and-apply sequence.
  useEffect(() => {
    setConnection(connection);
    if (!connection) return;
    const offMessage = connection.on("message", (message) => {
      setSnapshot((prev) => applyServerMessage(prev, message));
    });
    const offStatus = connection.on("status", (status) => {
      setSnapshot((prev) => ({ ...prev, status }));
    });
    return () => {
      offMessage();
      offStatus();
    };
  }, [connection, setConnection]);

  const actions = useMemo<GameActions>(
    () => ({
      start: () => void start(),
      selectWord: (word: string) => void selectWord(word),
      sendChat: (text: string) => void sendChat(text),
      react: (emoji: string) => void react(emoji),
      leave: () => void leave(),
    }),
    [start, selectWord, sendChat, react, leave],
  );

  return { status: client.status, snapshot, actions };
};

/* ------------------------------------------------------------------ *
 * Canvas adapter — C's `<DrawingBoard/>` bound to the shared connection.
 * ------------------------------------------------------------------ */
function RealDrawCanvas({ editable, style }: DrawCanvasProps): React.JSX.Element {
  const connection = useConnectionBridge((s) => s.connection);
  return <DrawingBoard connection={connection} showToolbar={editable} style={style as ViewStyle} />;
}

/* ------------------------------------------------------------------ *
 * Public: build the real GameDeps for the room route.
 * ------------------------------------------------------------------ */
export function useRealGameDeps(options: { onLeave?: () => void } = {}): GameDeps {
  const theme = useGameTheme();
  const haptics = useGameHaptics();
  const sound = useGameSound();
  const nickname = useIdentity((s) => s.nickname);
  const avatar = useIdentity((s) => s.avatar);
  const { onLeave } = options;

  const identity = useMemo<Identity>(
    () => ({ nickname, avatar }),
    [nickname, avatar],
  );

  return useMemo<GameDeps>(
    () => ({
      theme,
      identity,
      useRoomConnection: useRealRoomConnection,
      DrawCanvas: RealDrawCanvas,
      haptics,
      sound,
      onLeave,
    }),
    [theme, identity, haptics, sound, onLeave],
  );
}

export { GameDepsProvider };
