import { type ReactNode, type Ref, useState } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export interface TextAreaProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  containerClassName?: string;
  className?: string;
  ref?: Ref<TextInput>;
}

export function TextArea({
  ref,
  label,
  error,
  hint,
  leftIcon,
  containerClassName,
  className,
  onFocus,
  onBlur,
  multiline = true,
  numberOfLines = 4,
  textAlignVertical = "top",
  ...props
}: TextAreaProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className={cn("w-full gap-1.5", containerClassName)}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View
        className={cn(
          "min-h-[96px] flex-row rounded-2xl border bg-card px-3.5 py-3",
          focused ? "border-primary" : "border-input",
          error && "border-danger",
        )}
      >
        {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          className={cn("flex-1 text-base text-foreground", className)}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={textAlignVertical}
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
      </View>
      {error ? (
        <Text className="text-xs font-medium text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
