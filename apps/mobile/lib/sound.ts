import { useEffect, useRef } from "react";
import { useAudioPlayer } from "expo-audio";
import { useIdentity } from "@/lib/store";
import type { GameSoundName, SoundApi } from "@/features/game";

import joinWav from "../assets/sfx/join.wav";
import turnStartWav from "../assets/sfx/turn-start.wav";
import guessCloseWav from "../assets/sfx/guess-close.wav";
import guessCorrectWav from "../assets/sfx/guess-correct.wav";
import youGuessedWav from "../assets/sfx/you-guessed.wav";
import tickWav from "../assets/sfx/tick.wav";
import timeUpWav from "../assets/sfx/time-up.wav";
import revealWav from "../assets/sfx/reveal.wav";
import winWav from "../assets/sfx/win.wav";
import reactWav from "../assets/sfx/react.wav";

const SOUND_FILES: Record<GameSoundName, number> = {
  join: joinWav,
  turnStart: turnStartWav,
  guessClose: guessCloseWav,
  guessCorrect: guessCorrectWav,
  youGuessed: youGuessedWav,
  tick: tickWav,
  timeUp: timeUpWav,
  reveal: revealWav,
  win: winWav,
  react: reactWav,
};

type AudioPlayer = ReturnType<typeof useAudioPlayer>;

/**
 * Real sound effect engine using `expo-audio`. One player is preloaded per sound
 * so playback is near-instant; the global sound toggle in Settings is read from a
 * ref so the returned API object stays stable and does not re-render the game tree.
 */
export function useGameSound(): SoundApi {
  const join = useAudioPlayer(SOUND_FILES.join);
  const turnStart = useAudioPlayer(SOUND_FILES.turnStart);
  const guessClose = useAudioPlayer(SOUND_FILES.guessClose);
  const guessCorrect = useAudioPlayer(SOUND_FILES.guessCorrect);
  const youGuessed = useAudioPlayer(SOUND_FILES.youGuessed);
  const tick = useAudioPlayer(SOUND_FILES.tick);
  const timeUp = useAudioPlayer(SOUND_FILES.timeUp);
  const reveal = useAudioPlayer(SOUND_FILES.reveal);
  const win = useAudioPlayer(SOUND_FILES.win);
  const react = useAudioPlayer(SOUND_FILES.react);

  const playersRef = useRef<Record<GameSoundName, AudioPlayer>>({
    join,
    turnStart,
    guessClose,
    guessCorrect,
    youGuessed,
    tick,
    timeUp,
    reveal,
    win,
    react,
  });
  playersRef.current = { join, turnStart, guessClose, guessCorrect, youGuessed, tick, timeUp, reveal, win, react };

  const soundEnabledRef = useRef(useIdentity.getState().settings.sound);
  useEffect(
    () =>
      useIdentity.subscribe((state) => {
        soundEnabledRef.current = state.settings.sound;
      }),
    [],
  );

  const apiRef = useRef<SoundApi>({
    play: (name) => {
      if (!soundEnabledRef.current) return;
      const player = playersRef.current[name];
      if (!player) return;
      void player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => undefined);
    },
  });

  return apiRef.current;
}
