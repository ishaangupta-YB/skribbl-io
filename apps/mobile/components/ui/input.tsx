import { type ReactNode, type Ref, useState } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
  className?: string;
  ref?: Ref<TextInput>;
}

export function Input({
  ref,
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerClassName,
  className,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className={cn("w-full gap-1.5", containerClassName)}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View
        className={cn(
          "h-12 flex-row items-center rounded-xl border-2 bg-secondary px-3.5",
          focused ? "border-primary" : "border-input",
          error && "border-coral",
        )}
      >
        {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          className={cn("h-full flex-1 text-base text-foreground", className)}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {rightIcon ? <View className="ml-2">{rightIcon}</View> : null}
      </View>
      {error ? (
        <Text className="text-xs font-medium text-coral">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
