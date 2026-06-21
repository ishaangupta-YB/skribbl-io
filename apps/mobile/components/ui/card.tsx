import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export interface CardProps extends ViewProps {
  className?: string;
  /** Removes inner padding (e.g. when the card hosts its own layout). */
  flush?: boolean;
}

export function Card({ className, flush = false, ...props }: CardProps) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card",
        !flush && "p-4",
        className,
      )}
      {...props}
    />
  );
}
