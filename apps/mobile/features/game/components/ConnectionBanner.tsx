import React from "react";
import { View } from "react-native";
import { useTheme } from "../integration/GameDepsContext";
import type { ConnectionStatus } from "../state/types";
import { Txt } from "./primitives";

const MESSAGES: Partial<Record<ConnectionStatus, string>> = {
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  closed: "Disconnected",
};

/** Thin status banner shown whenever the socket is not cleanly open. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }): React.JSX.Element | null {
  const theme = useTheme();
  const message = MESSAGES[status];
  if (!message) return null;

  const color = status === "closed" ? theme.colors.danger : theme.colors.warning;
  return (
    <View style={{ backgroundColor: color, paddingVertical: theme.spacing(1), alignItems: "center" }}>
      <Txt variant="caption" color={theme.colors.text} weight="800">
        {message}
      </Txt>
    </View>
  );
}
