import type { GamePhase, Player, RoomSettings, ScoreEntry } from "@skribbl/shared";
import { useRoomStore } from "./room";

export const usePhase = (): GamePhase | null =>
  useRoomStore((s) => s.room?.phase ?? null);

export const useYouId = (): string | null => useRoomStore((s) => s.youId);

export const useConnectionStatus = () => useRoomStore((s) => s.status);

export const usePlayers = (): Player[] =>
  useRoomStore((s) => s.room?.players ?? EMPTY_PLAYERS);

export const useHostId = (): string | null =>
  useRoomStore((s) => s.room?.hostId ?? null);

export const useDrawerId = (): string | null =>
  useRoomStore((s) => s.room?.drawerId ?? null);

export const useIsHost = (): boolean =>
  useRoomStore((s) => !!s.youId && s.room?.hostId === s.youId);

export const useIsDrawer = (): boolean =>
  useRoomStore((s) => !!s.youId && s.room?.drawerId === s.youId);

export const useMaskedWord = (): string | null =>
  useRoomStore((s) => s.room?.maskedWord ?? null);

export const usePhaseEndsAt = (): number | null =>
  useRoomStore((s) => s.room?.phaseEndsAt ?? null);

export const useRoomSettings = (): RoomSettings | null =>
  useRoomStore((s) => s.room?.settings ?? null);

export const useMessages = () => useRoomStore((s) => s.messages);

export const useReactions = () => useRoomStore((s) => s.reactions);

export const useLastError = () => useRoomStore((s) => s.lastError);

/** Latest scores; falls back to deriving from players when none have been pushed. */
export const useScores = (): ScoreEntry[] =>
  useRoomStore((s) => (s.scores.length > 0 ? s.scores : EMPTY_SCORES));

const EMPTY_PLAYERS: Player[] = [];
const EMPTY_SCORES: ScoreEntry[] = [];
