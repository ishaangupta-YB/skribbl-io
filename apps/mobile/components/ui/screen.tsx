import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Apply horizontal/vertical padding. */
  padded?: boolean;
  /** Constrain content width and center it (nice on web/tablet). */
  contained?: boolean;
  edges?: readonly Edge[];
  className?: string;
  contentClassName?: string;
  contentContainerStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  contained = true,
  edges = ["top", "bottom"],
  className,
  contentClassName,
  contentContainerStyle,
}: ScreenProps) {
  const inner = (
    <View
      className={cn(
        "w-full flex-1",
        contained && "mx-auto max-w-2xl",
        padded && "px-5",
        contentClassName,
      )}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-background", className)}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={[{ flexGrow: 1, paddingVertical: 16 }, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          <View className="flex-1 py-4">{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
