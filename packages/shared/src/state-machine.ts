import { GAME } from "./constants";
import type { GamePhase, RoomSettings } from "./schemas";

/**
 * Pure description of the turn/round progression. The Durable Object holds the
 * authoritative state and schedules alarms; it uses these helpers so the rules
 * live in exactly one place.
 *
 * Phase flow per turn:
 *   choosing -> drawing -> reveal -> (next turn: choosing | game-over)
 * A "round" completes when every player has drawn once.
 */
export interface TurnContext {
  /** Index of the player who just finished drawing (in stable join order). */
  drawerIndex: number;
  playerCount: number;
  /** 1-based. */
  currentRound: number;
  maxRounds: number;
}

export interface TurnAdvance {
  phase: Extract<GamePhase, "choosing" | "game-over">;
  drawerIndex: number;
  currentRound: number;
}

export function advanceTurn(ctx: TurnContext): TurnAdvance {
  const nextDrawerIndex = ctx.drawerIndex + 1;
  if (nextDrawerIndex < ctx.playerCount) {
    return {
      phase: "choosing",
      drawerIndex: nextDrawerIndex,
      currentRound: ctx.currentRound,
    };
  }
  // Wrapped past the last player -> begin a new round.
  const nextRound = ctx.currentRound + 1;
  if (nextRound > ctx.maxRounds) {
    return {
      phase: "game-over",
      drawerIndex: ctx.drawerIndex,
      currentRound: ctx.currentRound,
    };
  }
  return { phase: "choosing", drawerIndex: 0, currentRound: nextRound };
}

/** Seconds the DO alarm should wait before advancing out of a timed phase. */
export function phaseDurationSec(phase: GamePhase, settings: RoomSettings): number {
  switch (phase) {
    case "choosing":
      return GAME.WORD_CHOICE_DURATION_SEC;
    case "drawing":
      return settings.roundDurationSec;
    case "reveal":
      return GAME.TURN_REVEAL_DURATION_SEC;
    case "round-end":
      return GAME.ROUND_END_DURATION_SEC;
    case "lobby":
    case "game-over":
    default:
      return 0;
  }
}

export const TIMED_PHASES: readonly GamePhase[] = ["choosing", "drawing", "reveal", "round-end"];

export function isTimedPhase(phase: GamePhase): boolean {
  return TIMED_PHASES.includes(phase);
}
