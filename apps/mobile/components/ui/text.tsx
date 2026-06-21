import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/utils";

export type TextVariant =
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "caption"
  | "label";

const VARIANTS: Record<TextVariant, string> = {
  display: "text-4xl font-extrabold tracking-tight text-foreground",
  title: "text-2xl font-bold tracking-tight text-foreground",
  subtitle: "text-lg font-semibold text-foreground",
  body: "text-base text-foreground",
  caption: "text-sm text-muted-foreground",
  label: "text-sm font-semibold text-foreground",
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
