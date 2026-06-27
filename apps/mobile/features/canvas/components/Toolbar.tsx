import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
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
  const { colors } = useTheme();

  const dynamicStyles = StyleSheet.create({
    bar: {
      gap: 8,
      padding: 8,
      backgroundColor: colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.mutedForeground,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: colors.foreground,
    },
    sizeButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.secondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sizeButtonSelected: {
      borderColor: colors.foreground,
      borderWidth: 2,
    },
    actionButton: {
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.secondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    brushDot: {
      backgroundColor: colors.foreground,
    },
  });

  const renderSwatch = useCallback(
    ({ item: swatch }: { item: string }) => {
      const selected = mode === "draw" && swatch.toLowerCase() === color.toLowerCase();
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`color ${swatch}`}
          onPress={() => onSelectColor(swatch)}
          style={[dynamicStyles.swatch, { backgroundColor: swatch }, selected && dynamicStyles.swatchSelected]}
        />
      );
    },
    [mode, color, onSelectColor, dynamicStyles],
  );

  return (
    <View style={[dynamicStyles.bar, style]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        data={palette as string[]}
        keyExtractor={(swatch) => swatch}
        renderItem={renderSwatch}
      />

      <View style={styles.row}>
        {brushSizes.map((size) => {
          const selected = size === width;
          return (
            <Pressable
              key={size}
              accessibilityRole="button"
              accessibilityLabel={`brush size ${size}`}
              onPress={() => onSelectWidth(size)}
              style={[dynamicStyles.sizeButton, selected && dynamicStyles.sizeButtonSelected]}
            >
              <View
                style={{
                  width: Math.min(size, 28),
                  height: Math.min(size, 28),
                  borderRadius: Math.min(size, 28) / 2,
                  backgroundColor: colors.foreground,
                }}
              />
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="eraser"
          onPress={onToggleEraser}
          style={[dynamicStyles.actionButton, mode === "erase" && dynamicStyles.actionButtonActive]}
        >
          <Text style={dynamicStyles.actionLabel}>Erase</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="undo"
          onPress={onUndo}
          style={dynamicStyles.actionButton}
        >
          <Text style={dynamicStyles.actionLabel}>Undo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="clear canvas"
          onPress={onClear}
          style={dynamicStyles.actionButton}
        >
          <Text style={dynamicStyles.actionLabel}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
