import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  size?: "small" | "large";
  /** Override the indicator color (defaults to the primary token). */
  color?: string;
  className?: string;
}

export function Spinner({ size = "small", color, className }: SpinnerProps) {
  const { colors } = useTheme();
  return (
    <View className={cn("items-center justify-center", className)}>
      <ActivityIndicator size={size} color={color ?? colors.primary} />
    </View>
  );
}
