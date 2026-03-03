import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import { useAppStore, getTimerElapsedMs } from "@/store/app-store";
import { formatStudyTime } from "@/utils/format";

export function FloatingTimerDock() {
  const location = useLocation();
  const now = useNow(500);
  const { data, startTimer, pauseTimer, resumeTimer, stopTimer } = useAppStore();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 220);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <AnimatePresence>
      {canShow ? (
        <motion.div
          key="floating-timer-dock"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 right-4 z-50 w-[min(92vw,420px)] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-large backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sticky Timer</p>
              <p className="font-display text-2xl tabular-nums">{formatStudyTime(elapsedSeconds)}</p>
            </div>

            <Badge variant="outline" className={data.timer.isRunning ? "border-primary/60 text-primary" : ""}>
              {data.timer.isRunning ? "Running" : hasPausedSession ? "Paused" : "Idle"}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
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
  );
}
