import { Minus, Plus } from "lucide-react-native";
import { View } from "react-native";
import { useTheme } from "@/theme";
import { clamp } from "@skribbl/shared";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";
import { Text } from "./text";

export interface StepperProps {
  label?: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Custom display for the value (e.g. `${v}s`). */
  format?: (value: number) => string;
  className?: string;
}

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  className,
}: StepperProps) {
  const { colors } = useTheme();
  const set = (next: number) => onChange(Math.round(clamp(next, min, max)));

  return (
    <View className={cn("flex-row items-center justify-between", className)}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View className="flex-row items-center gap-3">
        <IconButton
          variant="secondary"
          size="sm"
          disabled={value <= min}
          onPress={() => set(value - step)}
          accessibilityLabel={`Decrease ${label ?? "value"}`}
        >
          <Minus size={18} color={colors.foreground} />
        </IconButton>
        <Text className="min-w-12 text-center text-base font-bold text-foreground">
          {format ? format(value) : value}
        </Text>
        <IconButton
          variant="secondary"
          size="sm"
          disabled={value >= max}
          onPress={() => set(value + step)}
          accessibilityLabel={`Increase ${label ?? "value"}`}
        >
          <Plus size={18} color={colors.foreground} />
        </IconButton>
      </View>
    </View>
  );
}
