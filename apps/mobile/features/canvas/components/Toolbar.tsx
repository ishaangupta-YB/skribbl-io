import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { BRUSH_SIZES, PALETTE } from "../constants";
import type { DrawMode } from "../lib/strokeBatcher";

export interface ToolbarProps {
  color: string;
  width: number;
  mode: DrawMode;
  onSelectColor: (color: string) => void;
  onSelectWidth: (width: number) => void;
  onToggleEraser: () => void;
  onUndo: () => void;
  onClear: () => void;
  palette?: readonly string[];
  brushSizes?: readonly number[];
  style?: ViewStyle;
}

/**
 * Minimal, unopinionated drawing toolbar: color swatches, brush sizes, eraser
 * toggle, undo, and clear. Styled with plain primitives so Agent B can swap in
 * the design system / lucide icons later (see canvas-integration handoff).
 * Only shown to the active drawer.
 */
export function Toolbar({
  color,
  width,
  mode,
  onSelectColor,
  onSelectWidth,
  onToggleEraser,
  onUndo,
  onClear,
  palette = PALETTE,
  brushSizes = BRUSH_SIZES,
  style,
}: ToolbarProps): React.ReactElement {
  return (
    <View style={[styles.bar, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {palette.map((swatch) => {
          const selected = mode === "draw" && swatch.toLowerCase() === color.toLowerCase();
          return (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityLabel={`color ${swatch}`}
              onPress={() => onSelectColor(swatch)}
              style={[
                styles.swatch,
                { backgroundColor: swatch },
                selected && styles.swatchSelected,
              ]}
            />
          );
        })}
      </ScrollView>

      <View style={styles.row}>
        {brushSizes.map((size) => {
          const selected = size === width;
          return (
            <Pressable
              key={size}
              accessibilityRole="button"
              accessibilityLabel={`brush size ${size}`}
              onPress={() => onSelectWidth(size)}
              style={[styles.sizeButton, selected && styles.sizeButtonSelected]}
            >
              <View
                style={{
                  width: Math.min(size, 28),
                  height: Math.min(size, 28),
                  borderRadius: Math.min(size, 28) / 2,
                  backgroundColor: "#111827",
                }}
              />
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="eraser"
          onPress={onToggleEraser}
          style={[styles.actionButton, mode === "erase" && styles.actionButtonActive]}
        >
          <Text style={styles.actionLabel}>Erase</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="undo"
          onPress={onUndo}
          style={styles.actionButton}
        >
          <Text style={styles.actionLabel}>Undo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="clear canvas"
          onPress={onClear}
          style={styles.actionButton}
        >
          <Text style={styles.actionLabel}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 8,
    padding: 8,
    backgroundColor: "#F9FAFB",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#9CA3AF",
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: "#111827",
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
  },
  sizeButtonSelected: {
    borderColor: "#111827",
    borderWidth: 2,
  },
  actionButton: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
  },
  actionButtonActive: {
    backgroundColor: "#FDE68A",
    borderColor: "#D97706",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
});
