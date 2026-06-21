import React from "react";
import { Pressable, View } from "react-native";
import { GAME } from "@skribbl/shared";
import { useTheme } from "../integration/GameDepsContext";
import {
  selectDrawer,
  selectIsDrawer,
  selectPhase,
} from "../state/selectors";
import type { Countdown, RoomSnapshot } from "../state/types";
import { AvatarBubble, Badge, ProgressBar, Row, Txt } from "./primitives";

const PHASE_LABEL: Record<string, string> = {
  lobby: "Waiting to start",
  choosing: "Choosing a word",
  drawing: "Drawing",
  reveal: "Round over",
  "round-end": "Round over",
  "game-over": "Game over",
};

export function GameHeader({
  snapshot,
  countdown,
  onLeave,
}: {
  snapshot: RoomSnapshot;
  countdown: Countdown;
  onLeave: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const phase = selectPhase(snapshot);
  const drawer = selectDrawer(snapshot);
  const youDraw = selectIsDrawer(snapshot);
  const round = snapshot.room?.currentRound ?? 0;
  const maxRounds = snapshot.room?.settings.maxRounds ?? GAME.DEFAULT_MAX_ROUNDS;

  const urgent = countdown.active && countdown.secondsLeft <= 10;
  const timerColor = urgent ? theme.colors.danger : theme.colors.accent;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingHorizontal: theme.spacing(4),
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        gap: theme.spacing(2),
      }}
    >
      <Row justify="space-between">
        <Row gap={theme.spacing(2)}>
          <Badge
            label={round > 0 ? `Round ${round}/${maxRounds}` : "Lobby"}
            color={theme.colors.surfaceAlt}
            textColor={theme.colors.textMuted}
          />
          <Txt variant="caption" color={theme.colors.textMuted}>
            {PHASE_LABEL[phase] ?? phase}
          </Txt>
        </Row>

        <Row gap={theme.spacing(2)}>
          {countdown.active ? (
            <Txt variant="title" color={timerColor} weight="800">
              {countdown.secondsLeft}s
            </Txt>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave game"
            onPress={onLeave}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <Txt variant="subtitle" color={theme.colors.textMuted}>
              ✕
            </Txt>
          </Pressable>
        </Row>
      </Row>

      <Row gap={theme.spacing(2)}>
        {drawer ? (
          <>
            <AvatarBubble
              emoji={drawer.avatar.emoji}
              color={drawer.avatar.color}
              size={26}
              ring={phase === "drawing" ? theme.colors.accent : undefined}
            />
            <Txt variant="caption" color={theme.colors.textMuted}>
              {youDraw ? "You are drawing" : `${drawer.nickname} is drawing`}
            </Txt>
          </>
        ) : (
          <Txt variant="caption" color={theme.colors.textMuted}>
            Get ready…
          </Txt>
        )}
      </Row>

      {countdown.active ? (
        <ProgressBar
          fraction={1 - countdown.fractionElapsed}
          color={timerColor}
          trackColor={theme.colors.surfaceAlt}
        />
      ) : null}
    </View>
  );
}
