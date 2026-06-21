import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
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
  const show = selectPhase(snapshot) === "reveal" && Boolean(snapshot.reveal);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
    }
  }, [show, snapshot.reveal?.word, pop]);

  if (!show || !snapshot.reveal) return null;

  const earners = snapshot.reveal.scores
    .filter((s) => s.roundPoints > 0)
    .sort((a, b) => b.roundPoints - a.roundPoints);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.overlay,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(6),
      }}
    >
      <Animated.View style={{ transform: [{ scale: pop }], width: "100%", maxWidth: 420 }}>
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
