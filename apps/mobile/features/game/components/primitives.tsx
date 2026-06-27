/**
 * Small, feature-internal UI primitives themed from the injected design
 * tokens. They are deliberately minimal — when Agent B's design system lands,
 * these can be swapped for `components/ui/*`, but keeping them here lets the
 * game flow stand alone and stay decoupled from B's exact component API.
 */
import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useHaptics, useTheme } from "../integration/GameDepsContext";
import type { GameTheme } from "../integration/contracts";

type TxtVariant = "display" | "title" | "subtitle" | "body" | "caption" | "mono";

export function Txt({
  children,
  variant = "body",
  color,
  weight,
  align,
  style,
  numberOfLines,
  testID,
}: {
  children: React.ReactNode;
  variant?: TxtVariant;
  color?: string;
  weight?: "400" | "600" | "700" | "800";
  align?: TextStyle["textAlign"];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const base = variantStyle(theme, variant);
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[
        base,
        color ? { color } : null,
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function variantStyle(theme: GameTheme, variant: TxtVariant): TextStyle {
  const { font, colors } = theme;
  switch (variant) {
    case "display":
      return { fontSize: font.xxl, fontWeight: font.weightBold, color: colors.text, letterSpacing: 0.5 };
    case "title":
      return { fontSize: font.xl, fontWeight: font.weightBold, color: colors.text };
    case "subtitle":
      return { fontSize: font.lg, fontWeight: font.weightMedium, color: colors.text };
    case "caption":
      return { fontSize: font.xs, fontWeight: font.weightMedium, color: colors.textMuted };
    case "mono":
      return {
        fontSize: font.xl,
        fontWeight: font.weightBold,
        color: colors.text,
        letterSpacing: 4,
        fontFamily: theme.font.family,
      };
    case "body":
    default:
      return { fontSize: font.md, fontWeight: font.weightRegular, color: colors.text };
  }
}

export function Card({
  children,
  style,
  padded = true,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  testID?: string;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: padded ? theme.spacing(4) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "accent";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
  style,
  fullWidth,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  testID?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const haptics = useHaptics();
  const scale = useSharedValue(0);

  const { bg, fg, border } = buttonColors(theme, variant, disabled);

  const press = (to: number) => {
    scale.value = withSpring(to, { damping: 15, stiffness: 400 });
  };
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scale.value }] }));

  const buttonStyle = useMemo(
    () => ({
      backgroundColor: bg,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(3),
      paddingHorizontal: theme.spacing(5),
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: theme.spacing(2),
      borderWidth: border ? 1.5 : 0,
      borderColor: border ?? "transparent",
      opacity: disabled ? 0.55 : 1,
    }),
    [bg, border, disabled, theme],
  );

  return (
    <Animated.View style={[animatedStyle, fullWidth ? { alignSelf: "stretch" } : null, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) {
            haptics.selection();
            press(2);
          }
        }}
        onPressOut={() => press(0)}
        onPress={() => {
          if (!disabled) onPress();
        }}
        style={buttonStyle}
      >
        {icon}
        <Text style={{ color: fg, fontWeight: theme.font.weightBold, fontSize: theme.font.md }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function buttonColors(
  theme: GameTheme,
  variant: ButtonVariant,
  _disabled: boolean,
): { bg: string; fg: string; border?: string } {
  const { colors } = theme;
  switch (variant) {
    case "ghost":
      return { bg: "transparent", fg: colors.text, border: colors.border };
    case "danger":
      return { bg: colors.danger, fg: colors.textInverse };
    case "accent":
      return { bg: colors.accent, fg: colors.textInverse };
    case "primary":
    default:
      return { bg: colors.primary, fg: colors.primaryText };
  }
}

export function Badge({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string;
  textColor?: string;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing(2),
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: textColor ?? theme.colors.textInverse, fontSize: theme.font.xs, fontWeight: theme.font.weightBold }}>
        {label}
      </Text>
    </View>
  );
}

export function AvatarBubble({
  emoji,
  color,
  size = 40,
  ring,
  dimmed,
}: {
  emoji: string;
  color: string;
  size?: number;
  ring?: string;
  dimmed?: boolean;
}): React.JSX.Element {
  const style = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: ring ? 2.5 : 0,
      borderColor: ring ?? "transparent",
      opacity: dimmed ? 0.5 : 1,
    }),
    [size, color, ring, dimmed],
  );
  return (
    <View style={style}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

/** A thin progress/countdown bar. `fraction` 0..1 is the portion remaining. */
export function ProgressBar({
  fraction,
  color,
  trackColor,
  height = 6,
}: {
  fraction: number;
  color: string;
  trackColor: string;
  height?: number;
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <View style={{ height, backgroundColor: trackColor, borderRadius: height, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "flex-start",
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[{ flexDirection: "row", alignItems: align, justifyContent: justify, gap }, style]}>{children}</View>
  );
}
