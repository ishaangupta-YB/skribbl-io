import { type ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";

export type IconButtonVariant = "solid" | "secondary" | "ghost" | "outline";
export type IconButtonSize = "sm" | "md" | "lg";

const CONTAINER: Record<IconButtonVariant, string> = {
  solid: "bg-primary",
  secondary: "bg-secondary",
  ghost: "bg-transparent",
  outline: "border border-border bg-transparent",
};

const SIZE: Record<IconButtonSize, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-2xl",
  lg: "h-14 w-14 rounded-2xl",
};

export interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
}

export function IconButton({
  children,
  variant = "ghost",
  size = "md",
  disabled,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.94 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}
      className={cn(
        "items-center justify-center",
        SIZE[size],
        CONTAINER[variant],
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </Pressable>
  );
}
