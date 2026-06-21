import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeOutUp, SlideInUp } from "react-native-reanimated";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react-native";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export type ToastVariant = "default" | "success" | "danger" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ACCENT: Record<ToastVariant, string> = {
  default: "border-l-muted-foreground",
  success: "border-l-success",
  danger: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-primary",
};

function ToastIcon({ variant, color }: { variant: ToastVariant; color: string }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 size={20} color={color} />;
    case "danger":
      return <XCircle size={20} color={color} />;
    case "warning":
      return <AlertTriangle size={20} color={color} />;
    default:
      return <Info size={20} color={color} />;
  }
}

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timers = (timersRef.current ??= new Map());
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }, []);

  const show = useCallback(
    ({ title, description, variant = "default", durationMs = 3200 }: ToastOptions) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, title, description, variant, durationMs }]);
      const timers = (timersRef.current ??= new Map());
      timers.set(id, setTimeout(() => dismiss(id), durationMs));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, variant: "success" }),
      error: (title, description) => show({ title, description, variant: "danger" }),
      info: (title, description) => show({ title, description, variant: "info" }),
    }),
    [show, dismiss],
  );

  const iconColor: Record<ToastVariant, string> = {
    default: colors.mutedForeground,
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
    info: colors.primary,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: insets.top + 8, left: 0, right: 0 }}
        className="items-center px-4"
      >
        <View pointerEvents="box-none" className="w-full max-w-md gap-2">
          {toasts.map((toast) => (
            <Animated.View key={toast.id} entering={SlideInUp.springify().damping(18)} exiting={FadeOutUp}>
              <Pressable onPress={() => dismiss(toast.id)}>
                <View
                  className={cn(
                    "flex-row items-start gap-3 rounded-2xl border border-border border-l-4 bg-card p-3.5",
                    ACCENT[toast.variant],
                  )}
                >
                  <View className="mt-0.5">
                    <ToastIcon variant={toast.variant} color={iconColor[toast.variant]} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">{toast.title}</Text>
                    {toast.description ? (
                      <Text className="mt-0.5 text-sm text-muted-foreground">{toast.description}</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
