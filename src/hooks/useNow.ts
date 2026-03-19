// src/hooks/useNow.ts
//
// Returns a live timestamp (ms since epoch) that updates on the given interval.
//
// Worker implementation (default):
//   Delegates ticking to a shared Web Worker thread. The worker is immune to
//   Chrome's background tab throttling, so the timestamp stays accurate even
//   when the user is away for an extended period (e.g., using BlueJ).
//
// Fallback implementation:
//   Used only when Web Workers are not available (extremely rare). Identical to
//   the original useNow.ts logic: main-thread setInterval with visibility throttling.
//
// Singleton pattern:
//   One worker is shared across ALL useNow instances in the app to avoid
//   creating multiple OS threads. All instances register listeners and the
//   worker ticks at the minimum of all requested intervals.

import { useEffect, useRef, useState } from "react";

// ─── Worker singleton ────────────────────────────────────────────────────────

let sharedWorker: Worker | null = null;
let workerFailed = false;

type TickListener = (timestamp: number) => void;
const tickListeners = new Set<TickListener>();
const activeIntervals = new Set<number>();
let currentWorkerIntervalMs = 1000;

function ensureWorker(): Worker | null {
  if (workerFailed) return null;
  if (sharedWorker) return sharedWorker;

  try {
    sharedWorker = new Worker(
      new URL("../workers/timer-worker.ts", import.meta.url),
      { type: "module" }
    );

    sharedWorker.onmessage = (e: MessageEvent<{ type: string; timestamp: number }>) => {
      const { type, timestamp } = e.data;

      if (type === "TICK") {
        // Distribute the tick to every mounted useNow instance
        tickListeners.forEach((fn) => fn(timestamp));
      }

      if (type === "PONG") {
        // Distribute to tick listeners (updates timer displays immediately)
        tickListeners.forEach((fn) => fn(timestamp));
        // Also fire a custom event so app-store.tsx can do a precision rebase
        window.dispatchEvent(
          new CustomEvent<number>("timer:worker-timestamp", { detail: timestamp })
        );
      }
    };

    sharedWorker.onerror = () => {
      console.warn("[useNow] Web Worker failed — using main-thread setInterval fallback.");
      workerFailed = true;
      sharedWorker = null;
    };

    // Listen for ping requests from app-store.tsx and FloatingTimerDock
    window.addEventListener("timer:request-worker-timestamp", () => {
      if (sharedWorker) {
        sharedWorker.postMessage({ type: "PING" });
      }
    });

    return sharedWorker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function syncWorkerInterval(): void {
  if (!sharedWorker || activeIntervals.size === 0) return;
  const minMs = Math.min(...activeIntervals);
  if (minMs !== currentWorkerIntervalMs) {
    currentWorkerIntervalMs = minMs;
    sharedWorker.postMessage({ type: "SET_INTERVAL", intervalMs: minMs });
  }
}

// ─── Worker-backed implementation ───────────────────────────────────────────

function useNowWorker(intervalMs: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  const mountedRef = useRef(true);
  const lastTickRef = useRef<number>(Date.now());
  const watchdogRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const worker = ensureWorker();
    if (!worker) return; // Worker not available — value stays at initial Date.now()

    const onTick: TickListener = (ts: number) => {
      if (!mountedRef.current) return;
      lastTickRef.current = ts;
      setNow(ts);
    };

    tickListeners.add(onTick);
    activeIntervals.add(intervalMs);
    syncWorkerInterval();

    // Catch up immediately on mount — do not wait for the next TICK message
    setNow(Date.now());

    // Watchdog: if no TICK arrives within 3× the expected interval, the worker
    // may be silently stalled. Fall back to a direct Date.now() call.
    const watchdogMs = Math.max(intervalMs * 3, 5000);
    watchdogRef.current = window.setInterval(() => {
      if (mountedRef.current && Date.now() - lastTickRef.current > watchdogMs) {
        setNow(Date.now());
      }
    }, watchdogMs);

    return () => {
      mountedRef.current = false;
      tickListeners.delete(onTick);
      activeIntervals.delete(intervalMs);
      syncWorkerInterval();
      if (watchdogRef.current !== null) {
        window.clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [intervalMs]);

  return now;
}

// ─── Fallback: main-thread setInterval ──────────────────────────────────────
// Identical to the original useNow.ts. Used only if workerFailed === true.

const MAX_JUMP_MS = 30_000;
const HIDDEN_INTERVAL_MS = 10_000;

function useNowFallback(intervalMs: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const real = Date.now();
      const delta = real - lastTickRef.current;
      lastTickRef.current = real;
      if (delta > MAX_JUMP_MS) {
        setNow(real);
        return;
      }
      setNow(real);
    };

    const effectiveInterval = () =>
      document.visibilityState === "hidden" ? HIDDEN_INTERVAL_MS : intervalMs;

    const restart = () => {
      if (idRef.current !== null) window.clearInterval(idRef.current);
      idRef.current = window.setInterval(tick, effectiveInterval());
    };

    const onVisibility = () => {
      restart();
      if (document.visibilityState === "visible") tick();
    };

    restart();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (idRef.current !== null) window.clearInterval(idRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}

// ─── HMR cleanup (development only) ─────────────────────────────────────────
// When Vite hot-replaces this module, terminate the old worker so a new one
// is created cleanly. Without this, HMR leaves orphaned worker threads.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (sharedWorker) {
      sharedWorker.terminate();
      sharedWorker = null;
    }
    tickListeners.clear();
    activeIntervals.clear();
  });
}

// ─── Public export ───────────────────────────────────────────────────────────
// `typeof Worker !== "undefined"` is evaluated once at module load time.
// This produces a permanent binding — no conditional hook calls per render.
// All 6 existing useNow call sites work without any modification.

export const useNow: (intervalMs?: number) => number =
  typeof Worker !== "undefined" ? useNowWorker : useNowFallback;
