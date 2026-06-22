import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/theme";
import { Brand } from "@/components/brand";
import { Skeleton } from "./skeleton";
import { Text } from "./text";

export interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading…" }: LoadingScreenProps) {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center justify-center gap-6 px-8">
      <Brand size="md" />
      <ActivityIndicator color={colors.primary} size="large" />
      <Text className="text-muted-foreground">{message}</Text>
      <View className="w-full max-w-xs gap-3">
        <Skeleton width="75%" height={16} />
        <Skeleton width="50%" height={16} />
      </View>
    </View>
  );
}
