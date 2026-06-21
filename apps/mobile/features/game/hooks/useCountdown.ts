import { selectCountdown } from "../state/selectors";
import type { Countdown, RoomSnapshot } from "../state/types";
import { useNow } from "./useNow";

/**
 * Live, server-synced countdown for the active timed phase. The clock is
 * authoritative server-side (`phaseEndsAt`); we only render `endsAt - now` and
 * re-sync whenever a fresh `room:state` updates the snapshot.
 */
export function useCountdown(snapshot: RoomSnapshot): Countdown {
  const active = snapshot.room?.phaseEndsAt != null;
  const now = useNow(active, 250);
  return selectCountdown(snapshot, now);
}
