import { create } from "zustand";
import type {
  ChatMessage,
  Player,
  PublicRoomState,
  ScoreEntry,
  ServerMessage,
  Stroke,
} from "@skribbl/shared";
import { appendStrokeSegment } from "./strokes";
import type { ConnectionStatus } from "./types";

/**
 * PROVISIONAL shared room store.
 *
 * Agent B owns `lib/store` in the long run. Until B's scaffold lands this store
 * lives here so the realtime client (C) and game UI (D) have a single source of
 * truth. Agent B should either adopt this verbatim (move it to `lib/store`) or
 * expose equivalent actions; see `docs/handoffs/canvas-integration.md`.
 *
 * `applyServerMessage` is the one place that turns validated {@link ServerMessage}
 * frames into state, so the WS hook stays a thin forwarder and the reducer is
 * unit-testable in isolation.
 */
export interface ReactionEvent {
  playerId: string;
  emoji: string;
  ts: number;
}

export interface RoomStore {
  // ---- connection ----
  status: ConnectionStatus;
  youId: string | null;

  // ---- room snapshot (driven by room:state + incremental events) ----
  room: PublicRoomState | null;

  // ---- social / scoring ----
  chat: ChatMessage[];
  scores: ScoreEntry[];
  leaderboard: ScoreEntry[] | null;
  lastReaction: ReactionEvent | null;
  lastError: { code: string; message: string } | null;

  // ---- drawing board (normalized 0-1 strokes) ----
  strokes: Stroke[];

  // ---- actions ----
  setStatus: (status: ConnectionStatus) => void;
  applyServerMessage: (message: ServerMessage) => void;
  /** Append a stroke, merging contiguous streamed segments into one stroke. */
  applyDraw: (stroke: Stroke) => void;
  clearStrokes: () => void;
  undoStroke: () => void;
  resetStrokes: () => void;
  reset: () => void;
}

const MAX_CHAT_HISTORY = 200;

function patchRoom(
  room: PublicRoomState | null,
  patch: Partial<PublicRoomState>,
): PublicRoomState | null {
  if (!room) return room;
  return { ...room, ...patch };
}

function patchPlayers(
  room: PublicRoomState | null,
  map: (player: Player) => Player,
): PublicRoomState | null {
  if (!room) return room;
  return { ...room, players: room.players.map(map) };
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  status: "idle",
  youId: null,
  room: null,
  chat: [],
  scores: [],
  leaderboard: null,
  lastReaction: null,
  lastError: null,
  strokes: [],

  setStatus: (status) => set({ status }),

  applyDraw: (stroke) => set((state) => ({ strokes: appendStrokeSegment(state.strokes, stroke) })),

  clearStrokes: () => set({ strokes: [] }),
  undoStroke: () => set((state) => ({ strokes: state.strokes.slice(0, -1) })),
  resetStrokes: () => set({ strokes: [] }),

  reset: () =>
    set({
      youId: null,
      room: null,
      chat: [],
      scores: [],
      leaderboard: null,
      lastReaction: null,
      lastError: null,
      strokes: [],
    }),

  applyServerMessage: (message) => {
    switch (message.type) {
      case "room:state":
        set({ youId: message.youId, room: message.state, scores: scoresFrom(message.state) });
        break;

      case "player:joined":
        set((s) =>
          s.room
            ? {
                room: s.room.players.some((p) => p.id === message.player.id)
                  ? s.room
                  : { ...s.room, players: [...s.room.players, message.player] },
              }
            : {},
        );
        break;

      case "player:left":
        set((s) =>
          s.room
            ? { room: { ...s.room, players: s.room.players.filter((p) => p.id !== message.playerId) } }
            : {},
        );
        break;

      case "host:changed":
        set((s) => ({
          room: patchPlayers(patchRoom(s.room, { hostId: message.hostId }), (p) => ({
            ...p,
            isHost: p.id === message.hostId,
          })),
        }));
        break;

      case "turn:choosing":
        set((s) => ({
          room: patchPlayers(
            patchRoom(s.room, {
              phase: "choosing",
              drawerId: message.drawerId,
              currentRound: message.round,
              phaseEndsAt: message.phaseEndsAt,
              wordChoices: message.choices,
              word: null,
              maskedWord: null,
            }),
            (p) => ({ ...p, isDrawing: p.id === message.drawerId, hasGuessed: false }),
          ),
          strokes: [],
        }));
        break;

      case "turn:start":
        set((s) => ({
          room: patchPlayers(
            patchRoom(s.room, {
              phase: "drawing",
              drawerId: message.drawerId,
              currentRound: message.round,
              maskedWord: message.maskedWord,
              wordLength: message.wordLength,
              phaseEndsAt: message.phaseEndsAt,
              word: message.word,
              wordChoices: null,
            }),
            (p) => ({ ...p, isDrawing: p.id === message.drawerId, hasGuessed: false }),
          ),
          strokes: [],
        }));
        break;

      case "turn:hint":
        set((s) => ({ room: patchRoom(s.room, { maskedWord: message.maskedWord }) }));
        break;

      case "turn:reveal":
        set((s) => ({
          room: patchRoom(s.room, { phase: "reveal", word: message.word }),
          scores: message.scores,
        }));
        break;

      case "draw":
        get().applyDraw(message.stroke);
        break;

      case "draw:clear":
        get().clearStrokes();
        break;

      case "draw:undo":
        get().undoStroke();
        break;

      case "chat":
        set((s) => ({ chat: [...s.chat, message.message].slice(-MAX_CHAT_HISTORY) }));
        break;

      case "guess:correct":
        set((s) => ({
          room: patchPlayers(s.room, (p) =>
            p.id === message.playerId ? { ...p, hasGuessed: true } : p,
          ),
        }));
        break;

      case "scores:update":
        set((s) => ({
          scores: message.scores,
          room: patchPlayers(s.room, (p) => {
            const entry = message.scores.find((e) => e.playerId === p.id);
            return entry ? { ...p, score: entry.score } : p;
          }),
        }));
        break;

      case "react":
        set({ lastReaction: { playerId: message.playerId, emoji: message.emoji, ts: Date.now() } });
        break;

      case "game:over":
        set((s) => ({
          leaderboard: message.leaderboard,
          scores: message.leaderboard,
          room: patchRoom(s.room, { phase: "game-over" }),
        }));
        break;

      case "error":
        set({ lastError: { code: message.code, message: message.message } });
        break;

      case "pong":
        break;
    }
  },
}));

function scoresFrom(state: PublicRoomState): ScoreEntry[] {
  return state.players
    .map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      roundPoints: 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/* ---------------- selector helpers (cheap, stable) ---------------- */

export const selectStatus = (s: RoomStore): ConnectionStatus => s.status;
export const selectRoom = (s: RoomStore): PublicRoomState | null => s.room;
export const selectPlayers = (s: RoomStore): Player[] => s.room?.players ?? [];
export const selectChat = (s: RoomStore): ChatMessage[] => s.chat;
export const selectScores = (s: RoomStore): ScoreEntry[] => s.scores;
export const selectStrokes = (s: RoomStore): Stroke[] => s.strokes;

/** True when the local player is the active drawer and the turn is live. */
export const selectCanDraw = (s: RoomStore): boolean =>
  s.room?.phase === "drawing" && s.room?.drawerId === s.youId && s.youId !== null;
