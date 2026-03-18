import { useEffect, useRef, useState } from "react";

/**
 * Returns a live timestamp (ms since epoch) that updates on the given interval.
 *
 * Sleep/wake protection:
 *   If the tab was hidden and the browser throttled timers, a single tick can
 *   jump by many minutes or hours. To prevent a burst of catch-up renders
 *   crashing the UI, we cap the maximum forward jump per tick at MAX_JUMP_MS.
 *   The visibilitychange handler in app-store.tsx independently rebases the
 *   timer's startedAtMs so the total elapsed time stays accurate.
 */

const MAX_JUMP_MS = 30_000; // 30 seconds — anything larger is a sleep/wake event

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const real = Date.now();
      const delta = real - lastTickRef.current;

      if (delta > MAX_JUMP_MS) {
        // The tab was asleep. Advance by MAX_JUMP_MS only.
        // The visibilitychange handler in app-store.tsx will rebase the timer
        // snapshot so the displayed elapsed time remains correct.
        lastTickRef.current = real;
        setNow(real);
        return;
      }

      lastTickRef.current = real;
      setNow(real);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return now;
}
