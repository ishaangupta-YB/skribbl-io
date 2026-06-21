/**
 * The in-game screen mounted by `app/room/[id].tsx`. It is driven entirely by
 * the server frames folded into the reducer snapshot — choose → draw → guess →
 * reveal → leaderboard — and routes its layout by `phase`.
 *
 * It consumes its dependencies (theme, connection, canvas, haptics, sound,
 * identity) from {@link GameDepsProvider}; see `features/game/README.md`.
 */
import React, { useCallback } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import { useGameDeps, useRoomConnectionFactory, useTheme } from "./integration/GameDepsContext";
import { useCountdown } from "./hooks/useCountdown";
import { useTurnFx } from "./hooks/useTurnFx";
import { selectPhase } from "./state/selectors";
import { CanvasStage } from "./components/CanvasStage";
import { ChatPanel } from "./components/ChatPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { GameHeader } from "./components/GameHeader";
import { GameOverScreen } from "./components/GameOverScreen";
import { LobbyView } from "./components/LobbyView";
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
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", gap: theme.spacing(3) }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Txt variant="caption" color={theme.colors.textMuted}>
          {status === "reconnecting" ? "Reconnecting…" : "Joining room…"}
        </Txt>
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
