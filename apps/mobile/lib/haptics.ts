import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useIdentity } from "@/lib/store";
import type { HapticsApi } from "@/features/game";

const IS_WEB = Platform.OS === "web";

function guarded(trigger: () => Promise<void>, enabled: boolean) {
  if (IS_WEB || !enabled) return;
  void trigger().catch(() => undefined);
}

/**
 * Real haptic feedback using `expo-haptics`, gated by platform (web is a no-op)
 * and by the Settings toggle. The returned API object is stable and uses a ref to
 * read the latest preference so the game tree does not re-render on toggle changes.
 */
export function useGameHaptics(): HapticsApi {
  const hapticsEnabledRef = useRef(useIdentity.getState().settings.haptics);
  useEffect(
    () =>
      useIdentity.subscribe((state) => {
        hapticsEnabledRef.current = state.settings.haptics;
      }),
    [],
  );

  const apiRef = useRef<HapticsApi>({
    light: () => guarded(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      hapticsEnabledRef.current,
    ),
    medium: () => guarded(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      hapticsEnabledRef.current,
    ),
    heavy: () => guarded(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      hapticsEnabledRef.current,
    ),
    success: () => guarded(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      hapticsEnabledRef.current,
    ),
    warning: () => guarded(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
      hapticsEnabledRef.current,
    ),
    selection: () => guarded(
      () => Haptics.selectionAsync(),
      hapticsEnabledRef.current,
    ),
  });

  return apiRef.current;
}
