/**
 * Pure derivations over a {@link RoomSnapshot}. Kept separate from the reducer
 * so both the React layer and the test suite share identical display logic.
 */
import { GAME, clamp, type GamePhase, type Player } from "@skribbl/shared";
import type { Countdown, RoomSnapshot, ScoreRow } from "./types";

export function selectPhase(snapshot: RoomSnapshot): GamePhase {
  return snapshot.room?.phase ?? "lobby";
}

export function selectYou(snapshot: RoomSnapshot): Player | null {
  if (!snapshot.room || !snapshot.youId) return null;
  return snapshot.room.players.find((p) => p.id === snapshot.youId) ?? null;
}

export function selectDrawer(snapshot: RoomSnapshot): Player | null {
  const drawerId = snapshot.room?.drawerId ?? null;
  if (!snapshot.room || !drawerId) return null;
  return snapshot.room.players.find((p) => p.id === drawerId) ?? null;
}

export function selectIsDrawer(snapshot: RoomSnapshot): boolean {
  return snapshot.youId != null && snapshot.youId === snapshot.room?.drawerId;
}

export function selectIsHost(snapshot: RoomSnapshot): boolean {
  return snapshot.youId != null && snapshot.youId === snapshot.room?.hostId;
}

/**
 * Whether the guess/chat input should be locked. The drawer can always chat
 * (their messages are filtered server-side), but guessers are locked once they
 * have guessed correctly this turn.
 */
export function selectGuessLocked(snapshot: RoomSnapshot): boolean {
  if (selectPhase(snapshot) !== "drawing") return false;
  if (selectIsDrawer(snapshot)) return false;
  return snapshot.youGuessedCorrect;
}

/** Total duration (ms) of the currently-active timed phase. */
function activePhaseDurationMs(snapshot: RoomSnapshot): number {
  switch (selectPhase(snapshot)) {
    case "choosing":
      return GAME.WORD_CHOICE_DURATION_SEC * 1000;
    case "drawing":
      return (snapshot.room?.settings.roundDurationSec ?? GAME.DEFAULT_ROUND_DURATION_SEC) * 1000;
    case "reveal":
      return GAME.TURN_REVEAL_DURATION_SEC * 1000;
    default:
      return 0;
  }
}

/**
 * Server-authoritative countdown. Clients render `phaseEndsAt - now`; they
 * never decide when a phase ends (the DO / mock does).
 */
export function selectCountdown(snapshot: RoomSnapshot, now: number): Countdown {
  const endsAt = snapshot.room?.phaseEndsAt ?? null;
  const total = activePhaseDurationMs(snapshot);
  if (endsAt == null || total <= 0) {
    return { secondsLeft: 0, msLeft: 0, fractionElapsed: 0, active: false };
  }
  const msLeft = endsAt - now;
  const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const fractionElapsed = clamp((total - msLeft) / total, 0, 1);
  return { secondsLeft, msLeft, fractionElapsed, active: true };
}

/**
 * Sorted scoreboard with ranks + live drawing/guessed badges. Prefers an
 * explicit scoreboard frame and falls back to the roster, while always pulling
 * badge state from the live roster + per-turn guess tracking.
 */
export function selectScoreboard(snapshot: RoomSnapshot): ScoreRow[] {
  const players = snapshot.room?.players ?? [];
  const drawerId = snapshot.room?.drawerId ?? null;
  const guessed = new Set(snapshot.guessedIds);

  // `slice()` so we never mutate the snapshot's `scores` array in place.
  const entries =
    snapshot.scores.length > 0
      ? snapshot.scores.slice()
      : players.map((p) => ({
          playerId: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          score: p.score,
          roundPoints: 0,
        }));
  entries.sort((a, b) => b.score - a.score || b.roundPoints - a.roundPoints);

  return entries.map((entry, i) => {
    const player = players.find((p) => p.id === entry.playerId);
    return {
      rank: i + 1,
      playerId: entry.playerId,
      nickname: entry.nickname,
      avatar: entry.avatar,
      score: entry.score,
      roundPoints: entry.roundPoints,
      isDrawing: entry.playerId === drawerId,
      hasGuessed: guessed.has(entry.playerId) || Boolean(player?.hasGuessed),
      isYou: entry.playerId === snapshot.youId,
    };
  });
}

export interface WordDisplay {
  /** Characters to render: letters/blanks/spaces, one slot per char. */
  slots: string[];
  /** Number of letters in the word (shown as a hint to guessers). */
  length: number;
  /** True when the local player is the drawer (sees the real word). */
  revealed: boolean;
}

const SPACE = "\u2002"; // en-space, renders a clear word gap between slots

/**
 * The word area content. The drawer sees the real word; guessers see the
 * masked word (with progressively revealed hint letters). During `reveal`
 * everyone sees the answer.
 */
export function selectWordDisplay(snapshot: RoomSnapshot): WordDisplay {
  const phase = selectPhase(snapshot);
  const isDrawer = selectIsDrawer(snapshot);
  const length = snapshot.wordLength ?? 0;

  // Reveal phase: show the real word to all.
  if (phase === "reveal" && snapshot.reveal) {
    return { slots: toSlots(snapshot.reveal.word), length: snapshot.reveal.word.length, revealed: true };
  }
  // Drawer sees the actual word while drawing.
  if (isDrawer && snapshot.word) {
    return { slots: toSlots(snapshot.word), length: snapshot.word.length, revealed: true };
  }
  // Guessers see the mask (blanks + any revealed hint letters).
  if (snapshot.maskedWord) {
    return { slots: toSlots(snapshot.maskedWord), length, revealed: false };
  }
  return { slots: [], length, revealed: false };
}

function toSlots(word: string): string[] {
  return [...word].map((ch) => (/\s/u.test(ch) ? SPACE : ch));
}

/** How many letters of the masked word have been revealed (for a hint pill). */
export function selectRevealedHintCount(snapshot: RoomSnapshot): number {
  if (!snapshot.maskedWord) return 0;
  return [...snapshot.maskedWord].filter((ch) => /[a-z0-9]/iu.test(ch)).length;
}

/** Whether the local player is the drawer and must pick a word right now. */
export function selectMustChooseWord(snapshot: RoomSnapshot): boolean {
  return (
    selectPhase(snapshot) === "choosing" &&
    selectIsDrawer(snapshot) &&
    Array.isArray(snapshot.choices) &&
    snapshot.choices.length > 0
  );
}

/** Number of players still connected. */
export function selectPlayerCount(snapshot: RoomSnapshot): number {
  return snapshot.room?.players.length ?? 0;
}

/** Whether the host may start a game from the lobby / game-over screen. */
export function selectCanStart(snapshot: RoomSnapshot): boolean {
  const phase = selectPhase(snapshot);
  return (
    selectIsHost(snapshot) &&
    (phase === "lobby" || phase === "game-over") &&
    selectPlayerCount(snapshot) >= GAME.MIN_PLAYERS_TO_START
  );
}
