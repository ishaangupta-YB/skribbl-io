import React, { useEffect, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const COLORS = ["#6C5CE7", "#00D2D3", "#FECA57", "#FF6B6B", "#2ECC71", "#54A0FF", "#EC4899"];

interface Piece {
  id: string;
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
}

/** A cheap, dependency-free confetti burst for the win screen. */
export function Confetti({ count = 56, active = true }: { count?: number; active?: boolean }): React.JSX.Element | null {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_unused, i): Piece => ({
        id: `confetti-${i}`,
        x: Math.random() * width,
        size: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
        delay: Math.random() * 800,
        duration: 2200 + Math.random() * 1600,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 120,
      })),
    [count, width],
  );

  if (!active) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} piece={p} height={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, height }: { piece: Piece; height: number }): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withRepeat(withTiming(1, { duration: piece.duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [progress, piece.delay, piece.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-40, height + 40]) },
      { translateX: interpolate(progress.value, [0, 1], [0, piece.drift]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, piece.rotate + 360])}deg` },
    ],
  }));

  const style = useMemo(
    () => ({
      position: "absolute" as const,
      left: piece.x,
      width: piece.size,
      height: piece.size * 1.4,
      borderRadius: 2,
      backgroundColor: piece.color,
    }),
    [piece],
  );

  return <Animated.View style={[style, animatedStyle]} />;
}
