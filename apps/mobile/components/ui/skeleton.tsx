import { View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  width?: ViewStyle["width"];
  height?: ViewStyle["height"];
  circle?: boolean;
}

export function Skeleton({ className, width, height, circle }: SkeletonProps) {
  const { colors } = useTheme();
  const radius = circle ? (typeof height === "number" ? height / 2 : 999) : 8;
  return (
    <View
      style={{ width, height, backgroundColor: colors.muted, borderRadius: radius }}
      className={cn("opacity-60", className)}
    />
  );
}
