import { Text as RNText, View } from "react-native";
import type { Avatar as AvatarData } from "@skribbl/shared";
import { cn } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const DIMENSION: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 72,
  xl: 104,
};

export interface AvatarProps {
  avatar: AvatarData;
  size?: AvatarSize;
  /** Adds a soft ring around the avatar (e.g. the active drawer). */
  ring?: boolean;
  /** Shows a crown for the room host. */
  isHost?: boolean;
  /** Dims the avatar when the player is disconnected. */
  dimmed?: boolean;
  className?: string;
}

export function Avatar({
  avatar,
  size = "md",
  ring = false,
  isHost = false,
  dimmed = false,
  className,
}: AvatarProps) {
  const dimension = DIMENSION[size];
  return (
    <View style={{ width: dimension, height: dimension }} className={cn("relative", className)}>
      <View
        style={{ backgroundColor: avatar.color, borderRadius: dimension / 2 }}
        className={cn(
          "h-full w-full items-center justify-center",
          ring && "border-2 border-primary",
          dimmed && "opacity-40",
        )}
      >
        <RNText style={{ fontSize: dimension * 0.5 }}>{avatar.emoji}</RNText>
      </View>
      {isHost ? (
        <View
          className="absolute -right-1 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-warning"
          style={{ transform: [{ rotate: "18deg" }] }}
        >
          <RNText style={{ fontSize: 12 }}>👑</RNText>
        </View>
      ) : null}
    </View>
  );
}
