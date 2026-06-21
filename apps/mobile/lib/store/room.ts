import type {
  ChatMessage,
  ErrorCode,
  Player,
  PublicRoomState,
  ScoreEntry,
  ServerMessage,
} from "@skribbl/shared";
import { create } from "zustand";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface Reaction {
  /** Monotonic id so the UI can key/animate each reaction. */
  id: number;
  playerId: string;
  emoji: string;
  ts: number;
}

export interface RoomError {
  code: ErrorCode | string;
  message: string;
}

const MAX_MESSAGES = 250;
const MAX_REACTIONS = 50;

interface RoomStoreState {
  status: ConnectionStatus;
  roomId: string | null;
  /** This client's server-assigned player id. */
  youId: string | null;
  /** Latest sanitized snapshot from the server. */
  room: PublicRoomState | null;
  messages: ChatMessage[];
  scores: ScoreEntry[];
  reactions: Reaction[];
  lastError: RoomError | null;

  // ---- connection actions (called by lib/realtime — Agent C) ----
  setStatus: (status: ConnectionStatus) => void;
  setRoomId: (roomId: string | null) => void;

  /**
   * Single entry point for the WS client: feed every validated
   * `ServerMessage` here and the store keeps the snapshot in sync.
   * NOTE: high-frequency `draw*` frames are intentionally ignored — the canvas
   * (Agent C) should subscribe to those directly for performance.
   */
  applyServerMessage: (msg: ServerMessage) => void;

  addMessage: (message: ChatMessage) => void;
  pushReaction: (playerId: string, emoji: string) => void;
  clearReactions: () => void;
  reset: () => void;
}

let reactionSeq = 0;

function replacePlayer(players: Player[], id: string, patch: Partial<Player>): Player[] {
  return players.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

/** Merge a `ScoreEntry[]` (authoritative scores) onto the players list. */
function applyScores(players: Player[], scores: ScoreEntry[]): Player[] {
  const byId = new Map(scores.map((s) => [s.playerId, s]));
  return players.map((p) => {
    const entry = byId.get(p.id);
    return entry ? { ...p, score: entry.score } : p;
  });
}

const initialState = {
  status: "idle" as ConnectionStatus,
  roomId: null,
  youId: null,
  room: null,
  messages: [] as ChatMessage[],
  scores: [] as ScoreEntry[],
  reactions: [] as Reaction[],
  lastError: null as RoomError | null,
};

export const useRoomStore = create<RoomStoreState>()((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setRoomId: (roomId) => set({ roomId }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message].slice(-MAX_MESSAGES) })),

  pushReaction: (playerId, emoji) =>
    set((state) => ({
      reactions: [
        ...state.reactions,
        { id: ++reactionSeq, playerId, emoji, ts: Date.now() },
      ].slice(-MAX_REACTIONS),
    })),

  clearReactions: () => set({ reactions: [] }),

  reset: () => set({ ...initialState }),

  applyServerMessage: (msg) => {
    const { room } = get();

    switch (msg.type) {
      case "room:state":
        set({ room: msg.state, youId: msg.youId, scores: [], status: "connected" });
        return;

      case "player:joined":
        if (!room) return;
        if (room.players.some((p) => p.id === msg.player.id)) {
          set({ room: { ...room, players: replacePlayer(room.players, msg.player.id, msg.player) } });
        } else {
          set({ room: { ...room, players: [...room.players, msg.player] } });
        }
        return;

      case "player:left":
        if (!room) return;
        set({ room: { ...room, players: room.players.filter((p) => p.id !== msg.playerId) } });
        return;

      case "host:changed":
        if (!room) return;
        set({
          room: {
            ...room,
            hostId: msg.hostId,
            players: room.players.map((p) => ({ ...p, isHost: p.id === msg.hostId })),
          },
        });
        return;

      case "turn:choosing":
        if (!room) return;
        set({
          room: {
            ...room,
            phase: "choosing",
            drawerId: msg.drawerId,
            currentRound: msg.round,
            phaseEndsAt: msg.phaseEndsAt,
            maskedWord: null,
            wordLength: null,
            word: null,
            wordChoices: msg.choices ?? null,
            players: room.players.map((p) => ({
              ...p,
              isDrawing: p.id === msg.drawerId,
              hasGuessed: false,
            })),
          },
        });
        return;

      case "turn:start":
        if (!room) return;
        set({
          room: {
            ...room,
            phase: "drawing",
            drawerId: msg.drawerId,
            currentRound: msg.round,
            phaseEndsAt: msg.phaseEndsAt,
            maskedWord: msg.maskedWord,
            wordLength: msg.wordLength,
            word: msg.word ?? null,
            wordChoices: null,
            players: room.players.map((p) => ({
              ...p,
              isDrawing: p.id === msg.drawerId,
              hasGuessed: false,
            })),
          },
        });
        return;

      case "turn:hint":
        if (!room) return;
        set({ room: { ...room, maskedWord: msg.maskedWord } });
        return;

      case "turn:reveal":
        set({
          scores: msg.scores,
          room: room
            ? {
                ...room,
                phase: "reveal",
                word: msg.word,
                maskedWord: msg.word,
                players: applyScores(room.players, msg.scores),
              }
            : room,
        });
        return;

      case "chat":
        get().addMessage(msg.message);
        return;

      case "guess:correct":
        if (!room) return;
        set({ room: { ...room, players: replacePlayer(room.players, msg.playerId, { hasGuessed: true }) } });
        return;

      case "scores:update":
        set({
          scores: msg.scores,
          room: room ? { ...room, players: applyScores(room.players, msg.scores) } : room,
        });
        return;

      case "react":
        get().pushReaction(msg.playerId, msg.emoji);
        return;

      case "game:over":
        set({ scores: msg.leaderboard, room: room ? { ...room, phase: "game-over" } : room });
        return;

      case "error":
        set({ lastError: { code: msg.code, message: msg.message } });
        return;

      // High-frequency draw frames + pong are handled outside the store.
      case "draw":
      case "draw:clear":
      case "draw:undo":
      case "pong":
        return;
    }
  },
}));
