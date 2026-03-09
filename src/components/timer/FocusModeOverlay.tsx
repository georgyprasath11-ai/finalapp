import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { useAppStore, getTimerElapsedMs } from "@/store/app-store";
import { useTimerStore } from "@/store/zustand";
import { formatStudyTime } from "@/utils/format";

const quotes = [
  "Small progress each day becomes big results.",
  "Discipline beats motivation when motivation fades.",
  "Start where you are. Keep going.",
  "Focus is a superpower in a distracted world.",
  "One session at a time, one win at a time.",
  "What you repeat daily defines your future.",
  "Effort compounds faster than you think.",
  "Deep work today, freedom tomorrow.",
  "Done with focus is better than perfect later.",
  "Your future self will thank you for this session.",
] as const;

interface FocusModeOverlayProps {
  exitFocusMode: () => void;
}

export function FocusModeOverlay({ exitFocusMode }: FocusModeOverlayProps) {
  const now = useNow(250);
  const { data } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.timer.taskId);

  const quote = useMemo(() => {
    const index = Math.floor(Math.random() * quotes.length);
    return quotes[index] ?? quotes[0];
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        exitFocusMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitFocusMode]);

  if (!data) {
    return null;
  }

  const resolvedTaskId = activeTaskId ?? data.timer.taskId;
  const activeTask = resolvedTaskId ? data.tasks.find((task) => task.id === resolvedTaskId) ?? null : null;
  const subjectId = activeTask?.subjectId ?? data.timer.subjectId;
  const subject = subjectId ? data.subjects.find((item) => item.id === subjectId) ?? null : null;
  const elapsedSeconds = Math.max(0, Math.floor(getTimerElapsedMs(data.timer, now) / 1000));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="space-y-4 text-center">
        <p className="text-2xl font-semibold">{activeTask?.title ?? "Free Study"}</p>
        <p className="font-display text-7xl tabular-nums">{formatStudyTime(elapsedSeconds)}</p>
        {subject ? (
          <div className="flex justify-center">
            <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
              <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
              {subject.name}
            </Badge>
          </div>
        ) : null}
      </div>

      <p className="max-w-sm text-center text-sm italic text-muted-foreground">{quote}</p>

      <Button variant="outline" onClick={exitFocusMode}>
        Exit Focus Mode
      </Button>
    </div>
  );
}
