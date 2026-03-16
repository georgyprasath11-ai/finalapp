import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play, Pause, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { canUseTimer, TaskType, TimerSnapshot } from "@/types/models";
import { useAppStore, getPhaseDurationMs, getTimerElapsedMs, getTimerPhaseElapsedMs } from "@/store/app-store";
import { useTimerStore } from "@/store/zustand";
import { useFocusModeContext } from "@/hooks/useFocusMode";
import { formatStudyTime } from "@/utils/format";

const phaseLabel = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
} as const;

const timerButtonClass = "h-11 min-w-[120px] rounded-xl px-4 transition-all duration-200";

interface TimerReadoutProps {
  timer: TimerSnapshot;
  phaseTone: string;
  phaseDuration: number;
  running: boolean;
  hasPausedSession: boolean;
}

const TimerReadout = memo(function TimerReadout({ timer, phaseTone, phaseDuration, running, hasPausedSession }: TimerReadoutProps) {
  const now = useNow(250);
  const reduceMotion = useReducedMotion();
  const elapsed = getTimerElapsedMs(timer, now);
  const phaseElapsed = getTimerPhaseElapsedMs(timer, now);
  const elapsedSeconds = Math.max(0, Math.floor(elapsed / 1000));
  const pomodoroPercent = phaseDuration > 0 ? Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100)) : 0;
  const statusLabel = running ? "Running" : hasPausedSession ? "Paused" : "Idle";

  const formatted = formatStudyTime(elapsedSeconds);
  const [flipKey, setFlipKey] = useState(0);
  const prevFormattedRef = useRef(formatted);

  useEffect(() => {
    if (prevFormattedRef.current !== formatted) {
      setFlipKey((prev) => prev + 1);
      prevFormattedRef.current = formatted;
    }
  }, [formatted]);

  return (
    <>
      <motion.div
        className={cn(
          "relative overflow-hidden rounded-[18px] border p-6 text-center transition-all duration-300 glass-card",
          "border-border/60 bg-secondary/25",
          running && "border-primary/45 bg-primary/10",
        )}
        animate={
          running && !reduceMotion
            ? { boxShadow: ["0 0 0 0 hsl(var(--primary)/0.3)", "0 0 24px 4px hsl(var(--primary)/0.15)"] }
            : { boxShadow: "0 0 0 0 transparent" }
        }
        transition={
          running && !reduceMotion
            ? { duration: 2.8, repeat: Infinity, repeatType: "reverse" }
            : { duration: 0 }
        }
      >
        {running ? <div className="pointer-events-none absolute inset-0 motion-safe:animate-timer-glow bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_68%)]" /> : null}

        <div className="relative z-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{phaseTone}</p>
          <p className="font-display text-[2.6rem] leading-none tracking-tight sm:text-[3.5rem] tabular-nums">
            {formatted.split("").map((char, index) => (
              <motion.span
                key={`${flipKey}-${index}-${char}`}
                className="inline-block"
                animate={reduceMotion ? undefined : { scaleY: [1, 0.7, 1] }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              >
                {char}
              </motion.span>
            ))}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className={cn("rounded-full border-border/70 px-3", running ? "border-primary/60 text-primary" : "") }>
              {statusLabel}
            </Badge>
            {timer.mode === "pomodoro" ? (
              <Badge variant="secondary" className="rounded-full border border-border/60 bg-secondary/45 px-3">
                Cycle {timer.cycleCount + 1}
              </Badge>
            ) : null}
          </div>
        </div>
      </motion.div>

      {timer.mode === "pomodoro" ? <Progress value={pomodoroPercent} className="h-2.5 rounded-full" /> : null}
    </>
  );
});

export const TimerPanel = memo(function TimerPanel() {
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
  const targetCycles = useTimerStore((state) => state.targetCycles);
  const setTargetCycles = useTimerStore((state) => state.setTargetCycles);
  const { enterFocusMode } = useFocusModeContext();
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [queuedTaskId, setQueuedTaskId] = useState<string>("");
  const [phaseBanner, setPhaseBanner] = useState<keyof typeof phaseLabel | null>(null);
  const reduceMotion = useReducedMotion();
  const prevPhaseRef = useRef<keyof typeof phaseLabel | null>(null);

  const phaseDuration = data ? getPhaseDurationMs(data.settings.timer, data.timer.phase) : 0;
  const phaseTone = useMemo(() => {
    if (!data) {
      return "Open Session";
    }

    return data.timer.mode === "pomodoro"
      ? `${phaseLabel[data.timer.phase]} ${formatStudyTime(Math.floor(phaseDuration / 1000))}`
      : "Open Session";
  }, [data, phaseDuration]);

  useEffect(() => {
    if (!data || data.timer.mode !== "pomodoro") {
      return;
    }

    if (prevPhaseRef.current && prevPhaseRef.current !== data.timer.phase) {
      setPhaseBanner(data.timer.phase);
      window.setTimeout(() => setPhaseBanner(null), 2000);
    }

    prevPhaseRef.current = data.timer.phase;
  }, [data]);

  if (!data) {
    return null;
  }

  const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]));
  const elapsedSeconds = Math.max(0, Math.floor(data.timer.accumulatedMs / 1000));

  const activeSession = data.sessions.find((session) => session.isActive === true) ?? null;

  const eligibleTasks = data.tasks
    .filter((task) => canUseTimer(task) && data.timer.subjectId !== null && !task.completed && task.subjectId === data.timer.subjectId)
    .sort((a, b) => a.title.localeCompare(b.title));

  const shortTermTasks = eligibleTasks.filter((task) => task.type === TaskType.SHORT_TERM);
  const longTermTasks = eligibleTasks.filter((task) => task.type === TaskType.LONG_TERM);
  const eligibleTaskIdSet = new Set(eligibleTasks.map((task) => task.id));

  const sessionTaskPickerOptions = data.tasks
    .filter((task) => canUseTimer(task) && !task.completed)
    .sort((a, b) => a.title.localeCompare(b.title));

  const hasSelectedSubject = data.timer.subjectId !== null;
  const hasEligibleTasks = eligibleTasks.length > 0;
  const hasValidTaskSelection = data.timer.taskId === null || eligibleTaskIdSet.has(data.timer.taskId);
  const taskSelectValue =
    hasSelectedSubject && hasEligibleTasks
      ? (hasValidTaskSelection ? data.timer.taskId ?? "none" : "none")
      : "";
  const canStart = hasSelectedSubject && hasEligibleTasks && hasValidTaskSelection;
  const canResume = hasSelectedSubject && hasValidTaskSelection;
  const running = data.timer.isRunning;
  const hasPausedSession =
    !running && activeSession !== null && activeSession.status === "paused" && activeSession.isActive === true;

  const showStart = !running && !hasPausedSession;
  const showPause = running;
  const showResume = hasPausedSession;
  const showStop = running || hasPausedSession;
  const canAppendTask = activeSession !== null;
  const hasCycleTarget = data.timer.mode === "pomodoro" && targetCycles !== null;
  const goalReached = hasCycleTarget && data.timer.cycleCount >= (targetCycles ?? Number.MAX_SAFE_INTEGER);

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
        <div className="relative">
          <AnimatePresence>
            {phaseBanner ? (
              <motion.div
                key={phaseBanner}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-0 right-0 top-0 z-10 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary"
              >
                {phaseLabel[phaseBanner]} phase
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

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
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Task</label>
            <Select
              value={taskSelectValue}
              onValueChange={(value) => selectTimerTask(value === "none" ? null : value)}
              disabled={!hasSelectedSubject}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/65">
                <SelectValue
                  placeholder={
                    !hasSelectedSubject
                      ? "Select subject first"
                      : hasEligibleTasks
                        ? "Attach subject task"
                        : "No tasks for this subject"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {!hasSelectedSubject ? (
                  <SelectItem value="__subject-required" disabled>
                    Select subject first
                  </SelectItem>
                ) : !hasEligibleTasks ? (
                  <SelectItem value="__no-tasks" disabled>
                    No tasks for this subject
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value="none">No task</SelectItem>

                    {shortTermTasks.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel className="pl-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Short-Term</SelectLabel>
                        {shortTermTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}

                    {shortTermTasks.length > 0 && longTermTasks.length > 0 ? <SelectSeparator /> : null}

                    {longTermTasks.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel className="pl-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Long-Term</SelectLabel>
                        {longTermTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            <span className="inline-flex w-full items-center justify-between gap-2">
                              <span>{task.title}</span>
                              <Badge className="rounded-full border border-sky-500/40 bg-sky-500/15 px-1.5 py-0 text-[10px] font-semibold text-sky-800 dark:text-sky-300">
                                Long
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TimerReadout
          timer={data.timer}
          phaseTone={phaseTone}
          phaseDuration={phaseDuration}
          running={running}
          hasPausedSession={hasPausedSession}
        />

        {data.timer.mode === "pomodoro" ? (
          <div className="space-y-2 rounded-2xl border border-border/60 bg-background/65 p-3">
            <label htmlFor="target-cycles-input" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Target rounds
            </label>
            <Input
              id="target-cycles-input"
              type="number"
              min={1}
              max={20}
              value={targetCycles ?? ""}
              onChange={(event) => {
                const next = event.target.value.trim();
                if (!next) {
                  setTargetCycles(null);
                  return;
                }

                const parsed = Number(next);
                setTargetCycles(Number.isFinite(parsed) ? parsed : null);
              }}
              placeholder="No target"
              className="max-w-[180px]"
            />
            <p className="text-xs text-muted-foreground">Set a goal number of focus rounds for this session</p>
            {goalReached ? (
              <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-200">
                🎉 Goal reached! {data.timer.cycleCount} rounds completed.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2.5">
          {showStart ? (
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.06 }}
              whileTap={reduceMotion ? undefined : { scale: 0.88 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <Button className={cn(timerButtonClass, "motion-safe:animate-pulse-glow")} onClick={startTimer} disabled={!canStart}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            </motion.div>
          ) : null}

          {showPause ? (
            <Button className={timerButtonClass} variant="outline" onClick={pauseTimer}>
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : null}

          {showResume ? (
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.06 }}
              whileTap={reduceMotion ? undefined : { scale: 0.88 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <Button className={timerButtonClass} onClick={resumeTimer} disabled={!canResume || !hasPausedSession}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            </motion.div>
          ) : null}

          {showStop ? (
            <motion.div
              whileTap={reduceMotion ? undefined : { scale: 0.88, rotate: 15 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <Button className={timerButtonClass} variant="destructive" onClick={stopTimer} disabled={elapsedSeconds <= 0}>
                <StopCircle className="h-4 w-4" />
                Stop
              </Button>
            </motion.div>
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

          <Button
            variant="outline"
            className={cn(timerButtonClass, "border-border/60 bg-background/65")}
            onClick={enterFocusMode}
          >
            Enter Focus Mode
          </Button>
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
});
