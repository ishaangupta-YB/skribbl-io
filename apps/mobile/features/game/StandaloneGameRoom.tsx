/**
 * A fully self-wired game room using the stub dependencies (stub theme, stub
 * WebSocket connection against the mock, placeholder canvas, no-op
 * haptics/sound). This lets the game flow run end-to-end TODAY, before Agent
 * B's design system and Agent C's canvas/client are merged.
 *
 * When B/C land, mount {@link GameScreen} inside your own
 * `<GameDepsProvider deps={realDeps}>` instead (see README + the handoff doc).
 */
import React, { useMemo } from "react";
import type { Avatar } from "@skribbl/shared";
import { GameScreen } from "./GameScreen";
import { GameDepsProvider } from "./integration/GameDepsContext";
import { createStandaloneGameDeps, stubDarkTheme, stubLightTheme } from "./integration/stub-deps";
import type { GameTheme } from "./integration/contracts";
import type { Identity } from "./state/types";

const GUEST_EMOJIS = ["🦊", "🐼", "🐸", "🐙", "🦄", "🐯", "🐧", "🐵"];
const GUEST_COLORS = ["#6C5CE7", "#EC4899", "#10B981", "#F59E0B", "#3478F6", "#EF4444"];

function randomGuest(): Identity {
  const emoji = GUEST_EMOJIS[Math.floor(Math.random() * GUEST_EMOJIS.length)] as string;
  const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)] as string;
  const avatar: Avatar = { emoji, color };
  return { nickname: `Guest${Math.floor(1000 + Math.random() * 9000)}`, avatar };
}

export function StandaloneGameRoom({
  roomId,
  identity,
  scheme = "dark",
  onLeave,
}: {
  roomId: string;
  identity?: Identity;
  scheme?: "dark" | "light";
  onLeave?: () => void;
}): React.JSX.Element {
  const resolvedIdentity = useMemo(() => identity ?? randomGuest(), [identity]);
  const theme: GameTheme = scheme === "light" ? stubLightTheme : stubDarkTheme;
  const deps = useMemo(
    () => createStandaloneGameDeps(resolvedIdentity, { theme, onLeave }),
    [resolvedIdentity, theme, onLeave],
  );

  return (
    <GameDepsProvider deps={deps}>
      <GameScreen roomId={roomId} />
    </GameDepsProvider>
  );
}
