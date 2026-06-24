import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../integration/GameDepsContext";
import { selectDrawer, selectPhase } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";
import { AvatarBubble, Txt } from "./primitives";

const VISIBLE_MS = 1800;

interface Announcement {
  title: string;
  subtitle: string;
  emoji?: string;
}

/**
 * Briefly flashes a large "Round N" / "Your turn" banner when a new turn begins.
 * The overlay is pointer-events-none so it never blocks drawing or chat.
 *
 * The announcement content is computed during render (derived from the snapshot).
 * Only the animation trigger lives in an effect; it never adjusts React state
 * in response to prop changes, which keeps react-doctor happy.
 */
export function PhaseAnnounce({ snapshot }: { snapshot: RoomSnapshot }): React.JSX.Element | null {
  const theme = useTheme();
  const phase = selectPhase(snapshot);
  const round = snapshot.room?.currentRound ?? 0;
  const drawer = selectDrawer(snapshot);
  const youDraw = drawer?.id === snapshot.youId;

  const fade = useSharedValue(0);
  const translateY = useSharedValue(-24);
  const scale = useSharedValue(0.9);
  const lastKeyRef = useRef<string | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncementRef = useRef<Announcement | null>(null);

  const announcement = useMemo<Announcement | null>(() => {
    if (phase === "choosing" || phase === "drawing") {
      return {
        title: round > 0 ? `Round ${round}` : "Draw!",
        subtitle: youDraw
          ? "Your turn to draw"
          : drawer
            ? `${drawer.nickname} is drawing`
            : "Get ready…",
        emoji: drawer?.avatar.emoji,
      };
    }
    return null;
  }, [phase, round, youDraw, drawer]);

  if (announcement) {
    lastAnnouncementRef.current = announcement;
  }

  useEffect(() => {
    const key = `${round}-${phase}-${drawer?.id ?? ""}-${youDraw}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const hide = () => {
      fade.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-16, { duration: 200 });
    };

    if (!announcement) {
      hide();
      return;
    }

    fade.value = 0;
    translateY.value = -24;
    scale.value = 0.9;
    fade.value = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { damping: 12, stiffness: 160 });
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });

    hideTimerRef.current = setTimeout(hide, VISIBLE_MS);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [announcement, phase, round, drawer?.id, youDraw, fade, translateY, scale]);

  const containerStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: theme.spacing(10),
      left: 0,
      right: 0,
      zIndex: 30,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    }),
    [theme],
  );
  const bannerStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.overlay,
      borderRadius: theme.radius.xl,
      paddingVertical: theme.spacing(3),
      paddingHorizontal: theme.spacing(5),
      alignItems: "center" as const,
      gap: theme.spacing(2),
      minWidth: 220,
    }),
    [theme],
  );
  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const content = announcement ?? lastAnnouncementRef.current;
  if (!content) return null;

  return (
    <View pointerEvents="none" style={containerStyle}>
      <Animated.View style={[bannerStyle, bannerAnimatedStyle]}>
        {content.emoji ? (
          <AvatarBubble emoji={content.emoji} color={drawer?.avatar.color ?? theme.colors.primary} size={48} />
        ) : null}
        <Txt variant="title" color={theme.colors.textInverse} weight="800" align="center">
          {content.title}
        </Txt>
        <Txt variant="subtitle" color={theme.colors.textInverse} align="center">
          {content.subtitle}
        </Txt>
      </Animated.View>
    </View>
  );
}
