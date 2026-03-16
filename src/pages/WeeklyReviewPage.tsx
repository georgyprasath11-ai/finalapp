import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Timer } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { useAppStore } from "@/store/app-store";
import { useWeeklyReviewStore } from "@/store/zustand";
import { TaskType } from "@/types/models";
import { formatDuration } from "@/utils/format";
import { startOfWeek, toLocalIsoDate } from "@/utils/date";

const formatWeekRangeLabel = (weekStartDate: Date, weekEndDate: Date): string => {
  const start = weekStartDate.toLocaleDateString([], { month: "short", day: "numeric" });
  const end = weekEndDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
};

const isoFromTimestamp = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toLocalIsoDate(date);
};

const isInRange = (isoDate: string | null, startIso: string, endIso: string): boolean =>
  Boolean(isoDate && isoDate >= startIso && isoDate <= endIso);

export default function WeeklyReviewPage() {
  const { data } = useAppStore();
  const { dailyTasks } = useDailyTaskStore();
  const reviews = useWeeklyReviewStore((state) => state.reviews);
  const saveReview = useWeeklyReviewStore((state) => state.saveReview);
  const getReviewForWeek = useWeeklyReviewStore((state) => state.getReviewForWeek);

  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [reflectionText, setReflectionText] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [showPastReflections, setShowPastReflections] = useState(false);

  const weekContext = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now);
    const selectedStart = new Date(currentWeekStart);
    selectedStart.setDate(selectedStart.getDate() + currentWeekOffset * 7);
    selectedStart.setHours(0, 0, 0, 0);

    const selectedEnd = new Date(selectedStart);
    selectedEnd.setDate(selectedEnd.getDate() + 6);
    selectedEnd.setHours(23, 59, 59, 999);

    const weekStartIso = toLocalIsoDate(selectedStart);
    const weekEndIso = toLocalIsoDate(selectedEnd);

    return {
      weekStartIso,
      weekEndIso,
      weekStartDate: selectedStart,
      weekEndDate: selectedEnd,
      weekRangeLabel: formatWeekRangeLabel(selectedStart, selectedEnd),
    };
  }, [currentWeekOffset]);

  const reviewForWeek = useMemo(
    () => getReviewForWeek(weekContext.weekStartIso),
    [getReviewForWeek, weekContext.weekStartIso],
  );

  useEffect(() => {
    setReflectionText(reviewForWeek?.reflection ?? "");
  }, [reviewForWeek?.reflection, weekContext.weekStartIso]);

  useEffect(() => {
    if (!savedNotice) {
      return;
    }

    const timeout = window.setTimeout(() => setSavedNotice(false), 3_000);
    return () => window.clearTimeout(timeout);
  }, [savedNotice]);

  if (!data) {
    return null;
  }

  const weeklySessions = data.sessions.filter((session) =>
    isInRange(isoFromTimestamp(session.endedAt), weekContext.weekStartIso, weekContext.weekEndIso),
  );
  const studyHoursMs = weeklySessions.reduce((total, session) => total + session.durationMs, 0);

  const completedTimedTasks = data.tasks.filter(
    (task) =>
      (task.type === TaskType.SHORT_TERM || task.type === TaskType.LONG_TERM) &&
      isInRange(isoFromTimestamp(task.completedAt), weekContext.weekStartIso, weekContext.weekEndIso),
  ).length;

  const dailyTasksDone = dailyTasks.filter((task) =>
    isInRange(isoFromTimestamp(task.completedAt), weekContext.weekStartIso, weekContext.weekEndIso),
  ).length;

  const workoutSessions = data.workout.sessions.filter((session) =>
    isInRange(isoFromTimestamp(session.endedAt), weekContext.weekStartIso, weekContext.weekEndIso),
  ).length;

  const subjectBreakdown = Object.values(
    weeklySessions.reduce<Record<string, { id: string; name: string; color: string; minutes: number }>>((acc, session) => {
      if (!session.subjectId) {
        return acc;
      }

      const subject = data.subjects.find((item) => item.id === session.subjectId);
      if (!subject) {
        return acc;
      }

      if (!acc[subject.id]) {
        acc[subject.id] = {
          id: subject.id,
          name: subject.name,
          color: subject.color,
          minutes: 0,
        };
      }

      acc[subject.id].minutes += session.durationMs / 60_000;
      return acc;
    }, {}),
  )
    .map((entry) => ({ ...entry, minutes: Number(entry.minutes.toFixed(1)) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const onSaveReflection = () => {
    saveReview(weekContext.weekStartIso, reflectionText.trim());
    setSavedNotice(true);
  };

  const pastReviews = reviews
    .filter((review) => review.weekStartIso !== weekContext.weekStartIso)
    .sort((a, b) => b.weekStartIso.localeCompare(a.weekStartIso));

  return (
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Weekly Review</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous week"
                onClick={() => setCurrentWeekOffset((value) => value - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next week"
                onClick={() => setCurrentWeekOffset((value) => Math.min(0, value + 1))}
                disabled={currentWeekOffset >= 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentWeekOffset(0)}
                disabled={currentWeekOffset === 0}
              >
                This Week
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{weekContext.weekRangeLabel}</p>
        </CardHeader>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Study Hours"
          value={formatDuration(studyHoursMs)}
          numericValue={studyHoursMs}
          formatValue={(value) => formatDuration(Math.round(value))}
          hint="Sessions ended this week"
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          title="Tasks Completed"
          value={`${completedTimedTasks}`}
          numericValue={completedTimedTasks}
          hint="Short-term and long-term"
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <StatCard
          title="Daily Tasks Done"
          value={`${dailyTasksDone}`}
          numericValue={dailyTasksDone}
          hint="Daily completions this week"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          title="Workout Sessions"
          value={`${workoutSessions}`}
          numericValue={workoutSessions}
          hint="Completed sessions"
          icon={<Dumbbell className="h-4 w-4" />}
        />
      </section>

      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Subject Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {subjectBreakdown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              No subject study sessions in this week.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectBreakdown} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(value) => `${value}m`} />
                <YAxis dataKey="name" type="category" width={110} />
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                  {subjectBreakdown.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Reflection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={6}
            value={reflectionText}
            maxLength={1000}
            onChange={(event) => setReflectionText(event.target.value)}
            placeholder="What went well this week? What should you improve next week?"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{reflectionText.length}/1000</p>
            <div className="flex items-center gap-2">
              {savedNotice ? <p className="text-xs text-emerald-300">Reflection saved ✓</p> : null}
              <Button type="button" onClick={onSaveReflection}>
                Save Reflection
              </Button>
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPastReflections((value) => !value)}
            >
              {showPastReflections ? "Hide past reflections" : "View past reflections"}
            </Button>
            {showPastReflections ? (
              pastReviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                  No previous reflections yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {pastReviews.map((review) => {
                    const startDate = new Date(`${review.weekStartIso}T00:00:00`);
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                    const weekLabel = formatWeekRangeLabel(startDate, endDate);

                    return (
                      <div key={review.id} className="rounded-xl border border-border/60 bg-background/65 px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{weekLabel}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-foreground">{review.reflection || "No reflection text"}</p>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
