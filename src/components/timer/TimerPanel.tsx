import { useMemo, useState } from "react";
import { Play, Pause, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { useAppStore, getPhaseDurationMs, getTimerElapsedMs, getTimerPhaseElapsedMs } from "@/store/app-store";
import { formatStudyTime } from "@/utils/format";

const phaseLabel = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
} as const;

const timerButtonClass = "h-11 min-w-[120px] rounded-xl px-4 transition-all duration-200";

export function TimerPanel() {
  const now = useNow(250);
  const {
    data,
    setTimerMode,
    selectTimerSubject,
    selectTimerTask,
    addTaskToActiveSession,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
  } = useAppStore();
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [queuedTaskId, setQueuedTaskId] = useState<string>("");

  const phaseDuration = data ? getPhaseDurationMs(data.settings.timer, data.timer.phase) : 0;
  const phaseTone = useMemo(() => {
    if (!data) {
      return "Open Session";
    }

    return data.timer.mode === "pomodoro"
      ? `${phaseLabel[data.timer.phase]} ${formatStudyTime(Math.floor(phaseDuration / 1000))}`
      : "Open Session";
  }, [data, phaseDuration]);

  if (!data) {
    return null;
  }

  const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]));
  const elapsed = getTimerElapsedMs(data.timer, now);
  const phaseElapsed = getTimerPhaseElapsedMs(data.timer, now);
  const elapsedSeconds = Math.max(0, Math.floor(elapsed / 1000));

  const activeSession = data.sessions.find((session) => session.isActive === true) ?? null;

  const dailyTasksForSubject = data.tasks.filter(
    (task) =>
      !task.completed && task.bucket === "daily" && (data.timer.subjectId === null || task.subjectId === data.timer.subjectId),
  );

  const sessionTaskPickerOptions = data.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.title.localeCompare(b.title));

  const pomodoroPercent = phaseDuration > 0 ? Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100)) : 0;

  const canStart = data.timer.subjectId !== null;
  const running = data.timer.isRunning;
  const hasPausedSession =
    !running && activeSession !== null && activeSession.status === "paused" && activeSession.isActive === true;

  const showStart = !running && !hasPausedSession;
  const showPause = running;
  const showResume = hasPausedSession;
  const showStop = running || hasPausedSession;
  const canAppendTask = activeSession !== null;

  const statusLabel = running ? "Running" : hasPausedSession ? "Paused" : "Idle";

  const onConfirmAddTask = () => {
    if (!queuedTaskId) {
      return;
    }

    const didAdd = addTaskToActiveSession(queuedTaskId);
    if (!didAdd) {
      return;
    }

    setQueuedTaskId("");
    setShowTaskPicker(false);
  };

  return (
    <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
      <CardHeader className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="font-display text-2xl sm:text-3xl">Study Timer</CardTitle>
          <CardDescription>Drift-resistant timing that keeps running across tab switches.</CardDescription>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/70 p-1.5">
          <Button
            size="sm"
            className="h-9 rounded-xl px-4"
            variant={data.timer.mode === "stopwatch" ? "default" : "ghost"}
            onClick={() => setTimerMode("stopwatch")}
          >
            Stopwatch
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-xl px-4"
            variant={data.timer.mode === "pomodoro" ? "default" : "ghost"}
            onClick={() => setTimerMode("pomodoro")}
          >
            Pomodoro
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subject</label>
            <Select value={data.timer.subjectId ?? ""} onValueChange={(value) => selectTimerSubject(value || null)}>
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/65">
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
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Task (optional)</label>
            <Select value={data.timer.taskId ?? "none"} onValueChange={(value) => selectTimerTask(value === "none" ? null : value)}>
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/65">
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

        <div
          className={cn(
            "relative overflow-hidden rounded-[18px] border p-6 text-center transition-all duration-300",
            "border-border/60 bg-secondary/25",
            running && "border-primary/45 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_18px_32px_hsl(var(--primary)/0.16)]",
          )}
        >
          {running ? <div className="pointer-events-none absolute inset-0 animate-timer-glow bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_68%)]" /> : null}

          <div className="relative z-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{phaseTone}</p>
            <p className="font-display text-[2.6rem] leading-none tracking-tight sm:text-[3.5rem] tabular-nums">
              {formatStudyTime(elapsedSeconds)}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className={cn("rounded-full border-border/70 px-3", running ? "border-primary/60 text-primary" : "") }>
                {statusLabel}
              </Badge>
              {data.timer.mode === "pomodoro" ? (
                <Badge variant="secondary" className="rounded-full border border-border/60 bg-secondary/45 px-3">
                  Cycle {data.timer.cycleCount + 1}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        {data.timer.mode === "pomodoro" ? <Progress value={pomodoroPercent} className="h-2.5 rounded-full" /> : null}

        <div className="flex flex-wrap gap-2.5">
          {showStart ? (
            <Button className={timerButtonClass} onClick={startTimer} disabled={!canStart}>
              <Play className="h-4 w-4" />
              Start
            </Button>
          ) : null}

          {showPause ? (
            <Button className={timerButtonClass} variant="outline" onClick={pauseTimer}>
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : null}

          {showResume ? (
            <Button className={timerButtonClass} onClick={resumeTimer} disabled={!canStart || !hasPausedSession}>
              <Play className="h-4 w-4" />
              Resume
            </Button>
          ) : null}

          {showStop ? (
            <Button className={timerButtonClass} variant="destructive" onClick={stopTimer} disabled={elapsedSeconds <= 0}>
              <StopCircle className="h-4 w-4" />
              Stop
            </Button>
          ) : null}

          {canAppendTask ? (
            <Button
              variant="outline"
              className={cn(timerButtonClass, "gap-2 border-border/60 bg-background/65 hover:-translate-y-0.5 hover:shadow-soft")}
              onClick={() => setShowTaskPicker((previous) => !previous)}
            >
              <Play className="h-4 w-4" />
              + Task
            </Button>
          ) : null}
        </div>

        {showTaskPicker ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Add Another Task</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground">Pick task</label>
                <Select value={queuedTaskId} onValueChange={setQueuedTaskId}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/80">
                    <SelectValue placeholder="Choose a task to continue in this session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTaskPickerOptions.map((task) => {
                      const subjectName = task.subjectId ? subjectMap.get(task.subjectId)?.name ?? "Unknown" : "Unassigned";
                      return (
                        <SelectItem key={task.id} value={task.id}>
                          {subjectName}: {task.title}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button className="h-11 rounded-xl px-5" onClick={onConfirmAddTask} disabled={!queuedTaskId}>
                  Add Task
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 rounded-xl px-5"
                  onClick={() => {
                    setQueuedTaskId("");
                    setShowTaskPicker(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
