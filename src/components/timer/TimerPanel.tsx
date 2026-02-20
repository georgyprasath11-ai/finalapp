import { useMemo } from "react";
import { Play, Pause, RotateCcw, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { useAppStore, getPhaseDurationMs, getTimerElapsedMs, getTimerPhaseElapsedMs } from "@/store/app-store";
import { formatDuration } from "@/utils/format";

const phaseLabel = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
} as const;

export function TimerPanel() {
  const now = useNow(250);
  const {
    data,
    setTimerMode,
    selectTimerSubject,
    selectTimerTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
  } = useAppStore();

  const phaseDuration = data ? getPhaseDurationMs(data.settings.timer, data.timer.phase) : 0;
  const phaseTone = useMemo(() => {
    if (!data) {
      return "Open Session";
    }

    return data.timer.mode === "pomodoro"
      ? `${phaseLabel[data.timer.phase]} ${formatDuration(phaseDuration)}`
      : "Open Session";
  }, [data, phaseDuration]);

  if (!data) {
    return null;
  }

  const elapsed = getTimerElapsedMs(data.timer, now);
  const phaseElapsed = getTimerPhaseElapsedMs(data.timer, now);

  const dailyTasksForSubject = data.tasks.filter(
    (task) =>
      !task.completed && task.bucket === "daily" && (data.timer.subjectId === null || task.subjectId === data.timer.subjectId),
  );

  const pomodoroPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));

  const canStart = data.timer.subjectId !== null;
  const running = data.timer.isRunning;

  const handleReset = () => {
    const ok = resetTimer();
    if (ok) {
      return;
    }

    if (window.confirm("Reset the timer and clear the in-progress session?")) {
      resetTimer(true);
    }
  };

  return (
    <Card className="rounded-2xl border-border/70 bg-card/85 shadow-medium backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-display text-2xl">Study Timer</CardTitle>
          <CardDescription>Drift-resistant timing that keeps running across tab switches.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={data.timer.mode === "stopwatch" ? "default" : "outline"}
            onClick={() => setTimerMode("stopwatch")}
          >
            Stopwatch
          </Button>
          <Button
            size="sm"
            variant={data.timer.mode === "pomodoro" ? "default" : "outline"}
            onClick={() => setTimerMode("pomodoro")}
          >
            Pomodoro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Select value={data.timer.subjectId ?? ""} onValueChange={(value) => selectTimerSubject(value || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick subject" />
              </SelectTrigger>
              <SelectContent>
                {data.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                      {subject.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Task (optional)</label>
            <Select value={data.timer.taskId ?? "none"} onValueChange={(value) => selectTimerTask(value === "none" ? null : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Attach daily task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task</SelectItem>
                {dailyTasksForSubject.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 text-center">
          <p className="mb-1 text-sm text-muted-foreground">{phaseTone}</p>
          <p className="font-display text-5xl tracking-tight">{formatDuration(elapsed)}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Badge variant="outline" className={cn("rounded-full", running ? "border-primary text-primary" : "") }>
              {running ? "Running" : "Paused"}
            </Badge>
            {data.timer.mode === "pomodoro" ? (
              <Badge variant="secondary" className="rounded-full">
                Cycle {data.timer.cycleCount + 1}
              </Badge>
            ) : null}
          </div>
        </div>

        {data.timer.mode === "pomodoro" ? <Progress value={pomodoroPercent} className="h-2" /> : null}

        <div className="flex flex-wrap gap-2">
          {!running && elapsed === 0 ? (
            <Button onClick={startTimer} disabled={!canStart}>
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          ) : null}

          {running ? (
            <Button variant="outline" onClick={pauseTimer}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          ) : null}

          {!running && elapsed > 0 ? (
            <Button onClick={resumeTimer} disabled={!canStart}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          ) : null}

          <Button variant="secondary" onClick={stopTimer} disabled={elapsed <= 0}>
            <StopCircle className="mr-2 h-4 w-4" />
            Stop & Save
          </Button>

          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
