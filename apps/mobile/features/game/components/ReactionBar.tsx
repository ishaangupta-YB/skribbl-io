import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useHaptics, useTheme } from "../integration/GameDepsContext";

export const REACTION_EMOJIS = ["👍", "😂", "❤️", "😮", "🔥", "🎉"];
const EXTRA_EMOJIS = ["👏", "🙌", "🤯", "😭", "😡", "👻", "🦄", "🌈", "✨", "💯", "🎯", "🍀"];

/** A compact rail of emoji buttons that send `react` frames, plus an expandable quick picker. */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }): React.JSX.Element {
  const theme = useTheme();
  const haptics = useHaptics();
  const [expanded, setExpanded] = useState(false);

  const send = (emoji: string) => {
    haptics.light();
    onReact(emoji);
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}
    >
      {expanded ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            paddingHorizontal: theme.spacing(3),
            paddingTop: theme.spacing(2),
            gap: theme.spacing(2),
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <EmojiButton key={emoji} emoji={emoji} onPress={() => send(emoji)} theme={theme} />
          ))}
          {EXTRA_EMOJIS.map((emoji) => (
            <EmojiButton key={emoji} emoji={emoji} onPress={() => send(emoji)} theme={theme} />
          ))}
          <EmojiButton emoji="−" onPress={() => setExpanded(false)} theme={theme} />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: theme.spacing(2),
          paddingHorizontal: theme.spacing(3),
          paddingVertical: theme.spacing(2),
          justifyContent: "center",
        }}
      >
        {REACTION_EMOJIS.slice(0, 6).map((emoji) => (
          <EmojiButton key={emoji} emoji={emoji} onPress={() => send(emoji)} theme={theme} />
        ))}
        <EmojiButton emoji="+" onPress={() => setExpanded(true)} theme={theme} />
      </View>
    </View>
  );
}

function EmojiButton({
  emoji,
  onPress,
  theme,
}: {
  emoji: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`React ${emoji}`}
      hitSlop={6}
      onPress={onPress}
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
  );
}
