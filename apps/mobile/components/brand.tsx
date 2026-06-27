import { View } from "react-native";
import { Palette } from "lucide-react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui";

export interface BrandProps {
  size?: "md" | "lg";
  className?: string;
}

export function Brand({ size = "lg", className }: BrandProps) {
  const { colors } = useTheme();
  const iconSize = size === "lg" ? 34 : 24;
  return (
    <View className={cn("flex-row items-center gap-2.5", className)}>
      <View
        className={cn(
          "items-center justify-center rounded-2xl bg-primary shadow-card",
          size === "lg" ? "h-14 w-14" : "h-10 w-10",
        )}
      >
        <Palette size={iconSize} color={colors.primaryForeground} />
      </View>
      <View>
        <Text className={cn("font-bold tracking-tight text-foreground", size === "lg" ? "text-3xl" : "text-xl")}>
          Skribbl
        </Text>
        <Text className={cn("-mt-1 font-bold tracking-tight text-primary", size === "lg" ? "text-3xl" : "text-xl")}>
          Cloud
        </Text>
      </View>
    </View>
  );
}
