import React from "react";
import { ScrollView, View } from "react-native";
import { GAME } from "@skribbl/shared";
import { useTheme } from "../integration/GameDepsContext";
import { selectCanStart, selectIsHost, selectPlayerCount } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";
import { AvatarBubble, Button, Card, Row, Txt } from "./primitives";

/**
 * Waiting-room view rendered while the room is in the `lobby` phase (before the
 * first game and after returning from `game-over`). Agent B owns the richer
 * standalone lobby route; this keeps the game screen self-sufficient.
 */
export function LobbyView({
  snapshot,
  onStart,
  onLeave,
}: {
  snapshot: RoomSnapshot;
  onStart: () => void;
  onLeave: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const players = snapshot.room?.players ?? [];
  const isHost = selectIsHost(snapshot);
  const canStart = selectCanStart(snapshot);
  const count = selectPlayerCount(snapshot);
  const need = Math.max(0, GAME.MIN_PLAYERS_TO_START - count);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(6), gap: theme.spacing(5), alignItems: "center" }}>
        <View style={{ alignItems: "center", gap: theme.spacing(1) }}>
          <Txt variant="caption" color={theme.colors.textMuted}>
            ROOM CODE
          </Txt>
          <Txt variant="display" weight="800" color={theme.colors.primary} style={{ letterSpacing: 6 }} testID="lobby-room-code">
            {snapshot.room?.roomId ?? "—"}
          </Txt>
          <Txt variant="caption" color={theme.colors.textMuted}>
            Share this code so friends can join
          </Txt>
        </View>

        <Card style={{ width: "100%", maxWidth: 440, gap: theme.spacing(3) }} testID="lobby-player-list">
          <Row justify="space-between">
            <Txt variant="caption" color={theme.colors.textMuted}>
              PLAYERS ({count}/{snapshot.room?.settings.maxPlayers ?? GAME.MAX_PLAYERS})
            </Txt>
          </Row>
          {players.map((p) => (
            <Row key={p.id} gap={theme.spacing(3)}>
              <AvatarBubble emoji={p.avatar.emoji} color={p.avatar.color} size={36} />
              <Txt variant="body" weight="600" color={theme.colors.text}>
                {p.nickname}
                {p.id === snapshot.youId ? " (you)" : ""}
              </Txt>
              {p.isHost ? <Txt variant="caption">👑</Txt> : null}
            </Row>
          ))}
        </Card>

        <View style={{ width: "100%", maxWidth: 440, gap: theme.spacing(3) }}>
          {isHost ? (
            <>
              <Button label="Start game" variant="primary" fullWidth disabled={!canStart} onPress={onStart} testID="lobby-start-game" />
              {need > 0 ? (
                <Txt variant="caption" color={theme.colors.textMuted} align="center">
                  Need {need} more player{need === 1 ? "" : "s"} to start
                </Txt>
              ) : null}
            </>
          ) : (
            <Txt variant="caption" color={theme.colors.textMuted} align="center">
              Waiting for the host to start…
            </Txt>
          )}
          <Button label="Leave" variant="ghost" fullWidth onPress={onLeave} testID="lobby-leave" />
        </View>
      </ScrollView>
    </View>
  );
}
