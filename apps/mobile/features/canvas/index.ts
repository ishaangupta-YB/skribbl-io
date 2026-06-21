/**
 * `features/canvas` — the realtime Skia drawing board (Agent C).
 *
 * Public surface for Agent D's game screen:
 * - {@link DrawingBoard}: drop-in board wired to a `RoomConnection`.
 * - {@link DrawCanvas}: the presentational Skia surface (if you need finer control).
 * - {@link Toolbar}: color / brush / eraser / undo / clear controls.
 * - {@link CanvasKitProvider}: wrap the web app to load CanvasKit (WASM).
 * - {@link useDrawingBoard}: tool + stroke orchestration hook.
 */
export { DrawingBoard, type DrawingBoardProps } from "./DrawingBoard";
export { DrawCanvas, type DrawCanvasProps } from "./components/DrawCanvas";
export { Toolbar, type ToolbarProps } from "./components/Toolbar";
export { CanvasKitProvider, type CanvasKitProviderProps } from "./CanvasKitProvider";
export {
  useDrawingBoard,
  type DrawingBoardController,
  type CurrentStroke,
  type UseDrawingBoardArgs,
} from "./hooks/useDrawingBoard";
export { StrokeBatcher, type DrawMode, type StrokeStyle } from "./lib/strokeBatcher";
export { toNormalized, toPixels, clamp01, type Size } from "./lib/coords";
export { buildSkiaPath } from "./lib/path";
export {
  PALETTE,
  BRUSH_SIZES,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND,
  DEFAULT_WIDTH,
  DEFAULT_MODE,
} from "./constants";
