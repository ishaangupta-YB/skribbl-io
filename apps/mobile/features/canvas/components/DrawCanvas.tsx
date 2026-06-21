import React, { useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Canvas, Fill, Group, Path } from "@shopify/react-native-skia";
import type { Point, Stroke } from "@skribbl/shared";
import { toNormalized, type Size } from "../lib/coords";
import { buildSkiaPath } from "../lib/path";
import { DEFAULT_BACKGROUND } from "../constants";
import type { CurrentStroke } from "../hooks/useDrawingBoard";

export interface DrawCanvasProps {
  /** Committed strokes in normalized [0,1] space (remote + locally-committed). */
  strokes: Stroke[];
  /** The local drawer's in-progress stroke, rendered live. */
  current?: CurrentStroke | null;
  /** Whether touch input draws (true only for the active drawer). */
  enabled: boolean;
  backgroundColor?: string;
  onStrokeStart: (point: Point) => void;
  onStrokeMove: (point: Point) => void;
  onStrokeEnd: () => void;
  style?: ViewStyle;
}

interface RenderedStroke {
  stroke: Stroke;
  key: string;
}

/** A single stroke as a Skia <Path>; erase strokes punch through via BlendMode.Clear. */
function StrokePath({ stroke, size }: { stroke: Stroke; size: Size }): React.ReactElement | null {
  const path = useMemo(() => buildSkiaPath(stroke.points, size), [stroke.points, size]);
  if (size.width <= 0 || size.height <= 0) return null;
  return (
    <Path
      path={path}
      color={stroke.color}
      style="stroke"
      strokeWidth={stroke.width}
      strokeJoin="round"
      strokeCap="round"
      blendMode={stroke.mode === "erase" ? "clear" : "srcOver"}
    />
  );
}

/**
 * Cross-platform Skia drawing surface (iOS / Android / Web).
 *
 * Rendering and input both work in NORMALIZED [0,1] space: touch px are divided
 * by the measured canvas size before leaving this component, and strokes are
 * multiplied back up when drawn — so a drawing looks identical on every screen.
 * A transparent gesture overlay sits above the canvas and is pointer-transparent
 * when `enabled` is false, so non-drawers never capture touches.
 */
export function DrawCanvas({
  strokes,
  current,
  enabled,
  backgroundColor = DEFAULT_BACKGROUND,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  style,
}: DrawCanvasProps): React.ReactElement {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const rendered: RenderedStroke[] = useMemo(
    () => strokes.map((stroke, i) => ({ stroke, key: `s${i}` })),
    [strokes],
  );

  // `runOnJS` keeps handlers on the JS thread, so we don't need Reanimated
  // worklets — simpler and reliable across native + web.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(enabled)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => onStrokeStart(toNormalized(e.x, e.y, size)))
        .onUpdate((e) => onStrokeMove(toNormalized(e.x, e.y, size)))
        .onEnd(() => onStrokeEnd())
        .onFinalize(() => onStrokeEnd()),
    [enabled, size, onStrokeStart, onStrokeMove, onStrokeEnd],
  );

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color={backgroundColor} />
        <Group layer>
          {rendered.map(({ stroke, key }) => (
            <StrokePath key={key} stroke={stroke} size={size} />
          ))}
          {current && current.points.length > 0 ? (
            <StrokePath
              stroke={{
                points: current.points,
                color: current.color,
                width: current.width,
                mode: current.mode,
              }}
              size={size}
            />
          ) : null}
        </Group>
      </Canvas>
      <GestureDetector gesture={pan}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={enabled ? "auto" : "none"}
          collapsable={false}
        />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});
