import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardList, Inbox, Sparkles, Timer as TimerIcon } from "lucide-react";
import { StudyProgressSection } from "@/components/dashboard/StudyProgressSection";
import { VerseCarousel } from "@/components/dashboard/VerseCarousel";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { computeGoalTotalsMs, msToHours } from "@/lib/goals";
import { useAppStore } from "@/store/app-store";
import { TaskPriority } from "@/types/models";
import { todayIsoDate } from "@/utils/date";
import { formatDuration, formatHours, formatMinutes, percentLabel } from "@/utils/format";

const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "border-rose-400/35 bg-rose-500/10 text-rose-200",
  medium: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  low: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
};

const trendTone = (deltaMs: number): string => {
  if (deltaMs > 0) {
    return "text-emerald-300";
  }

  if (deltaMs < 0) {
    return "text-rose-300";
  }

  return "text-muted-foreground";
};

const trendLabel = (deltaMs: number): string => {
  if (deltaMs === 0) {
    return "No change";
  }

  const prefix = deltaMs > 0 ? "+" : "-";
  return `${prefix}${formatDuration(Math.abs(deltaMs))}`;
};

export default function DashboardPage() {
  const { data, analytics } = useAppStore();
  const [animatedProductivity, setAnimatedProductivity] = useState(0);
  const today = todayIsoDate();

  const goalTotals = useMemo(() => {
    if (!data) {
      return { dailyMs: 0, weeklyMs: 0, monthlyMs: 0 };
    }

    return computeGoalTotalsMs(
      data.sessions
        .filter((session) => session.isActive !== true)
        .map((session) => ({
          endedAt: session.endedAt,
          durationMs: session.durationMs,
        })),
    );
  }, [data]);

  const todaysTasks = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.tasks
      .filter((task) => task.bucket === "daily" && !task.completed && (task.dueDate ?? today) <= today)
      .sort((a, b) => a.order - b.order)
      .slice(0, 6);
  }, [data, today]);

  const backlogTasks = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.tasks
      .filter((task) => task.bucket === "backlog" && !task.completed)
      .sort((a, b) => a.order - b.order)
      .slice(0, 6);
  }, [data]);

  const activeTasks = useMemo(() => {
    if (!data) {
      return 0;
    }

    return data.tasks.filter((task) => !task.completed).length;
  }, [data]);

  const subjectMap = useMemo(() => new Map((data?.subjects ?? []).map((subject) => [subject.id, subject])), [data?.subjects]);

  const productivityTarget = Math.round(Math.min(100, Math.max(0, analytics.productivityPercent)));

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setAnimatedProductivity(productivityTarget);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [productivityTarget]);

  const comparisons = useMemo(
    () => [
      {
        label: "Week",
        current: analytics.weeklyTotalMs,
        previous: analytics.previousWeekTotalMs,
        delta: analytics.weeklyTotalMs - analytics.previousWeekTotalMs,
      },
      {
        label: "Month",
        current: analytics.monthlyTotalMs,
        previous: analytics.previousMonthTotalMs,
        delta: analytics.monthlyTotalMs - analytics.previousMonthTotalMs,
      },
    ],
    [analytics.monthlyTotalMs, analytics.previousMonthTotalMs, analytics.previousWeekTotalMs, analytics.weeklyTotalMs],
  );

  const circleRadius = 56;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const dashOffset = circleCircumference * (1 - animatedProductivity / 100);

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <VerseCarousel />

      <StudyProgressSection
        dailyHours={msToHours(goalTotals.dailyMs)}
        weeklyHours={msToHours(goalTotals.weeklyMs)}
        monthlyHours={msToHours(goalTotals.monthlyMs)}
        dailyGoalHours={data.settings.goals.dailyHours}
        weeklyGoalHours={data.settings.goals.weeklyHours}
        monthlyGoalHours={data.settings.goals.monthlyHours}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today"
          value={formatDuration(analytics.todayStudyMs)}
          hint="Study time logged today"
          icon={<TimerIcon className="h-4 w-4" />}
        />
        <StatCard
          title="This Week"
          value={formatDuration(analytics.weeklyTotalMs)}
          hint="Mon-Sun total"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          title="This Month"
          value={formatDuration(analytics.monthlyTotalMs)}
          hint="Current month total"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          title="Active Tasks"
          value={`${activeTasks}`}
          hint="Open daily + backlog tasks"
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <TimerPanel />

        <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Productivity Circle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative mx-auto grid h-[13.5rem] w-[13.5rem] place-items-center">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                <circle cx="70" cy="70" r={circleRadius} className="fill-none stroke-border/60" strokeWidth="11" />
                <circle
                  cx="70"
                  cy="70"
                  r={circleRadius}
                  className="fill-none stroke-primary"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                />
              </svg>

              <div className="absolute text-center">
                <p className="font-display text-4xl leading-none tabular-nums">{percentLabel(animatedProductivity)}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Daily Capacity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/65 p-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Streak</p>
                <p className="mt-1 text-sm font-semibold">{analytics.streakDays} day(s)</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Best Day</p>
                <p className="mt-1 text-sm font-semibold">{analytics.bestDayLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Study Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comparisons.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/65 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">This {entry.label}</p>
                  <p className="text-xs text-muted-foreground">Last {entry.label}: {formatDuration(entry.previous)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatDuration(entry.current)}</p>
                  <p className={`text-xs font-medium tabular-nums ${trendTone(entry.delta)}`}>{trendLabel(entry.delta)}</p>
                </div>
              </div>
            ))}
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/65 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current Streak</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{analytics.streakDays} day(s)</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/65 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Best Day</p>
                <p className="mt-1 text-lg font-semibold">{analytics.bestDayLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.bestDayMinutes > 0 ? formatMinutes(analytics.bestDayMinutes) : "No study yet"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Goal Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Daily Goal</p>
              <p className="mt-1 font-semibold">
                {formatHours(msToHours(analytics.todayStudyMs))} / {formatHours(data.settings.goals.dailyHours)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Weekly Total</p>
              <p className="mt-1 font-semibold">{formatDuration(analytics.weeklyTotalMs)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Monthly Total</p>
              <p className="mt-1 font-semibold">{formatDuration(analytics.monthlyTotalMs)}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Tasks for Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {todaysTasks.length === 0 ? (
              <div className="grid min-h-[170px] place-items-center rounded-2xl border border-dashed border-border/70 bg-background/55 p-6 text-center">
                <div>
                  <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/70" />
                  <p className="mt-3 text-sm font-medium">No pending tasks for today</p>
                  <p className="mt-1 text-xs text-muted-foreground">You are clear for now. Add or reschedule tasks from Planner.</p>
                </div>
              </div>
            ) : (
              todaysTasks.map((task) => {
                const subject = task.subjectId ? subjectMap.get(task.subjectId) : null;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/65 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{subject?.name ?? "Unassigned"}</p>
                    </div>
                    <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 text-[11px] ${priorityBadgeClass[task.priority]}`}>
                      {task.priority}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Backlog Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {backlogTasks.length === 0 ? (
              <div className="grid min-h-[170px] place-items-center rounded-2xl border border-dashed border-border/70 bg-background/55 p-6 text-center">
                <div>
                  <Inbox className="mx-auto h-8 w-8 text-muted-foreground/70" />
                  <p className="mt-3 text-sm font-medium">Backlog is empty</p>
                  <p className="mt-1 text-xs text-muted-foreground">Capture future tasks in Backlog to keep your dashboard organized.</p>
                </div>
              </div>
            ) : (
              backlogTasks.map((task) => {
                const subject = task.subjectId ? subjectMap.get(task.subjectId) : null;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/65 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{subject?.name ?? "Unassigned"}</p>
                    </div>
                    <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 text-[11px] ${priorityBadgeClass[task.priority]}`}>
                      {task.priority}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
