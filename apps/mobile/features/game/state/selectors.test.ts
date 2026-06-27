import { describe, expect, it } from "vitest";
import { GAME, maskWord } from "@skribbl/shared";
import { applyServerMessage, createInitialSnapshot } from "./gameStore";
import { ALICE, BOB, YOU, mkPlayer, mkRoomState, scoreEntry } from "./fixtures";
import {
  CLOSE_FEEDBACK_TTL_MS,
  selectCanStart,
  selectCloseFeedback,
  selectCountdown,
  selectGuessLocked,
  selectIsDrawer,
  selectMustChooseWord,
  selectScoreboard,
  selectWordDisplay,
} from "./selectors";
import type { RoomSnapshot } from "./types";

function room(over: Parameters<typeof mkRoomState>[0] = {}, youId = YOU): RoomSnapshot {
  return applyServerMessage(createInitialSnapshot(), { type: "room:state", youId, state: mkRoomState(over) });
}

describe("selectCountdown", () => {
  it("derives seconds + elapsed fraction from phaseEndsAt", () => {
    const endsAt = 1_000_000;
    const s = room({ phase: "drawing", drawerId: ALICE, phaseEndsAt: endsAt, maskedWord: "_____", wordLength: 5 });
    const totalMs = GAME.DEFAULT_ROUND_DURATION_SEC * 1000;
    const c = selectCountdown(s, endsAt - 30_000); // 30s remaining
    expect(c.active).toBe(true);
    expect(c.secondsLeft).toBe(30);
    expect(c.fractionElapsed).toBeCloseTo((totalMs - 30_000) / totalMs, 5);
  });

  it("clamps to zero when the clock overruns", () => {
    const endsAt = 1_000_000;
    const s = room({ phase: "drawing", drawerId: ALICE, phaseEndsAt: endsAt });
    const c = selectCountdown(s, endsAt + 5_000);
    expect(c.secondsLeft).toBe(0);
    expect(c.fractionElapsed).toBe(1);
  });

  it("is inactive in the lobby", () => {
    expect(selectCountdown(room(), 0).active).toBe(false);
  });
});

describe("selectGuessLocked", () => {
  it("locks a guesser after a correct guess", () => {
    let s = room({ phase: "drawing", drawerId: ALICE });
    expect(selectGuessLocked(s)).toBe(false);
    s = applyServerMessage(s, { type: "guess:correct", playerId: YOU, nickname: "You", points: 100 });
    expect(selectGuessLocked(s)).toBe(true);
  });

  it("never locks the drawer", () => {
    const s = room({ phase: "drawing", drawerId: YOU });
    expect(selectGuessLocked(s)).toBe(false);
    expect(selectIsDrawer(s)).toBe(true);
  });
});

describe("selectWordDisplay", () => {
  it("shows blanks to a guesser", () => {
    const s = room({ phase: "drawing", drawerId: ALICE, maskedWord: maskWord("tiger"), wordLength: 5 });
    const d = selectWordDisplay(s);
    expect(d.revealed).toBe(false);
    expect(d.length).toBe(5);
    expect(d.slots.join("")).toBe("_____");
  });

  it("shows the real word to the drawer", () => {
    let s = createInitialSnapshot();
    s = applyServerMessage(s, {
      type: "turn:start",
      drawerId: YOU,
      round: 1,
      maskedWord: maskWord("tiger"),
      wordLength: 5,
      durationSec: 70,
      phaseEndsAt: 1,
      word: "tiger",
    });
    s = applyServerMessage(s, { type: "room:state", youId: YOU, state: mkRoomState({ phase: "drawing", drawerId: YOU, maskedWord: maskWord("tiger"), wordLength: 5, word: "tiger" }) });
    const d = selectWordDisplay(s);
    expect(d.revealed).toBe(true);
    expect(d.slots.join("")).toBe("tiger");
  });
});

describe("selectScoreboard", () => {
  it("sorts by score and flags drawer / guessed / you", () => {
    let s = room(
      {
        phase: "drawing",
        drawerId: ALICE,
        players: [mkPlayer(YOU, { isHost: true, score: 100 }), mkPlayer(ALICE, { isDrawing: true, score: 300 }), mkPlayer(BOB, { score: 200 })],
      },
    );
    s = { ...s, scores: [scoreEntry(ALICE, 300), scoreEntry(BOB, 200), scoreEntry(YOU, 100)] };
    s = applyServerMessage(s, { type: "guess:correct", playerId: BOB, nickname: "Bob", points: 200 });

    const rows = selectScoreboard(s);
    expect(rows.map((r) => r.playerId)).toEqual([ALICE, BOB, YOU]);
    expect(rows[0]?.rank).toBe(1);
    expect(rows.find((r) => r.playerId === ALICE)?.isDrawing).toBe(true);
    expect(rows.find((r) => r.playerId === BOB)?.hasGuessed).toBe(true);
    expect(rows.find((r) => r.playerId === YOU)?.isYou).toBe(true);
  });
});

describe("selectCloseFeedback", () => {
  const at = 1_000_000;
  const closeSnapshot = (): RoomSnapshot => ({
    ...createInitialSnapshot(),
    guessFeedback: { kind: "close", text: '"tigr" is close!', at },
  });

  it("returns the nudge within the TTL window", () => {
    const s = closeSnapshot();
    expect(selectCloseFeedback(s, at)).toEqual(s.guessFeedback);
    expect(selectCloseFeedback(s, at + CLOSE_FEEDBACK_TTL_MS - 1)).toEqual(s.guessFeedback);
  });

  it("expires exactly at the TTL boundary", () => {
    const s = closeSnapshot();
    expect(selectCloseFeedback(s, at + CLOSE_FEEDBACK_TTL_MS)).toBeNull();
    expect(selectCloseFeedback(s, at + CLOSE_FEEDBACK_TTL_MS + 5_000)).toBeNull();
  });

  it("ignores correct-guess feedback and empty feedback", () => {
    const correct: RoomSnapshot = {
      ...createInitialSnapshot(),
      guessFeedback: { kind: "correct", text: "+200 — you guessed it!", at },
    };
    expect(selectCloseFeedback(correct, at)).toBeNull();
    expect(selectCloseFeedback(createInitialSnapshot(), at)).toBeNull();
  });
});

describe("host / drawer affordances", () => {
  it("host can start with enough players", () => {
    const s = room({ phase: "lobby" });
    expect(selectCanStart(s)).toBe(true);
  });

  it("host cannot start below the minimum", () => {
    const s = room({ phase: "lobby", players: [mkPlayer(YOU, { isHost: true })], hostId: YOU });
    expect(selectCanStart(s)).toBe(false);
  });

  it("drawer must choose a word during choosing", () => {
    const s = room({ phase: "choosing", drawerId: YOU });
    const withChoices = { ...s, choices: ["cat", "dog", "sun"] };
    expect(selectMustChooseWord(withChoices)).toBe(true);
  });
});
