import { useEffect, useRef } from "react";
import type { GamePhase } from "@skribbl/shared";
import { useHaptics, useSound } from "../integration/GameDepsContext";
import { selectIsDrawer } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";

interface FxMemory {
  status: RoomSnapshot["status"];
  phase: GamePhase | null;
  youGuessed: boolean;
  guessedCount: number;
  playerCount: number;
  revealWord: string | null;
  gameOver: boolean;
  feedbackAt: number;
  reactionCount: number;
  tickSecond: number | null;
}

/**
 * Fires tasteful haptics + sound effects on meaningful game transitions
 * (connecting, players joining, your turn, guesses, final countdown ticks,
 * time-up, reveal, win, reactions). All effects route through the injected APIs
 * and respect the global sound/haptics toggles in Settings.
 */
export function useTurnFx(snapshot: RoomSnapshot, secondsLeft: number): void {
  const haptics = useHaptics();
  const sound = useSound();
  const mem = useRef<FxMemory>({
    status: "idle",
    phase: null,
    youGuessed: false,
    guessedCount: 0,
    playerCount: 0,
    revealWord: null,
    gameOver: false,
    feedbackAt: 0,
    reactionCount: 0,
    tickSecond: null,
  });

  useEffect(() => {
    const prev = mem.current;
    const phase = snapshot.room?.phase ?? null;
    const isDrawer = selectIsDrawer(snapshot);
    const playerCount = snapshot.room?.players.length ?? 0;

    // ---- connected / someone joined ----
    // Driven by server-pushed snapshot transitions, not a local UI event, so
    // these side effects belong in an effect (syncing with an external system).
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (snapshot.status === "open" && prev.status !== "open") {
      sound.play("join");
    }
    if (playerCount > prev.playerCount && prev.playerCount > 0) {
      sound.play("join");
      haptics.light();
    }

    // ---- phase transitions ----
    if (phase !== prev.phase) {
      if (phase === "choosing" && isDrawer) {
        sound.play("turnStart");
        haptics.medium();
      } else if (phase === "drawing") {
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
      status: snapshot.status,
      phase,
      youGuessed: snapshot.youGuessedCorrect,
      guessedCount: snapshot.guessedIds.length,
      playerCount,
      revealWord: snapshot.reveal?.word ?? null,
      gameOver: Boolean(snapshot.gameOver),
      feedbackAt: snapshot.guessFeedback?.at ?? prev.feedbackAt,
      reactionCount: snapshot.reactions.length,
      tickSecond: prev.tickSecond,
    };
  }, [snapshot, haptics, sound]);

  // ---- final-countdown ticks + time-up (last 5s of the drawing phase) ----
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const phase = snapshot.room?.phase;
    if (phase !== "drawing") {
      mem.current.tickSecond = null;
      return;
    }
    if (secondsLeft <= 5 && secondsLeft > 0 && mem.current.tickSecond !== secondsLeft) {
      mem.current.tickSecond = secondsLeft;
      sound.play("tick");
      haptics.selection();
      // react-doctor-disable-next-line react-doctor/no-event-handler
    } else if (secondsLeft === 0 && mem.current.tickSecond === 1) {
      mem.current.tickSecond = 0;
      sound.play("timeUp");
      haptics.warning();
    }
  }, [secondsLeft, snapshot, sound, haptics]);
}
