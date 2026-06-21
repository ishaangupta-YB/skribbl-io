import { describe, expect, it } from "vitest";
import { GAME } from "./constants";
import { defaultRoomSettings } from "./schemas";
import { advanceTurn, isTimedPhase, phaseDurationSec } from "./state-machine";

describe("advanceTurn", () => {
  it("moves to the next drawer within a round", () => {
    expect(advanceTurn({ drawerIndex: 0, playerCount: 3, currentRound: 1, maxRounds: 3 })).toEqual({
      phase: "choosing",
      drawerIndex: 1,
      currentRound: 1,
    });
  });

  it("starts a new round after the last drawer", () => {
    expect(advanceTurn({ drawerIndex: 2, playerCount: 3, currentRound: 1, maxRounds: 3 })).toEqual({
      phase: "choosing",
      drawerIndex: 0,
      currentRound: 2,
    });
  });

  it("ends the game after the final round's last drawer", () => {
    expect(
      advanceTurn({ drawerIndex: 2, playerCount: 3, currentRound: 3, maxRounds: 3 }).phase,
    ).toBe("game-over");
  });
});

describe("phaseDurationSec", () => {
  it("uses the room setting for the drawing phase", () => {
    expect(phaseDurationSec("drawing", { ...defaultRoomSettings, roundDurationSec: 90 })).toBe(90);
  });

  it("uses constants for the other phases", () => {
    expect(phaseDurationSec("choosing", defaultRoomSettings)).toBe(GAME.WORD_CHOICE_DURATION_SEC);
    expect(phaseDurationSec("lobby", defaultRoomSettings)).toBe(0);
    expect(phaseDurationSec("game-over", defaultRoomSettings)).toBe(0);
  });
});

describe("isTimedPhase", () => {
  it("knows which phases run on a timer", () => {
    expect(isTimedPhase("drawing")).toBe(true);
    expect(isTimedPhase("choosing")).toBe(true);
    expect(isTimedPhase("lobby")).toBe(false);
    expect(isTimedPhase("game-over")).toBe(false);
  });
});
