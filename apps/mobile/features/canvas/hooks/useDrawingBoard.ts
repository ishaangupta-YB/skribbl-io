import { useCallback, useEffect, useRef, useState } from "react";
import { clampInt, GAME, type Point, type Stroke } from "@skribbl/shared";
import { selectCanDraw, useRoomStore } from "../../../lib/realtime/store";
import type { RoomConnection } from "../../../lib/realtime/RoomConnection";
import { StrokeBatcher, type DrawMode } from "../lib/strokeBatcher";
import { DEFAULT_COLOR, DEFAULT_MODE, DEFAULT_WIDTH } from "../constants";

/** The in-progress stroke the local drawer is currently laying down. */
export interface CurrentStroke {
  points: Point[];
  color: string;
  width: number;
  mode: DrawMode;
}

export interface UseDrawingBoardArgs {
  /** The realtime connection used to broadcast draws (null while connecting). */
  connection: RoomConnection | null;
  /** Emit cadence for streamed `draw` frames (defaults to ~30fps). */
  emitIntervalMs?: number;
}

export interface DrawingBoardController {
  // tool state
  color: string;
  width: number;
  mode: DrawMode;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setMode: (mode: DrawMode) => void;
  toggleEraser: () => void;

  // gating + live stroke
  canDraw: boolean;
  current: CurrentStroke | null;

  // pointer lifecycle (called by <DrawCanvas/> with NORMALIZED 0–1 points)
  onStrokeStart: (point: Point) => void;
  onStrokeMove: (point: Point) => void;
  onStrokeEnd: () => void;

  // board actions
  clear: () => void;
  undo: () => void;
}

/**
 * Owns the drawing tools, the live in-progress stroke, point coalescing, and
 * the wiring between local input and the realtime layer.
 *
 * - Streams the active gesture to peers as throttled `draw` frames via the
 *   {@link StrokeBatcher} (peers stitch the segments back together).
 * - Commits the finished stroke optimistically to the store so the drawer sees
 *   their own line immediately (the server never echoes a frame to its sender).
 * - `clear`/`undo` update the store optimistically and notify the server.
 *
 * All inbound remote draw frames (`draw`/`draw:clear`/`draw:undo`/`turn:start`
 * reset) are applied by the store via the realtime hook, so this hook only
 * deals with the local user's input.
 */
export function useDrawingBoard({
  connection,
  emitIntervalMs,
}: UseDrawingBoardArgs): DrawingBoardController {
  const canDraw = useRoomStore(selectCanDraw);

  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [width, setWidthState] = useState<number>(DEFAULT_WIDTH);
  const [mode, setMode] = useState<DrawMode>(DEFAULT_MODE);
  const [current, setCurrent] = useState<CurrentStroke | null>(null);

  const batcherRef = useRef<StrokeBatcher | null>(null);
  // Keep the latest tool values available to the gesture callbacks.
  const styleRef = useRef({ color, width, mode });
  styleRef.current = { color, width, mode };

  const setWidth = useCallback((next: number) => {
    setWidthState(clampInt(next, GAME.MIN_STROKE_WIDTH, GAME.MAX_STROKE_WIDTH));
  }, []);

  const toggleEraser = useCallback(() => {
    setMode((m) => (m === "erase" ? "draw" : "erase"));
  }, []);

  const onStrokeStart = useCallback(
    (point: Point) => {
      if (!canDraw) return;
      const style = styleRef.current;
      const batcher = new StrokeBatcher({
        color: style.color,
        width: style.width,
        mode: style.mode,
        emitIntervalMs,
        onFlush: (segment) => connection?.sendDraw(segment),
      });
      batcher.begin(point);
      batcherRef.current = batcher;
      setCurrent({ points: [point], color: style.color, width: style.width, mode: style.mode });
    },
    [canDraw, connection, emitIntervalMs],
  );

  const onStrokeMove = useCallback((point: Point) => {
    const batcher = batcherRef.current;
    if (!batcher) return;
    batcher.addPoint(point);
    setCurrent((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev));
  }, []);

  const onStrokeEnd = useCallback(() => {
    const batcher = batcherRef.current;
    if (!batcher) return;
    batcher.end();
    batcherRef.current = null;
    setCurrent((prev) => {
      if (prev && prev.points.length > 0) {
        // Commit the completed stroke locally (server won't echo it back to us).
        const stroke: Stroke = {
          points: prev.points,
          color: prev.color,
          width: prev.width,
          mode: prev.mode,
        };
        useRoomStore.getState().applyDraw(stroke);
      }
      return null;
    });
  }, []);

  const clear = useCallback(() => {
    useRoomStore.getState().clearStrokes();
    connection?.clear();
  }, [connection]);

  const undo = useCallback(() => {
    useRoomStore.getState().undoStroke();
    connection?.undo();
  }, [connection]);

  // If we stop being the drawer mid-stroke, drop any dangling in-progress state.
  // Driven solely by `canDraw` so it reacts to losing drawer status rather than
  // chaining off the `current` stroke state it sets. `setCurrent(null)` is a
  // no-op when already null, so this never causes an extra render.
  useEffect(() => {
    if (!canDraw) {
      batcherRef.current = null;
      setCurrent(null);
    }
  }, [canDraw]);

  return {
    color,
    width,
    mode,
    setColor,
    setWidth,
    setMode,
    toggleEraser,
    canDraw,
    current,
    onStrokeStart,
    onStrokeMove,
    onStrokeEnd,
    clear,
    undo,
  };
}
