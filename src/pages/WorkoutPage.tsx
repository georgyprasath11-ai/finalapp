import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { DayContentProps } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Dumbbell, Pause, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoalProgressBar } from "@/components/common/GoalProgressBar";
import { useNow } from "@/hooks/useNow";
import { computeGoalTotalsMs, msToHours, normalizeGoalHours, toLocalIsoDate } from "@/lib/goals";
import {
  dailyWorkoutSeries,
  muscleDistributionSeries,
  weeklyWorkoutSeries,
  workoutStreakStats,
  workoutTrackedDays,
} from "@/lib/workout-analytics";
import { useAppStore } from "@/store/app-store";
import { WorkoutSession } from "@/types/models";
import { formatDuration, formatStudyTime } from "@/utils/format";
import { cn } from "@/lib/utils";

const toCalendarDate = (isoDate: string): Date => new Date(`${isoDate}T12:00:00`);
const EMPTY_WORKOUT_SESSIONS: WorkoutSession[] = [];
const EMPTY_MARKED_DAYS: string[] = [];

type GoalKey = "dailyHours" | "weeklyHours" | "monthlyHours";

export default function WorkoutPage() {
  const nowMs = useNow(250);
  const { data, addWorkoutSession, deleteWorkoutSession, toggleWorkoutMarkedDay, updateWorkoutGoals } = useAppStore();
  const reduceMotion = useReducedMotion();
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAtMs, setTimerStartedAtMs] = useState<number | null>(null);
  const [timerAccumulatedMs, setTimerAccumulatedMs] = useState(0);
  const [exerciseName, setExerciseName] = useState("");
  const [musclesInput, setMusclesInput] = useState("");
  const [draftExercises, setDraftExercises] = useState<Array<{ name: string; muscles: string[] }>>([]);
  const [recentSessionId, setRecentSessionId] = useState<string | null>(null);
  const previousSessionIdsRef = useRef<Set<string>>(new Set());
  const workoutSessions = data?.workout.sessions ?? EMPTY_WORKOUT_SESSIONS;
  const workoutMarkedDays = data?.workout.markedDays ?? EMPTY_MARKED_DAYS;

  const elapsedMs =
    timerRunning && timerStartedAtMs !== null
      ? timerAccumulatedMs + Math.max(0, nowMs - timerStartedAtMs)
      : timerAccumulatedMs;

  const trackedDays = useMemo(
    () => workoutTrackedDays(workoutSessions, workoutMarkedDays),
    [workoutMarkedDays, workoutSessions],
  );
  const trackedCalendarDays = useMemo(() => trackedDays.map(toCalendarDate), [trackedDays]);
  const workoutDayIndex = useMemo(() => {
    const map = new Map<string, number>();
    trackedDays.forEach((day, index) => {
      map.set(day, index);
    });
    return map;
  }, [trackedDays]);
  const streak = useMemo(() => workoutStreakStats(trackedDays), [trackedDays]);
  const selectedDayIso = selectedDay ? toLocalIsoDate(selectedDay) : null;
  const isSelectedMarked = selectedDayIso ? trackedDays.includes(selectedDayIso) : false;

  const totals = useMemo(
    () =>
      computeGoalTotalsMs(
        workoutSessions.map((session) => ({
          endedAt: session.endedAt,
          durationMs: session.durationMs,
        })),
      ),
    [workoutSessions],
  );

  const goalProgress = {
    daily: msToHours(totals.dailyMs),
    weekly: msToHours(totals.weeklyMs),
    monthly: msToHours(totals.monthlyMs),
  };

  const sortedSessions = useMemo(
    () =>
      [...workoutSessions].sort(
        (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
      ),
    [workoutSessions],
  );

  const muscleChart = useMemo(() => muscleDistributionSeries(workoutSessions), [workoutSessions]);
  const weeklyChart = useMemo(() => weeklyWorkoutSeries(workoutSessions, 8), [workoutSessions]);
  const dailyChart = useMemo(() => dailyWorkoutSeries(workoutSessions, 30), [workoutSessions]);

  useEffect(() => {
    const currentIds = new Set(workoutSessions.map((session) => session.id));
    if (previousSessionIdsRef.current.size === 0) {
      previousSessionIdsRef.current = currentIds;
      return;
    }

    let nextId: string | null = null;
    currentIds.forEach((id) => {
      if (!previousSessionIdsRef.current.has(id)) {
        nextId = id;
      }
    });

    if (nextId) {
      setRecentSessionId(nextId);
      window.setTimeout(() => {
        setRecentSessionId((current) => (current === nextId ? null : current));
      }, 800);
    }

    previousSessionIdsRef.current = currentIds;
  }, [workoutSessions]);

  if (!data) {
    return null;
  }

  const handleStart = () => {
    if (timerRunning) {
      return;
    }
    setTimerRunning(true);
    setTimerStartedAtMs(Date.now());
  };

  const handlePause = () => {
    if (!timerRunning) {
      return;
    }
    setTimerAccumulatedMs(elapsedMs);
    setTimerRunning(false);
    setTimerStartedAtMs(null);
  };

  const handleReset = () => {
    setTimerRunning(false);
    setTimerStartedAtMs(null);
    setTimerAccumulatedMs(0);
  };

  const addExercise = () => {
    const name = exerciseName.trim();
    if (!name) {
      return;
    }

    const muscles = Array.from(
      new Set(
        musclesInput
          .split(",")
          .map((muscle) => muscle.trim())
          .filter((muscle) => muscle.length > 0),
      ),
    );

    setDraftExercises((previous) => [...previous, { name, muscles }]);
    setExerciseName("");
    setMusclesInput("");
  };

  const saveWorkout = () => {
    if (elapsedMs <= 0) {
      return;
    }

    const endedAtMs = Date.now();
    addWorkoutSession({
      startedAt: new Date(endedAtMs - elapsedMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      durationMs: elapsedMs,
      exercises: draftExercises,
    });

    setDraftExercises([]);
    handleReset();
  };

  const updateGoal = (key: GoalKey, rawValue: string) => {
    const parsed = Number(rawValue);
    updateWorkoutGoals((previous) => ({
      ...previous,
      [key]: normalizeGoalHours(parsed, previous[key]),
    }));
  };

  const renderDayContent = (props: DayContentProps) => {
    const iso = toLocalIsoDate(props.date);
    const index = workoutDayIndex.get(iso) ?? 0;
    const delay = index * 0.02;
    if (!props.activeModifiers.workoutDay || reduceMotion) {
      return <span>{props.date.getDate()}</span>;
    }

    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2, delay }}
        className="inline-flex h-8 w-8 items-center justify-center"
      >
        {props.date.getDate()}
      </motion.span>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Workout Calendar & Streak</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[auto,1fr]">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            modifiers={{ workoutDay: trackedCalendarDays }}
            modifiersClassNames={{
              workoutDay: "bg-primary/15 text-primary font-semibold rounded-md",
            }}
            components={{
              DayContent: renderDayContent,
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
            }}
            className="rounded-xl border border-border/60 bg-secondary/10 p-3"
          />
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Current streak</p>
                <p className="text-xl font-semibold">{streak.currentStreak} day(s)</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Longest streak</p>
                <p className="text-xl font-semibold">{streak.longestStreak} day(s)</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Tracked days</p>
                <p className="text-xl font-semibold">{trackedDays.length}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-sm font-medium">
                {selectedDayIso
                  ? `${selectedDayIso} is ${isSelectedMarked ? "marked" : "not marked"}`
                  : "Choose a day to mark/unmark"}
              </p>
              <Button
                variant="outline"
                className="mt-2"
                disabled={!selectedDayIso}
                onClick={() => {
                  if (selectedDayIso) {
                    toggleWorkoutMarkedDay(selectedDayIso);
                  }
                }}
              >
                {isSelectedMarked ? "Unmark day" : "Mark day"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Workout Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-border/60 bg-secondary/20 p-4 text-center glass-card",
              timerRunning ? "border-primary/45 bg-primary/10" : "",
            )}
            animate={
              timerRunning && !reduceMotion
                ? { boxShadow: ["0 0 0 0 hsl(var(--primary)/0.3)", "0 0 24px 4px hsl(var(--primary)/0.15)"] }
                : { boxShadow: "0 0 0 0 transparent" }
            }
            transition={
              timerRunning && !reduceMotion
                ? { duration: 2.8, repeat: Infinity, repeatType: "reverse" }
                : { duration: 0 }
            }
          >
            {timerRunning ? (
              <div className="pointer-events-none absolute inset-0 motion-safe:animate-timer-glow bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_68%)]" />
            ) : null}
            <div className="relative z-10">
              <p className="text-sm text-muted-foreground">Current workout time</p>
              <p className="font-display text-5xl tracking-tight">{formatStudyTime(Math.floor(elapsedMs / 1000))}</p>
            </div>
          </motion.div>
          <div className="flex flex-wrap gap-2">
            {!timerRunning ? (
              <Button onClick={handleStart}>
                <Play className="mr-2 h-4 w-4" />
                {elapsedMs > 0 ? "Resume" : "Start"}
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePause}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button variant="ghost" onClick={handleReset} disabled={elapsedMs <= 0}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Workout Logging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Daily goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.workout.goals.dailyHours}
                onChange={(event) => updateGoal("dailyHours", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weekly goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.workout.goals.weeklyHours}
                onChange={(event) => updateGoal("weeklyHours", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.workout.goals.monthlyHours}
                onChange={(event) => updateGoal("monthlyHours", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-3">
            <GoalProgressBar
              label="Daily goal"
              completedHours={goalProgress.daily}
              goalHours={data.workout.goals.dailyHours}
            />
            <GoalProgressBar
              label="Weekly goal"
              completedHours={goalProgress.weekly}
              goalHours={data.workout.goals.weeklyHours}
            />
            <GoalProgressBar
              label="Monthly goal"
              completedHours={goalProgress.monthly}
              goalHours={data.workout.goals.monthlyHours}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <div className="space-y-1.5">
              <Label>Exercise name</Label>
              <Input
                value={exerciseName}
                onChange={(event) => setExerciseName(event.target.value)}
                placeholder="Example: Pushups"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Muscle groups (comma separated)</Label>
              <Input
                value={musclesInput}
                onChange={(event) => setMusclesInput(event.target.value)}
                placeholder="Chest, Triceps, Core"
              />
            </div>
            <Button className="self-end" variant="outline" onClick={addExercise} disabled={!exerciseName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          <AnimatePresence initial={false} mode="wait">
            {draftExercises.length === 0 ? (
              <motion.div
                key="workout-exercises-empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
              >
                <div className="rounded-2xl bg-muted/60 p-4">
                  <Dumbbell className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No exercises added yet</p>
                <p className="text-xs text-muted-foreground/70">Add one or more exercises before saving.</p>
              </motion.div>
            ) : (
              <motion.div key="workout-exercises-list" className="space-y-2">
                <AnimatePresence initial={false}>
                  {draftExercises.map((exercise, index) => (
                    <motion.div
                      key={`${exercise.name}-${index}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-start justify-between rounded-xl border border-border/60 bg-background/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.muscles.length > 0 ? exercise.muscles.join(", ") : "No muscles tagged"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDraftExercises((previous) => previous.filter((_, entryIndex) => entryIndex !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={saveWorkout} disabled={elapsedMs <= 0}>
            <Save className="mr-2 h-4 w-4" />
            Save Workout Session
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Workout History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 thin-scrollbar">
          {sortedSessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
            >
              <div className="rounded-2xl bg-muted/60 p-4">
                <Dumbbell className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No workout sessions saved yet</p>
              <p className="text-xs text-muted-foreground/70">Complete a workout timer to build your history.</p>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {sortedSessions.map((session) => {
                const ended = new Date(session.endedAt);
                const isRecent = session.id === recentSessionId;
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "rounded-xl border border-border/60 bg-background/70 p-3",
                      isRecent ? "motion-safe:animate-bounce-in" : "",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{formatDuration(session.durationMs)}</p>
                        <p className="text-xs text-muted-foreground">
                          {ended.toLocaleDateString()} at{" "}
                          {ended.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.exercises.length > 0
                            ? session.exercises.map((exercise) => exercise.name).join(", ")
                            : "No exercises logged"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteWorkoutSession(session.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Workout Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.workout.sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
            >
              <div className="rounded-2xl bg-muted/60 p-4">
                <Dumbbell className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No analytics yet</p>
              <p className="text-xs text-muted-foreground/70">Save workout sessions to populate charts.</p>
            </motion.div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-xl border-border/60 bg-background/70">
                <CardHeader>
                  <CardTitle className="text-sm">Time per Muscle Group</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={muscleChart} dataKey="minutes" nameKey="muscle" innerRadius={48} outerRadius={88} paddingAngle={2}>
                        {muscleChart.map((entry) => (
                          <Cell key={entry.muscle} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} min`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/60 bg-background/70">
                <CardHeader>
                  <CardTitle className="text-sm">Weekly Workout Time</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => `${value} min`} />
                      <Bar dataKey="minutes" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/60 bg-background/70">
                <CardHeader>
                  <CardTitle className="text-sm">Daily Consistency</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => `${value} min`} />
                      <Line type="monotone" dataKey="minutes" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
