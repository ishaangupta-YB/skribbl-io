import { View } from "react-native";
import { Users } from "lucide-react-native";
import { useTheme } from "@/theme";
import { Badge, Button, Card, Text } from "@/components";
import type { RoomMeta } from "@/lib/api";

export interface RoomListItemProps {
  room: RoomMeta;
  joining: boolean;
  onJoin: (room: RoomMeta) => void;
}

export function RoomListItem({ room, joining, onJoin }: RoomListItemProps) {
  const { colors } = useTheme();
  const isFull = room.playerCount >= room.maxPlayers;
  const statusLabel = isFull ? "Full" : "Waiting";
  const statusVariant = isFull ? "danger" : "success";

  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text variant="subtitle" numberOfLines={1}>
            {room.name || `${room.hostNickname ?? "Open"} room`}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            Host: {room.hostNickname ?? "Unknown"}
          </Text>
        </View>
        <Badge label={statusLabel} variant={statusVariant} />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Users size={16} color={colors.mutedForeground} />
          <Text className="text-sm text-muted-foreground">
            {room.playerCount}/{room.maxPlayers} players
          </Text>
        </View>
        <Button
          size="sm"
          label={isFull ? "Full" : "Join"}
          disabled={isFull || joining}
          loading={joining}
          onPress={() => onJoin(room)}
        />
      </View>
    </Card>
  );
}
