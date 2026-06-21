import React from "react";
import { View } from "react-native";
import { useDrawCanvas, useTheme } from "../integration/GameDepsContext";
import { selectIsDrawer } from "../state/selectors";
import type { RoomSnapshot } from "../state/types";
import { Txt } from "./primitives";
import { ReactionsLayer } from "./ReactionsLayer";
import { TurnRevealOverlay } from "./TurnRevealOverlay";

/**
 * Hosts Agent C's `<DrawCanvas/>` and layers the reveal overlay + floating
 * reactions on top. The canvas is only editable for the active drawer; its
 * drawing tools live inside C's component.
 */
export function CanvasStage({ snapshot }: { snapshot: RoomSnapshot }): React.JSX.Element {
  const theme = useTheme();
  const DrawCanvas = useDrawCanvas();
  const isDrawer = selectIsDrawer(snapshot);
  const drawingNow = snapshot.room?.phase === "drawing" || snapshot.room?.phase === "reveal";

  return (
    <View style={{ flex: 1, padding: theme.spacing(3) }}>
      <View
        style={{
          flex: 1,
          borderRadius: theme.radius.lg,
          overflow: "hidden",
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <DrawCanvas editable={isDrawer && drawingNow} style={{ flex: 1 }} />
        <ReactionsLayer reactions={snapshot.reactions} />
        <TurnRevealOverlay snapshot={snapshot} />
      </View>

      {isDrawer && drawingNow ? (
        <View style={{ position: "absolute", top: theme.spacing(5), alignSelf: "center" }}>
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing(3),
              paddingVertical: 2,
            }}
          >
            <Txt variant="caption" color={theme.colors.textInverse} weight="800">
              Your turn to draw!
            </Txt>
          </View>
        </View>
      ) : null}
    </View>
  );
}
