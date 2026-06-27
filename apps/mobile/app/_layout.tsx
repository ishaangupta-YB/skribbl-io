import "react-native-gesture-handler";
import "../global.css";

import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme as nativewindColorScheme } from "nativewind";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { ToastProvider } from "@/components/ui";
import { useIdentity } from "@/lib/store";
import { darkColors, lightColors } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const themePref = useIdentity((s) => s.settings.theme);
  const hasHydrated = useIdentity((s) => s.hasHydrated);
  const systemScheme = useSystemColorScheme();
  const resolved = themePref === "system" ? (systemScheme === "dark" ? "dark" : "light") : themePref;
  const isDark = resolved === "dark";

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // Keep NativeWind's active scheme in sync with the persisted preference.
  useEffect(() => {
    nativewindColorScheme.set(resolved);
  }, [resolved]);

  useEffect(() => {
    if (hasHydrated && fontsLoaded) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hasHydrated, fontsLoaded]);

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
