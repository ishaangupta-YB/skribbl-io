import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, TextInput, View, type NativeSyntheticEvent, type TextInputSubmitEditingEventData } from "react-native";
import { GAME, type ChatKind, type ChatMessage } from "@skribbl/shared";
import { useTheme } from "../integration/GameDepsContext";
import { selectGuessLocked, selectIsDrawer, selectPhase } from "../state/selectors";
import type { GameTheme } from "../integration/contracts";
import type { RoomSnapshot } from "../state/types";
import { Button, Row, Txt } from "./primitives";

/**
 * Chat + guess panel. Renders messages styled per `kind`, locks the input once
 * the local guesser has guessed correctly, and surfaces the private "you're
 * close!" nudge.
 */
export function ChatPanel({
  snapshot,
  onSendChat,
}: {
  snapshot: RoomSnapshot;
  onSendChat: (text: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const locked = selectGuessLocked(snapshot);
  const isDrawer = selectIsDrawer(snapshot);
  const phase = selectPhase(snapshot);

  const colorByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of snapshot.room?.players ?? []) map.set(p.id, p.avatar.color);
    return map;
  }, [snapshot.room?.players]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
    return () => clearTimeout(id);
  }, [snapshot.chat.length]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendChat(trimmed.slice(0, GAME.MAX_CHAT_LEN));
    setText("");
  };

  const placeholder = locked
    ? "You guessed it! 🎉"
    : isDrawer
      ? "Chat with the room…"
      : phase === "drawing"
        ? "Type your guess…"
        : "Say something…";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing(3), gap: theme.spacing(2) }}
        keyboardShouldPersistTaps="handled"
      >
        {snapshot.chat.length === 0 ? (
          <Txt variant="caption" color={theme.colors.textMuted} align="center">
            No messages yet — say hi! 👋
          </Txt>
        ) : (
          snapshot.chat.map((m) => (
            <ChatRow key={m.id} message={m} theme={theme} nameColor={m.playerId ? colorByPlayer.get(m.playerId) : undefined} />
          ))
        )}
      </ScrollView>

      {snapshot.guessFeedback?.kind === "close" ? (
        <View style={{ backgroundColor: theme.colors.close, paddingVertical: theme.spacing(1), alignItems: "center" }}>
          <Txt variant="caption" color="#1A1D2E" weight="800">
            ✨ {snapshot.guessFeedback.text}
          </Txt>
        </View>
      ) : null}

      <Row
        gap={theme.spacing(2)}
        style={{
          padding: theme.spacing(3),
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!locked}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          maxLength={GAME.MAX_CHAT_LEN}
          returnKeyType="send"
          onSubmitEditing={(_e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => submit()}
          blurOnSubmit={false}
          style={{
            flex: 1,
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.spacing(4),
            paddingVertical: theme.spacing(2),
            fontSize: theme.font.md,
            opacity: locked ? 0.6 : 1,
          }}
        />
        <Button label="Send" onPress={submit} disabled={locked || text.trim().length === 0} variant="primary" />
      </Row>
    </View>
  );
}

function ChatRow({
  message,
  theme,
  nameColor,
}: {
  message: ChatMessage;
  theme: GameTheme;
  nameColor?: string;
}): React.JSX.Element {
  const accent = kindAccent(message.kind, theme);

  if (message.kind === "system") {
    return (
      <Txt variant="caption" color={theme.colors.system} align="center">
        {message.text}
      </Txt>
    );
  }

  if (message.kind === "correct" || message.kind === "close") {
    return (
      <View
        style={{
          alignSelf: "center",
          backgroundColor: accent,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing(3),
          paddingVertical: theme.spacing(1),
        }}
      >
        <Txt variant="caption" color="#0F1226" weight="800">
          {message.kind === "correct" ? "✅ " : "✨ "}
          {message.text}
        </Txt>
      </View>
    );
  }

  // Normal chat line.
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
      <Txt variant="caption" color={nameColor ?? theme.colors.primary} weight="800">
        {message.nickname}
      </Txt>
      <Txt variant="body" color={theme.colors.text} style={{ flexShrink: 1 }}>
        {message.text}
      </Txt>
    </View>
  );
}

function kindAccent(kind: ChatKind, theme: GameTheme): string {
  switch (kind) {
    case "correct":
      return theme.colors.correct;
    case "close":
      return theme.colors.close;
    default:
      return theme.colors.surfaceAlt;
  }
}
