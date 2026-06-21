export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/**
 * Tiny `clsx`-style class joiner for NativeWind `className`s. Later classes win
 * naturally because NativeWind resolves conflicting utilities left-to-right.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) out.push(key);
      }
    }
  }
  return out.join(" ");
}
