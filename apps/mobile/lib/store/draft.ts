import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultRoomSettings, type RoomSettings } from "@skribbl/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Holds the room settings chosen on the Create screen before a room exists.
 * Persisted on-device so the host's last pack selection and custom words are
 * remembered across app launches.
 */
interface RoomDraftState {
  settings: RoomSettings;
  setSettings: (patch: Partial<RoomSettings>) => void;
  reset: () => void;
}

export const useRoomDraft = create<RoomDraftState>()(
  persist(
    (set, get) => ({
      settings: { ...defaultRoomSettings },
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      reset: () => set({ settings: { ...defaultRoomSettings } }),
    }),
    {
      name: "skribbl.room-draft",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
