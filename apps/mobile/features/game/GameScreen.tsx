/**
 * The in-game screen mounted by `app/room/[id].tsx`. It is driven entirely by
 * the server frames folded into the reducer snapshot — choose → draw → guess →
 * reveal → leaderboard — and routes its layout by `phase`.
 *
 * It consumes its dependencies (theme, connection, canvas, haptics, sound,
 * identity) from {@link GameDepsProvider}; see `features/game/README.md`.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { LoadingScreen } from "@/components/ui";
import { useGameDeps, useRoomConnectionFactory, useTheme } from "./integration/GameDepsContext";
import { useCountdown } from "./hooks/useCountdown";
import { useTurnFx } from "./hooks/useTurnFx";
import { selectPhase } from "./state/selectors";
import type { RoomError } from "./state/types";
import type { GameTheme } from "./integration/contracts";
import { CanvasStage } from "./components/CanvasStage";
import { ChatPanel } from "./components/ChatPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { GameHeader } from "./components/GameHeader";
import { GameOverScreen } from "./components/GameOverScreen";
import { LobbyView } from "./components/LobbyView";
import { PhaseAnnounce } from "./components/PhaseAnnounce";
import { ReactionBar } from "./components/ReactionBar";
import { Scoreboard } from "./components/Scoreboard";
import { Txt } from "./components/primitives";
import { WordBanner } from "./components/WordBanner";
import { WordChoiceModal } from "./components/WordChoiceModal";

const WIDE_BREAKPOINT = 820;

export function GameScreen({ roomId }: { roomId: string }): React.JSX.Element {
  const theme = useTheme();
  const deps = useGameDeps();
  const useRoomConnection = useRoomConnectionFactory();
  const { status, snapshot, actions } = useRoomConnection(roomId, deps.identity);

  const countdown = useCountdown(snapshot);
  useTurnFx(snapshot, countdown.secondsLeft);

  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const phase = selectPhase(snapshot);

  const leave = useCallback(() => {
    actions.leave();
    deps.onLeave?.();
  }, [actions, deps]);

  // Still establishing the first snapshot.
  if (!snapshot.room) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingScreen message={status === "reconnecting" ? "Reconnecting…" : "Joining room…"} />
      </View>
    );
  }

  if (phase === "lobby") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ConnectionBanner status={status} />
        <LobbyView snapshot={snapshot} onStart={actions.start} onLeave={leave} />
      </View>
    );
  }

  if (phase === "game-over") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ConnectionBanner status={status} />
        <GameOverScreen snapshot={snapshot} onPlayAgain={actions.start} onLeave={leave} />
      </View>
    );
  }

  // Active turn (choosing / drawing / reveal).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ConnectionBanner status={status} />
      <GameHeader snapshot={snapshot} countdown={countdown} onLeave={leave} />
      <PhaseAnnounce snapshot={snapshot} />
      {snapshot.error ? <ErrorBanner key={snapshot.error.at} error={snapshot.error} theme={theme} /> : null}

      {wide ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 3 }}>
            <WordBanner snapshot={snapshot} />
            <CanvasStage snapshot={snapshot} />
            <ReactionBar onReact={actions.react} />
          </View>
          <View style={{ flex: 2, borderLeftWidth: 1, borderLeftColor: theme.colors.border }}>
            <View style={{ padding: theme.spacing(3) }}>
              <Scoreboard snapshot={snapshot} variant="list" />
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              <ChatPanel snapshot={snapshot} onSendChat={actions.sendChat} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Scoreboard snapshot={snapshot} variant="strip" />
          <WordBanner snapshot={snapshot} />
          <View style={{ flex: 1.3 }}>
            <CanvasStage snapshot={snapshot} />
          </View>
          <ReactionBar onReact={actions.react} />
          <View style={{ flex: 1 }}>
            <ChatPanel snapshot={snapshot} onSendChat={actions.sendChat} />
          </View>
        </View>
      )}

      <WordChoiceModal snapshot={snapshot} countdown={countdown} onSelectWord={actions.selectWord} />
    </View>
  );
}

function ErrorBanner({ error, theme }: { error: RoomError; theme: GameTheme }): React.JSX.Element | null {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.danger,
        marginHorizontal: theme.spacing(4),
        marginTop: theme.spacing(2),
        padding: theme.spacing(3),
        borderRadius: theme.radius.md,
      }}
    >
      <Txt variant="caption" color={theme.colors.textInverse} weight="800">
        {error.message}
      </Txt>
    </View>
  );
}
