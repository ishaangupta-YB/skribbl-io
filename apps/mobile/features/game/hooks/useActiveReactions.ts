import type { ReactionEvent } from "../state/types";
import { useNow } from "./useNow";

/** How long a floating reaction stays on screen. */
export const REACTION_LIFETIME_MS = 2600;

/**
 * Filters the accumulated reactions down to those still animating. The reducer
 * keeps a capped history; the floating layer only renders the recent ones.
 */
export function useActiveReactions(reactions: ReactionEvent[]): ReactionEvent[] {
  const now = useNow(reactions.length > 0, 200);
  return reactions.filter((r) => now - r.at < REACTION_LIFETIME_MS);
}
