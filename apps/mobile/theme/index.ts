import { useColorScheme } from "nativewind";
import { themeColors, type ColorScheme, type ThemeColors } from "./colors";

export * from "./colors";
export * from "./avatars";

/**
 * Active color scheme + token map. Reads NativeWind's color scheme so it stays
 * in lockstep with `className` styling and the manual theme toggle in Settings.
 */
export function useTheme(): {
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
} {
  const { colorScheme } = useColorScheme();
  const scheme: ColorScheme = colorScheme === "dark" ? "dark" : "light";
  return { scheme, colors: themeColors[scheme], isDark: scheme === "dark" };
}
