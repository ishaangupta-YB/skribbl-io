import "react-native-gesture-handler";
import "../global.css";

import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme as nativewindColorScheme, useColorScheme } from "nativewind";
import { ToastProvider } from "@/components/ui";
import { useIdentity } from "@/lib/store";
import { darkColors, lightColors } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const themePref = useIdentity((s) => s.settings.theme);
  const hasHydrated = useIdentity((s) => s.hasHydrated);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Keep NativeWind's active scheme in sync with the persisted preference.
  useEffect(() => {
    nativewindColorScheme.set(themePref);
  }, [themePref]);

  useEffect(() => {
    if (hasHydrated) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hasHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: {
                backgroundColor: isDark ? darkColors.background : lightColors.background,
              },
            }}
          >
            <Stack.Screen name="settings" options={{ presentation: "modal" }} />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
