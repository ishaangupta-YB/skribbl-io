import { Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Copy, LogOut, Play, Share2, Users } from "lucide-react-native";
import type { Player } from "@skribbl/shared";
import { GAME } from "@skribbl/shared";
import { useTheme } from "@/theme";
import {
  useConnectionStatus,
  useIdentity,
  useRoomDraft,
  useRoomStore,
} from "@/lib/store";
import {
  AppHeader,
  Avatar,
  Badge,
  Button,
  Card,
  Screen,
  Text,
} from "@/components";

function StatusBadge({ status }: { status: ReturnType<typeof useConnectionStatus> }) {
  if (status === "connected") return <Badge label="Connected" variant="success" />;
  if (status === "connecting" || status === "reconnecting")
    return <Badge label="Connecting…" variant="warning" />;
  return <Badge label="Offline" variant="outline" />;
}

export default function LobbyScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; host?: string }>();
  const roomId = (params.id ?? "").toUpperCase();
  const isHostIntent = params.host === "1";

  const nickname = useIdentity((s) => s.nickname);
  const avatar = useIdentity((s) => s.avatar);
  const status = useConnectionStatus();
  const room = useRoomStore((s) => s.room);
  const youId = useRoomStore((s) => s.youId);
  const draftSettings = useRoomDraft((s) => s.settings);

  const settings = room?.settings ?? draftSettings;
  const isHost = room ? room.hostId === youId : isHostIntent;

  // Until Agent C's WS client populates the room, show a provisional self-entry
  // so the lobby looks complete; it's replaced seamlessly by `room:state`.
  const selfPlayer: Player = {
    id: youId ?? "you",
    nickname,
    avatar,
    score: 0,
    isHost: isHostIntent,
    isDrawing: false,
    hasGuessed: false,
    connected: status === "connected",
  };
  const players = room && room.players.length > 0 ? room.players : [selfPlayer];
  const belowMin = players.length < GAME.MIN_PLAYERS_TO_START;

  const copyCode = async () => {
    await Clipboard.setStringAsync(roomId);
  };
  const shareCode = async () => {
    try {
      await Share.share({ message: `Join my Skribbl room! Code: ${roomId}` });
    } catch {
      // user dismissed share sheet
    }
  };

  return (
    <Screen scroll>
      <AppHeader
        title="Lobby"
        onBack={() => router.replace("/")}
        right={<StatusBadge status={status} />}
      />

      <View className="gap-5 pt-2">
        <Card className="items-center gap-3">
          <Text variant="caption">Room code</Text>
          <Text className="text-4xl font-bold tracking-[6px] text-foreground font-mono">{roomId}</Text>
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              size="sm"
              label="Copy"
              leftIcon={<Copy size={16} color={colors.foreground} />}
              onPress={copyCode}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Share"
              leftIcon={<Share2 size={16} color={colors.foreground} />}
              onPress={shareCode}
            />
          </View>
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="subtitle">Players</Text>
            <View className="flex-row items-center gap-1.5">
              <Users size={16} color={colors.mutedForeground} />
              <Text variant="caption">
                {players.length}/{settings.maxPlayers}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            {players.map((player) => {
              const isYou = player.id === (youId ?? "you");
              return (
                <View
                  key={player.id}
                  className="flex-row items-center gap-3 rounded-2xl bg-muted/60 p-2.5"
                >
                  <Avatar avatar={player.avatar} size="sm" isHost={player.isHost} />
                  <Text className="flex-1 font-semibold text-foreground" numberOfLines={1}>
                    {player.nickname}
                  </Text>
                  {isYou ? <Badge label="You" variant="primary" /> : null}
                </View>
              );
            })}
          </View>
        </Card>

        <Card className="flex-row items-center justify-around">
          <View className="items-center">
            <Text variant="caption">Rounds</Text>
            <Text variant="subtitle">{settings.maxRounds}</Text>
          </View>
          <View className="h-8 w-px bg-border" />
          <View className="items-center">
            <Text variant="caption">Draw time</Text>
            <Text variant="subtitle">{settings.roundDurationSec}s</Text>
          </View>
          <View className="h-8 w-px bg-border" />
          <View className="items-center">
            <Text variant="caption">Hints</Text>
            <Text variant="subtitle">{settings.hintsEnabled ? "On" : "Off"}</Text>
          </View>
        </Card>

        {isHost ? (
          <View className="gap-2">
            <Button
              size="lg"
              label="Start game"
              leftIcon={<Play size={20} color={colors.primaryForeground} />}
              onPress={() => router.push({ pathname: "/room/[id]", params: { id: roomId } })}
            />
            {belowMin ? (
              <Text className="text-center text-xs text-muted-foreground">
                Needs at least {GAME.MIN_PLAYERS_TO_START} players — the server starts when ready.
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="items-center py-2">
            <Text className="text-muted-foreground">Waiting for the host to start…</Text>
          </View>
        )}

        <Button
          variant="ghost"
          label="Leave room"
          leftIcon={<LogOut size={18} color={colors.mutedForeground} />}
          textClassName="text-muted-foreground"
          onPress={() => router.replace("/")}
        />
      </View>
    </Screen>
  );
}
