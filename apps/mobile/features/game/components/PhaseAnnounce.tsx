import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
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

  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const lastKeyRef = useRef<string | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncementRef = useRef<Announcement | null>(null);

  const announcement: Announcement | null =
    phase === "choosing" || phase === "drawing"
      ? {
          title: round > 0 ? `Round ${round}` : "Draw!",
          subtitle: youDraw
            ? "Your turn to draw"
            : drawer
              ? `${drawer.nickname} is drawing`
              : "Get ready…",
          emoji: drawer?.avatar.emoji,
        }
      : null;

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
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        lastAnnouncementRef.current = null;
      });
    };

    if (!announcement) {
      hide();
      return;
    }

    fade.setValue(0);
    translateY.setValue(-24);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();

    hideTimerRef.current = setTimeout(hide, VISIBLE_MS);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [announcement, phase, round, drawer?.id, youDraw, fade, translateY, scale]);

  const content = announcement ?? lastAnnouncementRef.current;
  if (!content) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: theme.spacing(10),
        left: 0,
        right: 0,
        zIndex: 30,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ translateY }, { scale }],
          backgroundColor: theme.colors.overlay,
          borderRadius: theme.radius.xl,
          paddingVertical: theme.spacing(3),
          paddingHorizontal: theme.spacing(5),
          alignItems: "center",
          gap: theme.spacing(2),
          minWidth: 220,
        }}
      >
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
