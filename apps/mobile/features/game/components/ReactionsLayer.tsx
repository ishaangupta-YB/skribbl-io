import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
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
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: REACTION_LIFETIME_MS,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.9] });
  const drift = (hashFraction(reaction.id) - 0.5) * 60;
  const leftPct = `${10 + hashFraction(reaction.id) * 70}%` as `${number}%`;

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 80,
        left: leftPct,
        opacity,
        transform: [{ translateY }, { translateX: drift }, { scale }],
      }}
    >
      <Text style={{ fontSize: 34 }}>{reaction.emoji}</Text>
    </Animated.View>
  );
}
