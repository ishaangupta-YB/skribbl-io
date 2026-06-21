import { type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { IconButton, Text } from "@/components/ui";

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  /** Show a back button (defaults to true). */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  back = true,
  onBack,
  right,
  className,
}: AppHeaderProps) {
  const { colors } = useTheme();
  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View className={cn("h-12 flex-row items-center gap-2", className)}>
      {back ? (
        <IconButton variant="secondary" size="sm" onPress={handleBack} accessibilityLabel="Go back">
          <ChevronLeft size={20} color={colors.foreground} />
        </IconButton>
      ) : null}
      <View className="flex-1">
        {title ? <Text variant="subtitle" numberOfLines={1}>{title}</Text> : null}
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
