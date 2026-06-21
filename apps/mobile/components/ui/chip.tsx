import { type ReactNode } from "react";
import { Pressable } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: ReactNode;
  className?: string;
}

export function Chip({ label, selected = false, onPress, leftIcon, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-3.5 py-2",
        selected ? "border-primary bg-primary" : "border-border bg-card",
        className,
      )}
    >
      {leftIcon}
      <Text
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
