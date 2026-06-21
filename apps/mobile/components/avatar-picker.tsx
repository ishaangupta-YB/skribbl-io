import { Pressable, View } from "react-native";
import { Shuffle } from "lucide-react-native";
import type { Avatar as AvatarData } from "@skribbl/shared";
import { AVATAR_COLORS, AVATAR_EMOJIS, useTheme } from "@/theme";
import { randomAvatar } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Avatar, Button, Text } from "@/components/ui";

export interface AvatarPickerProps {
  avatar: AvatarData;
  onChange: (avatar: AvatarData) => void;
  className?: string;
}

export function AvatarPicker({ avatar, onChange, className }: AvatarPickerProps) {
  const { colors } = useTheme();

  return (
    <View className={cn("gap-4", className)}>
      <View className="items-center gap-3">
        <Avatar avatar={avatar} size="xl" />
        <Button
          variant="secondary"
          size="sm"
          label="Randomize"
          leftIcon={<Shuffle size={16} color={colors.foreground} />}
          onPress={() => onChange(randomAvatar())}
        />
      </View>

      <View className="gap-2">
        <Text variant="label">Emoji</Text>
        <View className="flex-row flex-wrap gap-2">
          {AVATAR_EMOJIS.map((emoji) => {
            const selected = emoji === avatar.emoji;
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange({ ...avatar, emoji })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className={cn(
                  "h-11 w-11 items-center justify-center rounded-xl border",
                  selected ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text variant="label">Color</Text>
        <View className="flex-row flex-wrap gap-2.5">
          {AVATAR_COLORS.map((color) => {
            const selected = color === avatar.color;
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Color ${color}`}
                accessibilityState={{ selected }}
                onPress={() => onChange({ ...avatar, color })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  style={{ backgroundColor: color }}
                  className={cn(
                    "h-10 w-10 rounded-full",
                    selected && "border-2 border-foreground",
                  )}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
