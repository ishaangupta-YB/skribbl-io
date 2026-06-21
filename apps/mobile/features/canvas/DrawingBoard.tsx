import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { selectStrokes, useRoomStore } from "../../lib/realtime/store";
import type { RoomConnection } from "../../lib/realtime/RoomConnection";
import { DrawCanvas } from "./components/DrawCanvas";
import { Toolbar } from "./components/Toolbar";
import { useDrawingBoard } from "./hooks/useDrawingBoard";
import { DEFAULT_BACKGROUND } from "./constants";

export interface DrawingBoardProps {
  /** Realtime connection (from `useRoomConnection`). Null while connecting. */
  connection: RoomConnection | null;
  /** Show the toolbar to the active drawer (default true). */
  showToolbar?: boolean;
  backgroundColor?: string;
  style?: ViewStyle;
  /** Override the draw-frame emit cadence (defaults to ~30fps). */
  emitIntervalMs?: number;
}

/**
 * Drop-in drawing board for the game screen (Agent D mounts this).
 *
 * Reads strokes from the shared store, gates input on whether the local player
 * is the active drawer, renders the Skia canvas + toolbar, and streams the
 * drawer's input to peers via the realtime connection. Guessers see a live,
 * read-only mirror of the drawer's strokes.
 *
 *   const room = useRoomConnection(roomId, identity);
 *   <DrawingBoard connection={room.connection} />
 */
export function DrawingBoard({
  connection,
  showToolbar = true,
  backgroundColor = DEFAULT_BACKGROUND,
  style,
  emitIntervalMs,
}: DrawingBoardProps): React.ReactElement {
  const strokes = useRoomStore(selectStrokes);
  const board = useDrawingBoard({ connection, emitIntervalMs });

  return (
    <View style={[styles.container, style]}>
      <DrawCanvas
        style={styles.canvas}
        strokes={strokes}
        current={board.current}
        enabled={board.canDraw}
        backgroundColor={backgroundColor}
        onStrokeStart={board.onStrokeStart}
        onStrokeMove={board.onStrokeMove}
        onStrokeEnd={board.onStrokeEnd}
      />
      {showToolbar && board.canDraw ? (
        <Toolbar
          color={board.color}
          width={board.width}
          mode={board.mode}
          onSelectColor={(c) => {
            board.setMode("draw");
            board.setColor(c);
          }}
          onSelectWidth={board.setWidth}
          onToggleEraser={board.toggleEraser}
          onUndo={board.undo}
          onClear={board.clear}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
