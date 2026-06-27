import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export type BadgeVariant =
  | "default"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const CONTAINER: Record<BadgeVariant, string> = {
  default: "bg-muted",
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-coral",
  danger: "bg-coral",
  outline: "border border-border bg-transparent",
};

const LABEL: Record<BadgeVariant, string> = {
  default: "text-muted-foreground",
  primary: "text-primary-foreground",
  accent: "text-accent-foreground",
  success: "text-success-foreground",
  warning: "text-coral-foreground",
  danger: "text-coral-foreground",
  outline: "text-foreground",
};

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = "default", className }: BadgeProps) {
  return (
    <View
      className={cn(
        "self-start rounded-full px-2.5 py-1",
        CONTAINER[variant],
        className,
      )}
    >
      <Text className={cn("text-xs font-bold", LABEL[variant])}>{label}</Text>
    </View>
  );
}
