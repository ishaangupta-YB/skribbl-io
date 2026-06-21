import type { Avatar } from "@skribbl/shared";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@/theme";

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

/** A short, friendly default nickname (≤ 16 chars) for first-run guests. */
export function randomGuestName(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Guest${n}`;
}

/** A random emoji + color avatar that satisfies `avatarSchema`. */
export function randomAvatar(): Avatar {
  return { emoji: pick(AVATAR_EMOJIS), color: pick(AVATAR_COLORS) };
}
