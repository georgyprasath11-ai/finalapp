// src/workers/timer-worker.ts
//
// Web Worker — Timer Tick Engine
//
// Runs in a dedicated OS thread separate from the main JavaScript thread.
// Chrome's background tab throttling does NOT apply to Web Workers.
// This means this setInterval keeps firing accurately even when:
//   - The user switches tabs for an extended time
//   - The user switches to BlueJ or another memory-heavy application
//   - The laptop goes to sleep and wakes up
//   - Chrome is under memory pressure and throttles the main thread
//
// MESSAGE PROTOCOL:
//   Main → Worker:  { type: "SET_INTERVAL", intervalMs: number }
//   Main → Worker:  { type: "PING" }
//   Worker → Main:  { type: "TICK", timestamp: number }
//   Worker → Main:  { type: "PONG", timestamp: number }

let intervalId: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 1000;

const startTicking = (intervalMs: number): void => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  currentIntervalMs = intervalMs;
  intervalId = setInterval(() => {
    self.postMessage({ type: "TICK", timestamp: Date.now() });
  }, currentIntervalMs);
};

// Begin ticking immediately at 1s on worker creation.
// The main thread will send SET_INTERVAL to adjust if needed.
startTicking(1000);

self.onmessage = (event: MessageEvent<{ type: string; intervalMs?: number }>): void => {
  const { type, intervalMs } = event.data;

  if (type === "SET_INTERVAL") {
    if (typeof intervalMs === "number" && intervalMs > 0) {
      startTicking(intervalMs);
    }
    return;
  }

  if (type === "PING") {
    // Respond immediately — the main thread uses this to get an authoritative
    // timestamp that was not affected by main-thread freeze or throttling.
    self.postMessage({ type: "PONG", timestamp: Date.now() });
  }
};
