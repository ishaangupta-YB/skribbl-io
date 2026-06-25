import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../integration/GameDepsContext";
import { selectDrawer, selectMustChooseWord, selectPhase } from "../state/selectors";
import type { Countdown, RoomSnapshot } from "../state/types";
import { AvatarBubble, Button, Card, Row, Txt } from "./primitives";

/**
 * Full-screen overlay during the `choosing` phase. The drawer picks one of the
 * three offered words; everyone else sees a "{drawer} is choosing…" state.
 */
export function WordChoiceModal({
  snapshot,
  countdown,
  onSelectWord,
}: {
  snapshot: RoomSnapshot;
  countdown: Countdown;
  onSelectWord: (word: string) => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const fade = useSharedValue(0);
  const isChoosing = selectPhase(snapshot) === "choosing";

  useEffect(() => {
    fade.value = withTiming(isChoosing ? 1 : 0, { duration: 180 });
  }, [isChoosing, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
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

  if (!isChoosing) return null;

  const mustChoose = selectMustChooseWord(snapshot);
  const drawer = selectDrawer(snapshot);

  return (
    <Animated.View pointerEvents={isChoosing ? "auto" : "none"} style={[overlayStyle, fadeStyle]}>
      <Card style={{ width: "100%", maxWidth: 420, alignItems: "center", gap: theme.spacing(4) }}>
        {countdown.active ? (
          <Badge2 seconds={countdown.secondsLeft} color={theme.colors.accent} />
        ) : null}

        {mustChoose ? (
          <>
            <Txt variant="title" align="center">
              Choose a word to draw
            </Txt>
            <View style={{ width: "100%", gap: theme.spacing(3) }}>
              {(snapshot.choices ?? []).map((word) => (
                <Button
                  key={word}
                  label={word}
                  variant="primary"
                  fullWidth
                  onPress={() => onSelectWord(word)}
                  testID={`word-choice-${word}`}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            {drawer ? (
              <AvatarBubble emoji={drawer.avatar.emoji} color={drawer.avatar.color} size={64} ring={theme.colors.accent} />
            ) : null}
            <Txt variant="subtitle" align="center">
              {drawer ? `${drawer.nickname} is choosing a word…` : "Choosing a word…"}
            </Txt>
            <Row gap={6}>
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </Row>
          </>
        )}
      </Card>
    </Animated.View>
  );
}

function Badge2({ seconds, color }: { seconds: number; color: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 3,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt variant="subtitle" color={theme.colors.text} weight="800">
        {seconds}
      </Txt>
    </View>
  );
}

function Dot({ delay }: { delay: number }): React.JSX.Element {
  const theme = useTheme();
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(v);
  }, [v, delay]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }, animatedStyle]}
    />
  );
}
