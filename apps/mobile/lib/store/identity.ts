import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Avatar } from "@skribbl/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { randomAvatar, randomGuestName } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";

export interface AppSettings {
  /** Play UI/game sounds (expo-audio). */
  sound: boolean;
  /** Fire haptic feedback (expo-haptics) on native. */
  haptics: boolean;
  /** Color-scheme preference; `system` follows the OS. */
  theme: ThemePreference;
}

export const defaultSettings: AppSettings = {
  sound: true,
  haptics: true,
  theme: "system",
};

interface IdentityState {
  nickname: string;
  avatar: Avatar;
  settings: AppSettings;
  /** True once the persisted value has been read from disk. */
  hasHydrated: boolean;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: Avatar) => void;
  setAvatarEmoji: (emoji: string) => void;
  setAvatarColor: (color: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  randomizeAvatar: () => void;
  _setHasHydrated: (value: boolean) => void;
}

export const useIdentity = create<IdentityState>()(
  persist(
    (set, get) => ({
      nickname: randomGuestName(),
      avatar: randomAvatar(),
      settings: defaultSettings,
      hasHydrated: false,
      setNickname: (nickname) => set({ nickname }),
      setAvatar: (avatar) => set({ avatar }),
      setAvatarEmoji: (emoji) => set({ avatar: { ...get().avatar, emoji } }),
      setAvatarColor: (color) => set({ avatar: { ...get().avatar, color } }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      randomizeAvatar: () => set({ avatar: randomAvatar() }),
      _setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "skribbl.identity",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        nickname: state.nickname,
        avatar: state.avatar,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);
