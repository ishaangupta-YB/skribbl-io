import { useEffect, useRef } from "react";
import type { GamePhase } from "@skribbl/shared";
import { useHaptics, useSound } from "../integration/GameDepsContext";
import type { RoomSnapshot } from "../state/types";

interface FxMemory {
  phase: GamePhase | null;
  youGuessed: boolean;
  guessedCount: number;
  revealWord: string | null;
  gameOver: boolean;
  feedbackAt: number;
  reactionCount: number;
  tickSecond: number | null;
}

/**
 * Fires tasteful haptics + sound effects on meaningful game transitions
 * (turn start, guesses, the final countdown ticks, reveal, win, reactions).
 * All effects route through the injected APIs, so they no-op until Agent B
 * wires expo-haptics / expo-av.
 */
export function useTurnFx(snapshot: RoomSnapshot, secondsLeft: number): void {
  const haptics = useHaptics();
  const sound = useSound();
  const mem = useRef<FxMemory>({
    phase: null,
    youGuessed: false,
    guessedCount: 0,
    revealWord: null,
    gameOver: false,
    feedbackAt: 0,
    reactionCount: 0,
    tickSecond: null,
  });

  useEffect(() => {
    const prev = mem.current;
    const phase = snapshot.room?.phase ?? null;

    // ---- phase transitions ----
    if (phase !== prev.phase) {
      if (phase === "drawing") {
        sound.play("turnStart");
        haptics.medium();
      } else if (phase === "reveal") {
        sound.play("reveal");
        haptics.light();
      }
    }

    // ---- your own correct guess ----
    if (snapshot.youGuessedCorrect && !prev.youGuessed) {
      sound.play("youGuessed");
      haptics.success();
    }

    // ---- someone else guessed correctly ----
    if (snapshot.guessedIds.length > prev.guessedCount && !snapshot.youGuessedCorrect) {
      sound.play("guessCorrect");
      haptics.light();
    }

    // ---- private close-guess nudge ----
    if (
      snapshot.guessFeedback?.kind === "close" &&
      snapshot.guessFeedback.at !== prev.feedbackAt
    ) {
      sound.play("guessClose");
      haptics.warning();
    }

    // ---- game over ----
    if (snapshot.gameOver && !prev.gameOver) {
      sound.play("win");
      haptics.heavy();
    }

    // ---- incoming reactions ----
    if (snapshot.reactions.length > prev.reactionCount) {
      sound.play("react");
    }

    mem.current = {
      phase,
      youGuessed: snapshot.youGuessedCorrect,
      guessedCount: snapshot.guessedIds.length,
      revealWord: snapshot.reveal?.word ?? null,
      gameOver: Boolean(snapshot.gameOver),
      feedbackAt: snapshot.guessFeedback?.at ?? prev.feedbackAt,
      reactionCount: snapshot.reactions.length,
      tickSecond: prev.tickSecond,
    };
  }, [snapshot, haptics, sound]);

  // ---- final-countdown ticks (last 5s of the drawing phase) ----
  useEffect(() => {
    const phase = snapshot.room?.phase;
    if (phase !== "drawing") {
      mem.current.tickSecond = null;
      return;
    }
    if (secondsLeft <= 5 && secondsLeft > 0 && mem.current.tickSecond !== secondsLeft) {
      mem.current.tickSecond = secondsLeft;
      sound.play("tick");
      haptics.selection();
    }
  }, [secondsLeft, snapshot, sound, haptics]);
}
