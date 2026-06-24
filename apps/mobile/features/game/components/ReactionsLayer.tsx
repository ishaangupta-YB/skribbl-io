import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useActiveReactions, REACTION_LIFETIME_MS } from "../hooks/useActiveReactions";
import type { ReactionEvent } from "../state/types";

/** Floating emoji reactions that drift up and fade out over the canvas. */
export function ReactionsLayer({ reactions }: { reactions: ReactionEvent[] }): React.JSX.Element {
  const active = useActiveReactions(reactions);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {active.map((r) => (
        <ReactionBubble key={r.id} reaction={r} />
      ))}
    </View>
  );
}

function hashFraction(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

function ReactionBubble({ reaction }: { reaction: ReactionEvent }): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: REACTION_LIFETIME_MS });
  }, [progress]);

  const drift = (hashFraction(reaction.id) - 0.5) * 60;
  const leftPct = `${10 + hashFraction(reaction.id) * 70}%` as `${number}%`;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -180]) },
      { translateX: drift },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.4, 1.2, 0.9]) },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute", bottom: 80, left: leftPct }, animatedStyle]}>
      <Text style={{ fontSize: 34 }}>{reaction.emoji}</Text>
    </Animated.View>
  );
}
