import { useEffect, useRef, useState } from "react";

/**
 * Returns a live timestamp (ms since epoch) that updates on the given interval.
 *
 * Memory optimisation — tab visibility throttling:
 *   When the tab is hidden (user switched tabs), the interval is automatically
 *   slowed to HIDDEN_INTERVAL_MS. This stops unnecessary React re-renders while
 *   the tab is in the background, drastically reducing CPU/memory usage.
 *   When the tab becomes visible again, a tick fires immediately so the display
 *   catches up without any visible delay.
 *
 * Sleep/wake protection:
 *   If the browser froze timers during sleep, a single tick can jump by many
 *   minutes or hours. We cap the forward jump at MAX_JUMP_MS per tick.
 *   The visibilitychange handler in app-store.tsx independently rebases the
 *   timer's startedAtMs so the total elapsed time stays accurate.
 */

const MAX_JUMP_MS = 30_000;       // 30 seconds — cap for sleep/wake jumps
const HIDDEN_INTERVAL_MS = 10_000; // 10 seconds when tab is not visible

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const intervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const real = Date.now();
      const delta = real - lastTickRef.current;
      lastTickRef.current = real;

      // Cap large jumps from sleep/wake (handled separately by app-store.tsx)
      if (delta > MAX_JUMP_MS) {
        setNow(real);
        return;
      }

      setNow(real);
    };

    const getInterval = () =>
      document.visibilityState === "hidden" ? HIDDEN_INTERVAL_MS : intervalMs;

    const startInterval = () => {
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
      }
      intervalIdRef.current = window.setInterval(tick, getInterval());
    };

    const handleVisibilityChange = () => {
      // Restart interval at the appropriate speed for the new visibility state
      startInterval();

      // If becoming visible, fire immediately so display is instant
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    startInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}
