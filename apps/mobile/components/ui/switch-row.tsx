import { Switch, View } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  className?: string;
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  className,
}: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View className={cn("flex-row items-center justify-between gap-4", className)}>
      <View className="flex-1">
        <Text variant="label">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.input, true: colors.primary }}
        thumbColor={colors.card}
        ios_backgroundColor={colors.input}
      />
    </View>
  );
}
