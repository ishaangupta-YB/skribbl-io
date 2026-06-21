import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LogOut, MessageSquare, Palette } from "lucide-react-native";
import { useTheme } from "@/theme";
import { AppHeader, Card, IconButton, Screen, Text } from "@/components";

// ── Agent D plugs the game UI in here ───────────────────────────────────────
// Once `features/game` exports a `GameScreen`, replace the placeholder below:
//
//   import { GameScreen } from "@/features/game";
//   return <GameScreen roomId={roomId} />;
//
// `GameScreen` composes Agent C's canvas (`@/features/canvas`) with the chat,
// header, timer, and scoreboard, all driven by `useRoomStore` (`@/lib/store`).
// ─────────────────────────────────────────────────────────────────────────────

export default function RoomScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = (params.id ?? "").toUpperCase();

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <View className="px-5">
        <AppHeader
          title={`Room ${roomId}`}
          subtitle="Game screen"
          onBack={() => router.replace("/")}
          right={
            <IconButton
              variant="secondary"
              size="sm"
              accessibilityLabel="Leave room"
              onPress={() => router.replace("/")}
            >
              <LogOut size={18} color={colors.foreground} />
            </IconButton>
          }
        />
      </View>

      <View className="flex-1 gap-3 px-5 pb-4 pt-1">
        <Card
          flush
          className="flex-1 items-center justify-center gap-3 border-2 border-dashed bg-card/60"
        >
          <Palette size={40} color={colors.mutedForeground} />
          <Text variant="subtitle">Drawing canvas</Text>
          <Text className="px-8 text-center text-sm text-muted-foreground">
            Agent C mounts the Skia canvas here (`@/features/canvas`).
          </Text>
        </Card>

        <Card
          flush
          className="h-44 items-center justify-center gap-2 border-2 border-dashed bg-card/60"
        >
          <MessageSquare size={28} color={colors.mutedForeground} />
          <Text variant="label">Chat & guesses · scoreboard · timer</Text>
          <Text className="px-8 text-center text-sm text-muted-foreground">
            Agent D mounts the game flow here (`@/features/game`).
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
