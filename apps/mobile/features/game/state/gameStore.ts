/**
 * Pure reducer that folds the server's `ServerMessage` stream into a
 * {@link RoomSnapshot}. No React, no React Native — just the frozen contract.
 *
 * This doubles as the reference implementation of the room store that Agent C's
 * WS client feeds and Agent B's `useRoomStore` holds (see the handoff note). It
 * is exhaustively unit-tested against the exact frame sequence emitted by
 * `tools/mock-ws-server`.
 */
import type { Player, ScoreEntry, ServerMessage } from "@skribbl/shared";
import type { ReactionEvent, RoomSnapshot } from "./types";

/** Cap on retained chat history so long games don't grow unbounded. */
export const MAX_CHAT_HISTORY = 250;
/** Cap on simultaneously-tracked floating reactions. */
export const MAX_LIVE_REACTIONS = 48;

export function createInitialSnapshot(): RoomSnapshot {
  return {
    status: "idle",
    youId: null,
    room: null,
    maskedWord: null,
    wordLength: null,
    word: null,
    choices: null,
    guessedIds: [],
    youGuessedCorrect: false,
    scores: [],
    reveal: null,
    gameOver: null,
    chat: [],
    reactions: [],
    guessFeedback: null,
    error: null,
  };
}

/** Build a scoreboard from the player list when no `scores` frame has arrived. */
function scoresFromPlayers(players: readonly Player[]): ScoreEntry[] {
  return players
    .map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      roundPoints: 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Replace a player in the list, or append if new. */
function upsertPlayer(players: readonly Player[], player: Player): Player[] {
  const idx = players.findIndex((p) => p.id === player.id);
  if (idx === -1) return [...players, player];
  const next = [...players];
  next[idx] = player;
  return next;
}

function clampReactions(reactions: ReactionEvent[]): ReactionEvent[] {
  return reactions.length > MAX_LIVE_REACTIONS
    ? reactions.slice(reactions.length - MAX_LIVE_REACTIONS)
    : reactions;
}

/** Reset everything that is scoped to a single turn. */
function resetForNewTurn(snapshot: RoomSnapshot): Partial<RoomSnapshot> {
  return {
    guessedIds: [],
    youGuessedCorrect: false,
    reveal: null,
    guessFeedback: null,
    // Zero out the visible round deltas at the start of a turn; the server will
    // re-send `scores:update` as guesses come in.
    scores: snapshot.scores.map((s) => ({ ...s, roundPoints: 0 })),
  };
}

/**
 * Apply one server frame. `reactionId` is injected so callers (React / tests)
 * control id generation deterministically; defaults to a time+random id.
 */
export function applyServerMessage(
  snapshot: RoomSnapshot,
  msg: ServerMessage,
  now: () => number = Date.now,
  reactionId: () => string = defaultReactionId,
): RoomSnapshot {
  switch (msg.type) {
    case "room:state": {
      const state = msg.state;
      const isDrawer = msg.youId === state.drawerId;
      return {
        ...snapshot,
        youId: msg.youId,
        room: state,
        maskedWord: state.maskedWord,
        wordLength: state.wordLength,
        // The contract only ever fills `word` for the drawer; never trust it
        // for a guesser even if present.
        word: isDrawer ? (state.word ?? null) : null,
        choices: isDrawer && state.phase === "choosing" ? (state.wordChoices ?? null) : null,
        // Prefer an explicit scoreboard; otherwise derive from the roster.
        scores: snapshot.scores.length > 0 ? snapshot.scores : scoresFromPlayers(state.players),
        // Leaving a finished game back to lobby clears end-of-game UI.
        gameOver: state.phase === "game-over" ? snapshot.gameOver : null,
        reveal: state.phase === "reveal" ? snapshot.reveal : null,
      };
    }

    case "player:joined": {
      if (!snapshot.room) return snapshot;
      return {
        ...snapshot,
        room: { ...snapshot.room, players: upsertPlayer(snapshot.room.players, msg.player) },
      };
    }

    case "player:left": {
      if (!snapshot.room) return snapshot;
      return {
        ...snapshot,
        room: {
          ...snapshot.room,
          players: snapshot.room.players.filter((p) => p.id !== msg.playerId),
        },
        guessedIds: snapshot.guessedIds.filter((id) => id !== msg.playerId),
      };
    }

    case "host:changed": {
      if (!snapshot.room) return snapshot;
      return {
        ...snapshot,
        room: {
          ...snapshot.room,
          hostId: msg.hostId,
          players: snapshot.room.players.map((p) => ({ ...p, isHost: p.id === msg.hostId })),
        },
      };
    }

    case "turn:choosing": {
      const base = { ...snapshot, ...resetForNewTurn(snapshot) };
      return {
        ...base,
        choices: msg.choices,
        word: null,
        maskedWord: null,
        wordLength: null,
        room: snapshot.room
          ? {
              ...snapshot.room,
              phase: "choosing",
              currentRound: msg.round,
              drawerId: msg.drawerId,
              phaseEndsAt: msg.phaseEndsAt,
              word: null,
              wordChoices: snapshot.youId === msg.drawerId ? msg.choices : null,
            }
          : snapshot.room,
      };
    }

    case "turn:start": {
      const base = { ...snapshot, ...resetForNewTurn(snapshot) };
      return {
        ...base,
        maskedWord: msg.maskedWord,
        wordLength: msg.wordLength,
        word: msg.word, // null for everyone but the drawer (per contract)
        choices: null,
        room: snapshot.room
          ? {
              ...snapshot.room,
              phase: "drawing",
              currentRound: msg.round,
              drawerId: msg.drawerId,
              maskedWord: msg.maskedWord,
              wordLength: msg.wordLength,
              phaseEndsAt: msg.phaseEndsAt,
              word: msg.word,
            }
          : snapshot.room,
      };
    }

    case "turn:hint": {
      return {
        ...snapshot,
        maskedWord: msg.maskedWord,
        room: snapshot.room ? { ...snapshot.room, maskedWord: msg.maskedWord } : snapshot.room,
      };
    }

    case "turn:reveal": {
      return {
        ...snapshot,
        reveal: { word: msg.word, scores: msg.scores },
        scores: msg.scores,
        // Surface the real word to everyone during the reveal window.
        word: msg.word,
        // Enter the reveal phase immediately so the overlay shows without
        // waiting for the trailing room:state frame.
        room: snapshot.room ? { ...snapshot.room, phase: "reveal", word: msg.word } : snapshot.room,
      };
    }

    case "draw":
    case "draw:clear":
    case "draw:undo":
      // Drawing frames are consumed by Agent C's canvas, not the game store.
      return snapshot;

    case "scores:update": {
      return { ...snapshot, scores: msg.scores };
    }

    case "guess:correct": {
      const guessedIds = snapshot.guessedIds.includes(msg.playerId)
        ? snapshot.guessedIds
        : [...snapshot.guessedIds, msg.playerId];
      const isYou = msg.playerId === snapshot.youId;
      return {
        ...snapshot,
        guessedIds,
        youGuessedCorrect: snapshot.youGuessedCorrect || isYou,
        guessFeedback: isYou
          ? { kind: "correct", text: `+${msg.points} — you guessed it!`, at: now() }
          : snapshot.guessFeedback,
      };
    }

    case "chat": {
      const message = msg.message;
      const chat = [...snapshot.chat, message];
      const trimmed = chat.length > MAX_CHAT_HISTORY ? chat.slice(chat.length - MAX_CHAT_HISTORY) : chat;
      // A `close` frame is private to the guesser; treat it as live feedback.
      const guessFeedback =
        message.kind === "close"
          ? { kind: "close" as const, text: message.text, at: now() }
          : snapshot.guessFeedback;
      return { ...snapshot, chat: trimmed, guessFeedback };
    }

    case "react": {
      const reactions = clampReactions([
        ...snapshot.reactions,
        { id: reactionId(), playerId: msg.playerId, emoji: msg.emoji, at: now() },
      ]);
      return { ...snapshot, reactions };
    }

    case "game:over": {
      return { ...snapshot, gameOver: { leaderboard: msg.leaderboard }, scores: msg.leaderboard };
    }

    case "error": {
      return { ...snapshot, error: { code: msg.code, message: msg.message, at: now() } };
    }

    case "pong":
      return snapshot;

    default: {
      // Exhaustiveness guard — a new server frame must be handled explicitly.
      const _never: never = msg;
      return _never;
    }
  }
}

let reactionCounter = 0;
function defaultReactionId(): string {
  reactionCounter += 1;
  return `rx-${Date.now().toString(36)}-${reactionCounter}`;
}

/** Convenience: fold a whole sequence of frames (handy for tests/replays). */
export function reduceMessages(
  frames: readonly ServerMessage[],
  initial: RoomSnapshot = createInitialSnapshot(),
  now: () => number = Date.now,
): RoomSnapshot {
  return frames.reduce((snap, frame) => applyServerMessage(snap, frame, now), initial);
}
