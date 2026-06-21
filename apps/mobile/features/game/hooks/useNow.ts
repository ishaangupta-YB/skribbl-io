import { useEffect, useState } from "react";

/**
 * A ticking clock. Returns `Date.now()` refreshed every `intervalMs` while
 * `active`, so countdowns derived from `phaseEndsAt` stay live without the
 * server pushing a frame every second.
 */
export function useNow(active = true, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
