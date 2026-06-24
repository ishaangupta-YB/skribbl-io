import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../integration/GameDepsContext";
import { selectPhase } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";
import { AvatarBubble, Card, Row, Txt } from "./primitives";

/**
 * End-of-turn reveal: shows the answer and the points each player earned this
 * turn. Driven by the `turn:reveal` frame captured in the snapshot.
 */
export function TurnRevealOverlay({ snapshot }: { snapshot: RoomSnapshot }): React.JSX.Element | null {
  const theme = useTheme();
  // Driven by the server-pushed reveal frame, not a local UI event.
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const show = selectPhase(snapshot) === "reveal" && Boolean(snapshot.reveal);
  const pop = useSharedValue(0);

  useEffect(() => {
    if (show) {
      pop.value = 0;
      pop.value = withSpring(1, { damping: 11, stiffness: 150 });
    }
  }, [show, snapshot.reveal?.word, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const overlayStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: theme.spacing(6),
    }),
    [theme],
  );

  if (!show || !snapshot.reveal) return null;

  const earners = snapshot.reveal.scores
    .filter((s) => s.roundPoints > 0)
    .sort((a, b) => b.roundPoints - a.roundPoints);

  return (
    <View pointerEvents="none" style={overlayStyle}>
      <Animated.View style={[{ width: "100%", maxWidth: 420 }, popStyle]}>
        <Card style={{ alignItems: "center", gap: theme.spacing(3) }}>
          <Txt variant="caption" color={theme.colors.textMuted}>
            THE WORD WAS
          </Txt>
          <Txt variant="display" color={theme.colors.correct} weight="800">
            {snapshot.reveal.word}
          </Txt>

          <View style={{ width: "100%", gap: theme.spacing(2) }}>
            {earners.length === 0 ? (
              <Txt variant="caption" color={theme.colors.textMuted} align="center">
                Nobody guessed it 😬
              </Txt>
            ) : (
              earners.map((s) => (
                <Row key={s.playerId} justify="space-between">
                  <Row gap={theme.spacing(2)}>
                    <AvatarBubble emoji={s.avatar.emoji} color={s.avatar.color} size={26} />
                    <Txt variant="body" color={theme.colors.text}>
                      {s.nickname}
                    </Txt>
                  </Row>
                  <Txt variant="body" color={theme.colors.success} weight="800">
                    +{s.roundPoints}
                  </Txt>
                </Row>
              ))
            )}
          </View>
        </Card>
      </Animated.View>
    </View>
  );
}
