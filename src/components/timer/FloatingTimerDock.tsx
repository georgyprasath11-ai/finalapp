import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Pause, Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import { useAppStore, getTimerElapsedMs } from "@/store/app-store";
import { useTimerStore } from "@/store/zustand";
import { formatStudyTime } from "@/utils/format";
import { cn } from "@/lib/utils";

export function FloatingTimerDock() {
  const location = useLocation();
  const now = useNow(500);
  const { data, startTimer, pauseTimer, resumeTimer, stopTimer } = useAppStore();
  const targetCycles = useTimerStore((state) => state.targetCycles);
  const [isScrolled, setIsScrolled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 220);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ping the timer worker the instant the tab becomes visible again.
  // The worker responds with PONG → useNow picks it up → FloatingTimerDock re-renders
  // with an accurate time in < 16ms rather than waiting for the next scheduled TICK.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.dispatchEvent(new CustomEvent("timer:request-worker-timestamp"));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const elapsedSeconds = useMemo(() => {
    if (!data) {
      return 0;
    }

    return Math.max(0, Math.floor(getTimerElapsedMs(data.timer, now) / 1000));
  }, [data, now]);

  if (!data) {
    return null;
  }

  const activeSession = data.sessions.find((session) => session.isActive === true) ?? null;
  const hasPausedSession = !data.timer.isRunning && activeSession?.status === "paused";
  const canShow = isScrolled && location.pathname !== "/dashboard" && (data.timer.isRunning || hasPausedSession || elapsedSeconds > 0);
  const showPomodoroGoal = data.timer.mode === "pomodoro" && targetCycles !== null;
  const goalReached = showPomodoroGoal && data.timer.cycleCount >= (targetCycles ?? Number.MAX_SAFE_INTEGER);

  return (
    <AnimatePresence>
      {canShow ? (
        <motion.div
          key="floating-timer-dock"
          initial={reduceMotion ? false : { opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 60 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 24 }}
          className="fixed bottom-4 right-4 z-50 w-[min(92vw,420px)] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-large backdrop-blur glass-card"
        >
          {data.timer.isRunning ? (
            <div className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl border border-primary/30 motion-safe:animate-dock-pulse" />
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sticky Timer</p>
              <p className="font-display text-2xl tabular-nums">{formatStudyTime(elapsedSeconds)}</p>
              {showPomodoroGoal ? (
                goalReached ? (
                  <Badge className="mt-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Goal complete
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="mt-1 rounded-full border border-border/60 bg-background/60">
                    {data.timer.cycleCount} / {targetCycles} rounds
                  </Badge>
                )
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={data.timer.isRunning ? "border-primary/60 text-primary" : ""}>
                {data.timer.isRunning ? "Running" : hasPausedSession ? "Paused" : "Idle"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setExpanded((prev) => !prev)}
                aria-label="Toggle timer details"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "rotate-0")} />
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div className="flex flex-wrap gap-2">
                  {data.timer.isRunning ? (
                    <Button variant="outline" size="sm" onClick={pauseTimer}>
                      <Pause className="mr-1.5 h-4 w-4" />
                      Pause
                    </Button>
                  ) : hasPausedSession ? (
                    <Button size="sm" onClick={resumeTimer}>
                      <Play className="mr-1.5 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button size="sm" onClick={startTimer}>
                      <Play className="mr-1.5 h-4 w-4" />
                      Start
                    </Button>
                  )}

                  <Button variant="destructive" size="sm" onClick={stopTimer} disabled={elapsedSeconds <= 0}>
                    <StopCircle className="mr-1.5 h-4 w-4" />
                    Stop
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
