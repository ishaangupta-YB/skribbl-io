import { type ReactNode } from "react";
import { Modal as RNModal, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";
import { Text } from "./text";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** `sheet` slides up from the bottom; `center` is a centered dialog. */
  variant?: "sheet" | "center";
  /** Hide the default header/close button. */
  hideClose?: boolean;
  className?: string;
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  variant = "sheet",
  hideClose = false,
  className,
}: SheetProps) {
  const { colors } = useTheme();
  const isSheet = variant === "sheet";

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View className={cn("flex-1", isSheet ? "justify-end" : "items-center justify-center p-6")}>
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(160)}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(2,6,23,0.6)" }}
        >
          <Pressable accessibilityLabel="Close" className="flex-1" onPress={onClose} />
        </Animated.View>

        <Animated.View
          entering={(isSheet ? SlideInDown : ZoomIn).springify().damping(18)}
          exiting={isSheet ? SlideOutDown.duration(180) : ZoomOut.duration(140)}
          className={cn(isSheet ? "w-full" : "w-full max-w-md")}
        >
          <View
            className={cn(
              "border border-border bg-card p-5",
              isSheet ? "rounded-t-3xl pb-8" : "rounded-3xl",
              className,
            )}
          >
            {!hideClose || title ? (
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="subtitle">{title ?? ""}</Text>
                {!hideClose ? (
                  <IconButton variant="secondary" size="sm" onPress={onClose} accessibilityLabel="Close">
                    <X size={18} color={colors.foreground} />
                  </IconButton>
                ) : null}
              </View>
            ) : null}
            {children}
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
}
