import { type ReactNode } from "react";
import { Pressable, type PressableProps, View } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { Text } from "./text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  outline: "border-2 border-border bg-transparent",
  ghost: "bg-transparent",
  danger: "bg-coral",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  accent: "text-accent-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  danger: "text-coral-foreground",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 rounded-xl",
  md: "h-12 px-5 rounded-2xl",
  lg: "h-14 px-6 rounded-2xl",
};

const LABEL_SIZE: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label?: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  textClassName?: string;
}

export function Button({
  label,
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  textClassName,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === "primary"
      ? colors.primaryForeground
      : variant === "accent"
        ? colors.accentForeground
        : variant === "danger"
          ? colors.danger
          : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => ({
        transform: [{ translateY: pressed ? 2 : 0 }],
        opacity: pressed ? 0.9 : 1,
      })}
      className={cn(
        "flex-row items-center justify-center gap-2",
        SIZE[size],
        CONTAINER[variant],
        fullWidth && "w-full",
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size="small" color={spinnerColor} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          {label !== undefined ? (
            <Text className={cn("font-bold", LABEL_SIZE[size], LABEL[variant], textClassName)}>
              {label}
            </Text>
          ) : (
            children
          )}
          {rightIcon ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
