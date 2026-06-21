import React from "react";
import { Pressable, Text, View } from "react-native";
import { useHaptics, useTheme } from "../integration/GameDepsContext";

export const REACTION_EMOJIS = ["👍", "😂", "❤️", "😮", "🔥", "🎉"];

/** A compact rail of emoji buttons that send `react` frames. */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }): React.JSX.Element {
  const theme = useTheme();
  const haptics = useHaptics();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing(2),
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(2),
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        justifyContent: "center",
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
          hitSlop={6}
          onPress={() => {
            haptics.light();
            onReact(emoji);
          }}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surfaceAlt,
            opacity: pressed ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}
