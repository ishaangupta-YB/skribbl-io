import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, View } from "react-native";
import type { ListRenderItem } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../integration/GameDepsContext";
import { selectScoreboard } from "../state/selectors";
import type { GameTheme } from "../integration/contracts";
import type { RoomSnapshot, ScoreRow } from "../state/types";
import { AvatarBubble, Row, Txt } from "./primitives";

/**
 * Live scoreboard. `list` is the full vertical panel (wide layouts), `strip`
 * is a compact horizontal rail (narrow layouts).
 */
export function Scoreboard({
  snapshot,
  variant = "list",
}: {
  snapshot: RoomSnapshot;
  variant?: "list" | "strip";
}): React.JSX.Element {
  const theme = useTheme();
  const rows = selectScoreboard(snapshot);

  const renderStripCell = useCallback<ListRenderItem<ScoreRow>>(
    ({ item }) => <StripCell row={item} theme={theme} />,
    [theme],
  );

  if (variant === "strip") {
    return (
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing(2), gap: theme.spacing(2) }}
        style={{ backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
        data={rows}
        keyExtractor={(r) => r.playerId}
        renderItem={renderStripCell}
      />
    );
  }

  return (
    <View style={{ gap: theme.spacing(2) }}>
      <Txt variant="caption" color={theme.colors.textMuted}>
        SCOREBOARD
      </Txt>
      {rows.map((r) => (
        <ListRow key={r.playerId} row={r} theme={theme} />
      ))}
    </View>
  );
}

function badges(row: ScoreRow): string {
  let out = "";
  if (row.isDrawing) out += "✏️";
  if (row.hasGuessed) out += "✅";
  return out;
}

function ListRow({ row, theme }: { row: ScoreRow; theme: GameTheme }): React.JSX.Element {
  const rowScale = useSharedValue(1);
  const pointsScale = useSharedValue(1);
  const pointsOpacity = useSharedValue(1);
  const prevGuessed = useRef(row.hasGuessed);
  const prevPoints = useRef(row.roundPoints);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));
  const pointsStyle = useAnimatedStyle(() => ({
    opacity: pointsOpacity.value,
    transform: [{ scale: pointsScale.value }],
  }));

  // Server-pushed snapshot changes drive these pulse animations; there is no
  // local event handler to host them, so an effect is the correct pattern.
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (row.hasGuessed && !prevGuessed.current) {
      rowScale.value = withSequence(withTiming(1.04, { duration: 120 }), withSpring(1, { damping: 14 }));
    }
    prevGuessed.current = row.hasGuessed;
  }, [row.hasGuessed, rowScale]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (row.roundPoints > 0 && prevPoints.current === 0) {
      pointsScale.value = 1.5;
      pointsOpacity.value = 0;
      pointsScale.value = withSpring(1, { damping: 14 });
      pointsOpacity.value = withTiming(1, { duration: 250 });
    }
    prevPoints.current = row.roundPoints;
  }, [row.roundPoints, pointsOpacity, pointsScale]);

  const rowContainerStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing(3),
      paddingVertical: theme.spacing(2),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.md,
      backgroundColor: row.isYou ? theme.colors.surfaceAlt : "transparent",
      borderWidth: row.isYou ? 1 : 0,
      borderColor: theme.colors.primary,
    }),
    [theme, row.isYou],
  );

  return (
    <Animated.View style={[rowContainerStyle, rowStyle]}>
      <Txt variant="caption" color={theme.colors.textMuted} style={{ width: 18 }}>
        {row.rank}
      </Txt>
      <AvatarBubble
        emoji={row.avatar.emoji}
        color={row.avatar.color}
        size={34}
        ring={row.isDrawing ? theme.colors.accent : undefined}
        dimmed={row.hasGuessed && !row.isDrawing}
      />
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <Txt variant="body" weight="600" numberOfLines={1} color={theme.colors.text}>
            {row.nickname}
            {row.isYou ? " (you)" : ""}
          </Txt>
          <Txt variant="caption">{badges(row)}</Txt>
        </Row>
      </View>
      {row.roundPoints > 0 ? (
        <Animated.View style={pointsStyle}>
          <Txt variant="caption" color={theme.colors.success} weight="800">
            +{row.roundPoints}
          </Txt>
        </Animated.View>
      ) : null}
      <Txt variant="subtitle" weight="800" color={theme.colors.text} style={{ minWidth: 44, textAlign: "right" }}>
        {row.score}
      </Txt>
    </Animated.View>
  );
}

function StripCell({ row, theme }: { row: ScoreRow; theme: GameTheme }): React.JSX.Element {
  const style = useMemo(
    () => ({
      alignItems: "center" as const,
      gap: 2,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
      backgroundColor: row.isYou ? theme.colors.surfaceAlt : "transparent",
      minWidth: 56,
    }),
    [theme, row.isYou],
  );

  return (
    <View style={style}>
      <AvatarBubble
        emoji={row.avatar.emoji}
        color={row.avatar.color}
        size={32}
        ring={row.isDrawing ? theme.colors.accent : undefined}
        dimmed={row.hasGuessed && !row.isDrawing}
      />
      <Txt variant="caption" weight="800" color={theme.colors.text}>
        {row.score}
      </Txt>
      <Txt variant="caption" color={theme.colors.textMuted} numberOfLines={1} style={{ maxWidth: 56 }}>
        {badges(row) || row.nickname}
      </Txt>
    </View>
  );
}
