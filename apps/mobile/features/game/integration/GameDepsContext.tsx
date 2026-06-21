/**
 * React context carrying the injected {@link GameDeps}. Game components read
 * deps through `useGameDeps()` / the focused hooks below, so they never import
 * Agent B's or Agent C's modules directly.
 */
import React, { createContext, useContext, useMemo } from "react";
import type {
  DrawCanvasComponent,
  GameDeps,
  GameDepsProviderProps,
  GameTheme,
  HapticsApi,
  SoundApi,
  UseRoomConnection,
} from "./contracts";

const GameDepsContext = createContext<GameDeps | null>(null);

export function GameDepsProvider({ deps, children }: GameDepsProviderProps): React.JSX.Element {
  return <GameDepsContext.Provider value={deps}>{children}</GameDepsContext.Provider>;
}

export function useGameDeps(): GameDeps {
  const deps = useContext(GameDepsContext);
  if (!deps) {
    throw new Error("useGameDeps must be used within a <GameDepsProvider>. See features/game/README.md.");
  }
  return deps;
}

export function useTheme(): GameTheme {
  return useGameDeps().theme;
}

export function useHaptics(): HapticsApi {
  return useGameDeps().haptics;
}

export function useSound(): SoundApi {
  return useGameDeps().sound;
}

export function useDrawCanvas(): DrawCanvasComponent {
  return useGameDeps().DrawCanvas;
}

export function useRoomConnectionFactory(): UseRoomConnection {
  return useGameDeps().useRoomConnection;
}

/** Memoized helper for components that build StyleSheets from theme tokens. */
export function useThemedStyles<T>(factory: (theme: GameTheme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
