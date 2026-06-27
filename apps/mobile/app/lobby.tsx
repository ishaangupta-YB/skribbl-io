import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Globe, Plus, RefreshCw, Users } from "lucide-react-native";
import { nicknameSchema } from "@skribbl/shared";
import { useTheme } from "@/theme";
import { useIdentity } from "@/lib/store";
import {
  AppHeader,
  Button,
  Card,
  IconButton,
  Screen,
  Spinner,
  Text,
  useToast,
} from "@/components";
import { RoomListItem, useLobbyRooms } from "@/features/lobby";
import type { RoomMeta } from "@/lib/api";

export default function LobbyBrowserScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const nickname = useIdentity((s) => s.nickname);
  const {
    rooms,
    total,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  } = useLobbyRooms();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const onJoin = useCallback(
    (room: RoomMeta) => {
      if (!nicknameSchema.safeParse(nickname).success) {
        toast.error("Set a nickname first", "1–16 characters.");
        router.push("/settings");
        return;
      }
      setJoiningId(room.roomId);
      router.replace({ pathname: "/room/[id]", params: { id: room.roomId } });
    },
    [nickname, toast],
  );

  const renderItem = useCallback(
    ({ item }: { item: RoomMeta }) => (
      <RoomListItem room={item} joining={joiningId === item.roomId} onJoin={onJoin} />
    ),
    [joiningId, onJoin],
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <Card className="items-center gap-4 py-10">
        <View className="rounded-full bg-muted p-4">
          <Globe size={32} color={colors.mutedForeground} />
        </View>
        <View className="items-center gap-1">
          <Text variant="subtitle">No public rooms</Text>
          <Text className="text-center text-sm text-muted-foreground">
            No one is hosting a public room right now. Create one and invite friends!
          </Text>
        </View>
        <Button
          variant="secondary"
          label="Create a room"
          leftIcon={<Plus size={18} color={colors.secondaryForeground} />}
          onPress={() => router.push("/create")}
        />
      </Card>
    );
  };

  const renderHeader = () => (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Users size={18} color={colors.primary} />
        <Text className="text-sm text-muted-foreground">
          {total} open {total === 1 ? "room" : "rooms"}
        </Text>
      </View>
      <IconButton
        variant="ghost"
        size="sm"
        onPress={refresh}
        accessibilityLabel="Refresh lobby"
      >
        <RefreshCw size={18} color={colors.foreground} />
      </IconButton>
    </View>
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={refresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    ),
    [isRefreshing, refresh, colors.primary],
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return <Spinner className="py-4" />;
    }
    if (hasMore) {
      return (
        <Button
          variant="outline"
          className="my-4"
          label="Load more rooms"
          onPress={loadMore}
        />
      );
    }
    return null;
  };

  return (
    <Screen scroll={false}>
      <AppHeader title="Public lobby" back />

      {error && !isLoading ? (
        <Card className="my-4 gap-3 border-coral">
          <Text className="text-coral">{error}</Text>
          <Button variant="secondary" label="Try again" onPress={refresh} />
        </Card>
      ) : null}

      {isLoading && rooms.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Spinner size="large" />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.roomId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={refreshControl}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
