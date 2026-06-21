import { defaultRoomSettings, type RoomSettings } from "@skribbl/shared";
import { create } from "zustand";

/**
 * Holds the room settings chosen on the Create screen before a room exists.
 * Agent C's connection layer should send these when the host creates the room
 * (e.g. `POST /api/rooms` or a `settings:update` right after `join`).
 */
interface RoomDraftState {
  settings: RoomSettings;
  setSettings: (patch: Partial<RoomSettings>) => void;
  reset: () => void;
}

export const useRoomDraft = create<RoomDraftState>()((set, get) => ({
  settings: { ...defaultRoomSettings },
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  reset: () => set({ settings: { ...defaultRoomSettings } }),
}));
