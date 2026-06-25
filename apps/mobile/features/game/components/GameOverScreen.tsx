import React, { useEffect } from "react";
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { ScoreEntry } from "@skribbl/shared";
import { useTheme } from "../integration/GameDepsContext";
import { selectCanStart } from "../state/selectors";
import type { GameTheme } from "../integration/contracts";
import type { RoomSnapshot } from "../state/types";
import { AvatarBubble, Button, Card, Row, Txt } from "./primitives";
import { Confetti } from "./Confetti";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Final leaderboard with a winner highlight + confetti. The host can start a
 * new game; everyone can leave.
 */
export function GameOverScreen({
  snapshot,
  onPlayAgain,
  onLeave,
}: {
  snapshot: RoomSnapshot;
  onPlayAgain: () => void;
  onLeave: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const leaderboard = snapshot.gameOver?.leaderboard ?? snapshot.scores;
  const winner = leaderboard[0];
  const canStart = selectCanStart(snapshot);
  const youWon = winner?.playerId === snapshot.youId;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Confetti active />
      <ScrollView contentContainerStyle={{ padding: theme.spacing(6), gap: theme.spacing(5), alignItems: "center" }}>
        <Txt variant="caption" color={theme.colors.textMuted} testID="game-over-title">
          GAME OVER
        </Txt>

        {winner ? <WinnerCard winner={winner} youWon={youWon} theme={theme} /> : null}

        <Card style={{ width: "100%", maxWidth: 440, gap: theme.spacing(2) }} testID="game-over-leaderboard">
          {leaderboard.map((entry, i) => (
            <Row key={entry.playerId} justify="space-between" style={{ paddingVertical: theme.spacing(1) }}>
              <Row gap={theme.spacing(3)}>
                <Txt variant="subtitle" style={{ width: 30 }}>
                  {MEDALS[i] ?? `${i + 1}`}
                </Txt>
                <AvatarBubble emoji={entry.avatar.emoji} color={entry.avatar.color} size={34} />
                <Txt variant="body" weight="600" color={theme.colors.text}>
                  {entry.nickname}
                  {entry.playerId === snapshot.youId ? " (you)" : ""}
                </Txt>
              </Row>
              <Txt variant="subtitle" weight="800" color={theme.colors.text}>
                {entry.score}
              </Txt>
            </Row>
          ))}
        </Card>

        <View style={{ width: "100%", maxWidth: 440, gap: theme.spacing(3) }}>
          {canStart ? (
            <Button label="Play again" variant="primary" fullWidth onPress={onPlayAgain} />
          ) : (
            <Txt variant="caption" color={theme.colors.textMuted} align="center">
              Waiting for the host to start a new game…
            </Txt>
          )}
          <Button label="Leave" variant="ghost" fullWidth onPress={onLeave} />
        </View>
      </ScrollView>
    </View>
  );
}

function WinnerCard({
  winner,
  youWon,
  theme,
}: {
  winner: ScoreEntry;
  youWon: boolean;
  theme: GameTheme;
}): React.JSX.Element {
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 130 });
  }, [scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ alignItems: "center", gap: theme.spacing(2) }, animatedStyle]}>
      <AvatarBubble emoji={winner.avatar.emoji} color={winner.avatar.color} size={96} ring={theme.colors.warning} />
      <Txt variant="display" weight="800" color={theme.colors.warning} align="center">
        {youWon ? "You win! 🎉" : `${winner.nickname} wins!`}
      </Txt>
      <Txt variant="subtitle" color={theme.colors.textMuted}>
        {winner.score} points
      </Txt>
    </Animated.View>
  );
}
