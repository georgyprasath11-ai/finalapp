import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app-store";
import { formatHours, formatStudyTime } from "@/utils/format";

const categoryPalette = [
  "#0f766e",
  "#0ea5a4",
  "#14b8a6",
  "#2dd4bf",
  "#34d399",
  "#22c55e",
  "#84cc16",
  "#65a30d",
] as const;

const toSessionSeconds = (durationMs: number, durationSeconds: number | undefined): number => {
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.max(0, Math.floor(durationSeconds));
  }

  return Math.max(0, Math.floor(durationMs / 1000));
};

const startOfWeekMs = (base = new Date()): number => {
  const date = new Date(base);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const formatDateTime = (value: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not worked yet";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AnalyticsPage() {
  const { data } = useAppStore();

  const subjects = useMemo(() => data?.subjects ?? [], [data?.subjects]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);
  const activeCategoryId = data?.activeCategoryId ?? null;

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.isActive !== true),
    [sessions],
  );

  const totalStudySeconds = useMemo(
    () => completedSessions.reduce((sum, session) => sum + toSessionSeconds(session.durationMs, session.durationSeconds), 0),
    [completedSessions],
  );

  const subjectStats = useMemo(() => {
    const totals = new Map<string, { seconds: number; sessions: number }>();

    completedSessions.forEach((session) => {
      const key = session.subjectId ?? "unassigned";
      const existing = totals.get(key) ?? { seconds: 0, sessions: 0 };
      const nextSeconds = existing.seconds + toSessionSeconds(session.durationMs, session.durationSeconds);
      totals.set(key, { seconds: nextSeconds, sessions: existing.sessions + 1 });
    });

    return Array.from(totals.entries())
      .map(([subjectId, values]) => {
        const subject = subjectMap.get(subjectId);
        return {
          subjectId,
          name: subject?.name ?? "Unassigned",
          color: subject?.color ?? "#64748b",
          totalSeconds: values.seconds,
          sessionCount: values.sessions,
          percentage: values.seconds / Math.max(totalStudySeconds, 1),
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [completedSessions, subjectMap, totalStudySeconds]);

  const categoryStats = useMemo(() => {
    const totals = new Map<string, { seconds: number; sessions: number; color: string; name: string }>();

    categories.forEach((category, index) => {
      totals.set(category.id, {
        seconds: 0,
        sessions: 0,
        name: category.name,
        color: categoryPalette[index % categoryPalette.length],
      });
    });

    tasks.forEach((task) => {
      const categoryId = task.categoryId ?? activeCategoryId ?? "uncategorized";
      const existing = totals.get(categoryId) ?? {
        seconds: 0,
        sessions: 0,
        name: categoryMap.get(categoryId)?.name ?? "Uncategorized",
        color: categoryPalette[totals.size % categoryPalette.length],
      };

      const taskSeconds = typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
        ? Math.max(0, Math.floor(task.totalTimeSeconds))
        : 0;
      const taskSessions = typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
        ? Math.max(0, Math.floor(task.sessionCount))
        : 0;

      totals.set(categoryId, {
        ...existing,
        seconds: existing.seconds + taskSeconds,
        sessions: existing.sessions + taskSessions,
      });
    });

    return Array.from(totals.entries())
      .map(([categoryId, values]) => ({
        categoryId,
        name: values.name,
        totalSeconds: values.seconds,
        sessionCount: values.sessions,
        percentage: values.seconds / Math.max(totalStudySeconds, 1),
        color: values.color,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [activeCategoryId, categories, categoryMap, tasks, totalStudySeconds]);

  const subjectChart = useMemo(
    () => subjectStats.map((item) => ({ subject: item.name, hours: Number((item.totalSeconds / 3600).toFixed(2)) })),
    [subjectStats],
  );

  const categoryChart = useMemo(() => {
    const withValues = categoryStats.filter((item) => item.totalSeconds > 0);
    if (withValues.length > 0) {
      return withValues;
    }

    return [
      {
        categoryId: "none",
        name: "No study yet",
        totalSeconds: 1,
        sessionCount: 0,
        percentage: 0,
        color: "#64748b",
      },
    ];
  }, [categoryStats]);

  const leaderboard = useMemo(() => {
    return tasks
      .map((task) => {
        const totalSeconds = typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
          ? Math.max(0, Math.floor(task.totalTimeSeconds))
          : 0;
        const sessionCount = typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
          ? Math.max(0, Math.floor(task.sessionCount))
          : 0;
        const averageSeconds = Math.floor(totalSeconds / Math.max(sessionCount, 1));

        return {
          id: task.id,
          title: task.title,
          subject: task.subjectId ? subjectMap.get(task.subjectId)?.name ?? "Unknown" : "Unassigned",
          totalSeconds,
          sessionCount,
          averageSeconds,
          lastWorkedAt:
            typeof task.lastWorkedAt === "number" && Number.isFinite(task.lastWorkedAt)
              ? task.lastWorkedAt
              : null,
        };
      })
      .filter((task) => task.totalSeconds > 0)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 8);
  }, [tasks, subjectMap]);

  const weekStart = startOfWeekMs(new Date());
  const weekEnd = weekStart + 7 * 86_400_000;
  const weekFocusedSeconds = completedSessions.reduce((sum, session) => {
    const endedAt =
      (typeof session.endTime === "number" && Number.isFinite(session.endTime)
        ? session.endTime
        : Date.parse(session.endedAt));

    if (!Number.isFinite(endedAt) || endedAt < weekStart || endedAt >= weekEnd) {
      return sum;
    }

    return sum + toSessionSeconds(session.durationMs, session.durationSeconds);
  }, 0);

  const mostStudiedSubject = subjectStats[0] ?? null;
  const mostWorkedTask = leaderboard[0] ?? null;
  const averageSessionLength = Math.floor(totalStudySeconds / Math.max(completedSessions.length, 1));
  const strongestCategory = categoryStats[0] ?? null;

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Most Studied Subject"
          value={mostStudiedSubject?.name ?? "None"}
          hint={mostStudiedSubject ? formatStudyTime(mostStudiedSubject.totalSeconds) : "No sessions yet"}
        />
        <StatCard
          title="Most Worked Task"
          value={mostWorkedTask?.title ?? "None"}
          hint={mostWorkedTask ? `${formatStudyTime(mostWorkedTask.totalSeconds)} across ${mostWorkedTask.sessionCount} sessions` : "No sessions yet"}
        />
        <StatCard
          title="Average Session"
          value={formatStudyTime(averageSessionLength)}
          hint={`${completedSessions.length} completed session(s)`}
        />
        <StatCard
          title="Focused This Week"
          value={formatHours(weekFocusedSeconds / 3600)}
          hint={formatStudyTime(weekFocusedSeconds)}
        />
        <StatCard
          title="Top Category"
          value={strongestCategory?.name ?? "None"}
          hint={strongestCategory ? formatStudyTime(strongestCategory.totalSeconds) : "No data"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Time by Subject</CardTitle>
          </CardHeader>
          <CardContent className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${value}h`} />
                <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Subject Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjectStats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                No subject sessions recorded yet.
              </p>
            ) : (
              subjectStats.map((subject) => (
                <div key={subject.subjectId} className="space-y-1.5 rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{subject.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatStudyTime(subject.totalSeconds)} • {subject.sessionCount} sessions
                    </p>
                  </div>
                  <Progress value={subject.percentage * 100} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{Math.round(subject.percentage * 100)}% of total study time</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Time by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChart}
                  dataKey="totalSeconds"
                  nameKey="name"
                  outerRadius={112}
                  innerRadius={58}
                  paddingAngle={2}
                >
                  {categoryChart.map((entry) => (
                    <Cell key={entry.categoryId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatStudyTime(Math.floor(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Task Effort Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                No tracked task effort yet.
              </p>
            ) : (
              leaderboard.map((task, index) => (
                <div key={task.id} className="grid gap-2 rounded-xl border border-border/60 bg-background/60 p-3 sm:grid-cols-[28px_minmax(0,1fr)_180px] sm:items-center">
                  <p className="text-sm font-semibold text-muted-foreground">#{index + 1}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.subject}</p>
                  </div>
                  <div className="text-left text-xs text-muted-foreground sm:text-right">
                    <p className="font-medium text-foreground">{formatStudyTime(task.totalSeconds)}</p>
                    <p>{task.sessionCount} sessions • avg {formatStudyTime(task.averageSeconds)}</p>
                    <p>{formatDateTime(task.lastWorkedAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}