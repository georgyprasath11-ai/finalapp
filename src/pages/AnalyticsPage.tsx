import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, CalendarRange, CheckCircle2, CircleDashed, Flame, ListChecks, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyTaskStore } from "@/store/daily-task-store";

const statusColors = ["#10b981", "#f59e0b", "#f97316"];
const priorityColors = ["#ef4444", "#f59e0b", "#22c55e"];

const percent = (value: number): string => `${Math.round(value)}%`;
const progressBarClass = "h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-cyan-500";
const piePercentLabel = (entry: { name?: string; percent?: number }): string => {
  const label = entry.name ?? "Slice";
  const pct = Math.round((entry.percent ?? 0) * 100);
  return `${label}: ${pct}%`;
};

function useCountUp(target: number, durationMs = 650): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(target * progress);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, target]);

  return value;
}

export default function AnalyticsPage() {
  const { analytics, dailyTasks } = useDailyTaskStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoading(false), 260);
    return () => window.clearTimeout(timeout);
  }, [dailyTasks.length]);

  const completedTodayAnimated = useCountUp(analytics.todayCompleted);
  const remainingTodayAnimated = useCountUp(analytics.todayRemaining);
  const weeklyRateAnimated = useCountUp(analytics.weeklyCompletionRate);
  const monthlyRateAnimated = useCountUp(analytics.monthlyCompletionRate);
  const streakAnimated = useCountUp(analytics.currentStreak);

  const dailyRateAnimated = useCountUp(analytics.dailyCompletionRate);
  const yearlyRateAnimated = useCountUp(analytics.yearlyCompletionRate);

  const hasWeeklyData = analytics.weeklyCompletions.some((point) => point.completed > 0);
  const hasMonthlyData = analytics.monthlyCompletions.some((point) => point.completed > 0);
  const hasYearlyData = analytics.yearlyCompletions.some((point) => point.completed > 0);

  const statusPie = useMemo(
    () => [
      { name: "Completed", value: analytics.statusBreakdown.completed },
      { name: "Incomplete", value: analytics.statusBreakdown.incomplete },
      { name: "Rolled-over", value: analytics.statusBreakdown.rolledOver },
    ],
    [analytics.statusBreakdown],
  );

  const priorityPie = useMemo(
    () => [
      { name: "High", value: analytics.priorityBreakdown.high },
      { name: "Medium", value: analytics.priorityBreakdown.medium },
      { name: "Low", value: analytics.priorityBreakdown.low },
    ],
    [analytics.priorityBreakdown],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex justify-end text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{Math.round(completedTodayAnimated)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tasks completed today</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex justify-end text-muted-foreground">
              <CircleDashed className="h-4 w-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{Math.round(remainingTodayAnimated)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tasks remaining today</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex justify-end text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{percent(weeklyRateAnimated)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Weekly completion %</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex justify-end text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{percent(monthlyRateAnimated)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Monthly completion %</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardContent className="p-4">
            <div className="mb-2 flex justify-end text-muted-foreground">
              <Flame className="h-4 w-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{Math.round(streakAnimated)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Current streak (days)</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Completion Progress Bars</h2>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Today completion rate</span>
              <span className="font-semibold tabular-nums">{percent(dailyRateAnimated)}</span>
            </div>
            <Progress value={dailyRateAnimated} className={progressBarClass} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Weekly completion rate</span>
              <span className="font-semibold tabular-nums">{percent(weeklyRateAnimated)}</span>
            </div>
            <Progress value={weeklyRateAnimated} className={progressBarClass} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Monthly completion rate</span>
              <span className="font-semibold tabular-nums">{percent(monthlyRateAnimated)}</span>
            </div>
            <Progress value={monthlyRateAnimated} className={progressBarClass} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Yearly completion rate</span>
              <span className="font-semibold tabular-nums">{percent(yearlyRateAnimated)}</span>
            </div>
            <Progress value={yearlyRateAnimated} className={progressBarClass} />
          </div>
        </div>
      </section>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Weekly Completion Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {!hasWeeklyData ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">No weekly completion data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.weeklyCompletions}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Monthly Completion Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] overflow-x-auto">
          {!hasMonthlyData ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">No monthly completion data yet.</p>
          ) : (
            <div className="min-w-[860px] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyCompletions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Yearly Completion Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {!hasYearlyData ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">No yearly completion data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.yearlyCompletions}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Task Status Pie Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {statusPie.every((entry) => entry.value <= 0) ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">No status data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={112}
                  label={piePercentLabel}
                >
                  {statusPie.map((entry, index) => (
                    <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Tasks"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Priority Distribution Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {priorityPie.every((entry) => entry.value <= 0) ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">No priority data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={110}
                  label={piePercentLabel}
                >
                  {priorityPie.map((entry, index) => (
                    <Cell key={entry.name} fill={priorityColors[index % priorityColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Tasks"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Streak Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current streak</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.currentStreak}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Longest streak</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{analytics.longestStreak}</p>
            </div>
          </div>

          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
            {analytics.streakCalendar.map((entry) => (
              <div
                key={entry.date}
                className={`h-4 rounded-sm ${entry.completed ? "bg-emerald-500/80" : "bg-muted"}`}
                title={entry.date}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Productivity Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {analytics.insights.map((insight, index) => (
            <div key={index} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
              {index % 3 === 0 ? <Flame className="mt-0.5 h-4 w-4 text-rose-500" /> : null}
              {index % 3 === 1 ? <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-500" /> : null}
              {index % 3 === 2 ? <ListChecks className="mt-0.5 h-4 w-4 text-amber-500" /> : null}
              <p>{insight}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
