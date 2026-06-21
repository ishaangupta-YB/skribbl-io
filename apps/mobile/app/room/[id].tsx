import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CanvasKitProvider } from "@/features/canvas";
import { GameScreen } from "@/features/game";
import { useTheme } from "@/theme";
import { GameDepsProvider, useRealGameDeps } from "@/lib/gameDeps";

/**
 * Live game room. Mounts Agent D's `<GameScreen/>` wired to Agent C's realtime
 * client + Skia canvas and Agent B's theme via {@link useRealGameDeps}. On web the
 * Skia canvas needs CanvasKit (WASM), so the screen is wrapped in
 * `<CanvasKitProvider/>` (a no-op passthrough on iOS/Android).
 */
export default function RoomScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = (params.id ?? "").toUpperCase();

  const onLeave = useCallback(() => router.replace("/"), []);
  const deps = useRealGameDeps({ onLeave });

  return (
    <CanvasKitProvider
      fallback={
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      }
    >
      <GameDepsProvider deps={deps}>
        <GameScreen roomId={roomId} />
      </GameDepsProvider>
    </CanvasKitProvider>
  );
}
