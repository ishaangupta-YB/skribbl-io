import { DEFAULT_ROOM_ID_LEN, ROOM_ID_ALPHABET } from "./constants";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

/**
 * Generate a shareable room code. `random` is injectable so the server can use a
 * crypto RNG and tests can use a deterministic one.
 */
export function generateRoomId(
  len: number = DEFAULT_ROOM_ID_LEN,
  random: () => number = Math.random,
): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += ROOM_ID_ALPHABET.charAt(Math.floor(random() * ROOM_ID_ALPHABET.length));
  }
  return out;
}

/** Fisher–Yates shuffle returning a new array (does not mutate the input). */
export function shuffle<T>(input: readonly T[], random: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}
