import React from "react";
import { View } from "react-native";
import { useTheme } from "../integration/GameDepsContext";
import { selectIsDrawer, selectPhase, selectWordDisplay } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";
import { Row, Txt } from "./primitives";

/**
 * The word area: the drawer sees the real word, guessers see blanks (with any
 * progressively revealed hint letters). During the reveal everyone sees the
 * answer. A small pill shows the word length.
 */
export function WordBanner({ snapshot }: { snapshot: RoomSnapshot }): React.JSX.Element | null {
  const theme = useTheme();
  const phase = selectPhase(snapshot);
  const display = selectWordDisplay(snapshot);
  const youDraw = selectIsDrawer(snapshot);

  if (phase === "lobby" || phase === "game-over") return null;
  if (phase === "choosing") {
    return (
      <View style={{ alignItems: "center", paddingVertical: theme.spacing(3) }}>
        <Txt variant="caption" color={theme.colors.textMuted}>
          {youDraw ? "Pick a word to draw" : "Get ready to guess…"}
        </Txt>
      </View>
    );
  }

  const slotColor = display.revealed
    ? phase === "reveal"
      ? theme.colors.correct
      : theme.colors.text
    : theme.colors.text;

  return (
    <View style={{ alignItems: "center", paddingVertical: theme.spacing(3), gap: theme.spacing(1) }} testID="word-banner">
      <Txt variant="caption" color={theme.colors.textMuted}>
        {phase === "reveal"
          ? "The word was"
          : display.revealed
            ? "Your word"
            : "Guess the word"}
      </Txt>

      <Row gap={theme.spacing(2)} justify="center" style={{ flexWrap: "wrap", paddingHorizontal: theme.spacing(4) }}>
        {display.slots.map((ch, i) => (
          <WordSlot key={`${i}-${ch}`} char={ch} color={slotColor} revealed={display.revealed} />
        ))}
      </Row>

      {display.length > 0 ? (
        <Txt variant="caption" color={theme.colors.textMuted}>
          {display.length} letter{display.length === 1 ? "" : "s"}
        </Txt>
      ) : null}
    </View>
  );
}

function WordSlot({ char, color, revealed }: { char: string; color: string; revealed: boolean }): React.JSX.Element {
  const theme = useTheme();
  const isSpace = char.trim().length === 0;
  const isBlank = char === "_";

  if (isSpace) {
    return <View style={{ width: theme.spacing(3) }} />;
  }

  return (
    <View style={{ alignItems: "center", minWidth: 18 }}>
      <Txt
        variant="title"
        color={isBlank ? "transparent" : color}
        weight="800"
        style={{ letterSpacing: 1 }}
      >
        {isBlank ? "x" : char.toUpperCase()}
      </Txt>
      <View
        style={{
          height: 2,
          width: 18,
          marginTop: -2,
          borderRadius: 2,
          backgroundColor: revealed && !isBlank ? "transparent" : theme.colors.border,
        }}
      />
    </View>
  );
}
