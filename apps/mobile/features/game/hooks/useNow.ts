import { useEffect, useState } from "react";

/**
 * A ticking clock. Returns `Date.now()` refreshed every `intervalMs` while
 * `active`, so countdowns derived from `phaseEndsAt` stay live without the
 * server pushing a frame every second.
 */
export function useNow(active = true, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  const [prevActive, setPrevActive] = useState(active);

  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setNow(Date.now());
  }

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
