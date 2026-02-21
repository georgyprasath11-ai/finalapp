import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app-store";
import { SessionRating } from "@/types/models";
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

const productivityPalette: Record<SessionRating, string> = {
  productive: "#10b981",
  average: "#f59e0b",
  distracted: "#f87171",
};

const productivityScore: Record<SessionRating, number> = {
  productive: 3,
  average: 2,
  distracted: 1,
};

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

const startOfMonthMs = (base = new Date()): number => {
  const date = new Date(base);
  date.setDate(1);
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

const formatScore = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(2)} / 3`;
};

const scoreHint = (count: number): string =>
  count > 0 ? `${count} rated session${count === 1 ? "" : "s"}` : "No rated sessions";

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

  const ratedSessions = useMemo(() => {
    return completedSessions
      .map((session) => {
        const rating = (session.reflectionRating ?? session.rating) as SessionRating | null;
        if (!rating) {
          return null;
        }

        const endedAtMs =
          (typeof session.endTime === "number" && Number.isFinite(session.endTime)
            ? session.endTime
            : Date.parse(session.endedAt));

        if (!Number.isFinite(endedAtMs)) {
          return null;
        }

        return {
          id: session.id,
          rating,
          score: productivityScore[rating],
          subjectId: session.subjectId ?? "unassigned",
          endedAtMs,
        };
      })
      .filter((session): session is { id: string; rating: SessionRating; score: number; subjectId: string; endedAtMs: number } => session !== null);
  }, [completedSessions]);

  const productivityDistribution = useMemo(() => {
    const counts: Record<SessionRating, number> = {
      productive: 0,
      average: 0,
      distracted: 0,
    };

    ratedSessions.forEach((session) => {
      counts[session.rating] += 1;
    });

    const total = ratedSessions.length;

    return (["productive", "average", "distracted"] as SessionRating[]).map((rating) => ({
      rating,
      label: rating.charAt(0).toUpperCase() + rating.slice(1),
      count: counts[rating],
      percentage: total > 0 ? (counts[rating] / total) * 100 : 0,
      color: productivityPalette[rating],
    }));
  }, [ratedSessions]);

  const productivityTrend = useMemo(() => {
    const points: Array<{ label: string; productive: number; distracted: number; averageScore: number }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 13; offset >= 0; offset -= 1) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - offset);
      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayStartMs + 86_400_000;

      let productive = 0;
      let distracted = 0;
      let scoreSum = 0;
      let scoreCount = 0;

      ratedSessions.forEach((session) => {
        if (session.endedAtMs < dayStartMs || session.endedAtMs >= dayEndMs) {
          return;
        }

        if (session.rating === "productive") {
          productive += 1;
        }
        if (session.rating === "distracted") {
          distracted += 1;
        }

        scoreSum += session.score;
        scoreCount += 1;
      });

      points.push({
        label: dayStart.toLocaleDateString([], { month: "short", day: "numeric" }),
        productive,
        distracted,
        averageScore: scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0,
      });
    }

    return points;
  }, [ratedSessions]);

  const productivityBySubject = useMemo(() => {
    const totals = new Map<string, { scoreSum: number; count: number }>();

    ratedSessions.forEach((session) => {
      const existing = totals.get(session.subjectId) ?? { scoreSum: 0, count: 0 };
      totals.set(session.subjectId, {
        scoreSum: existing.scoreSum + session.score,
        count: existing.count + 1,
      });
    });

    return Array.from(totals.entries())
      .map(([subjectId, values]) => ({
        subjectId,
        name: subjectMap.get(subjectId)?.name ?? "Unassigned",
        averageScore: values.count > 0 ? Number((values.scoreSum / values.count).toFixed(2)) : 0,
        count: values.count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [ratedSessions, subjectMap]);

  const currentWeekStart = startOfWeekMs(new Date());
  const nextWeekStart = currentWeekStart + 7 * 86_400_000;
  const previousWeekStart = currentWeekStart - 7 * 86_400_000;
  const monthStart = startOfMonthMs(new Date());
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const monthEndMs = monthEnd.getTime();

  const averageScoreInRange = (startMs: number, endMs: number): { average: number | null; count: number } => {
    let total = 0;
    let count = 0;

    ratedSessions.forEach((session) => {
      if (session.endedAtMs < startMs || session.endedAtMs >= endMs) {
        return;
      }

      total += session.score;
      count += 1;
    });

    return {
      average: count > 0 ? total / count : null,
      count,
    };
  };

  const thisWeekScore = averageScoreInRange(currentWeekStart, nextWeekStart);
  const lastWeekScore = averageScoreInRange(previousWeekStart, currentWeekStart);
  const monthScore = averageScoreInRange(monthStart, monthEndMs);

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

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard title="Avg Score This Week" value={formatScore(thisWeekScore.average)} hint={scoreHint(thisWeekScore.count)} />
        <StatCard title="Avg Score Last Week" value={formatScore(lastWeekScore.average)} hint={scoreHint(lastWeekScore.count)} />
        <StatCard title="Avg Score This Month" value={formatScore(monthScore.average)} hint={scoreHint(monthScore.count)} />
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

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Productivity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {ratedSessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                Add session reflections to unlock productivity charts.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={productivityDistribution} dataKey="count" nameKey="label" outerRadius={110} innerRadius={58} paddingAngle={2}>
                    {productivityDistribution.map((entry) => (
                      <Cell key={entry.rating} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} session(s)`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Productive vs Distracted Trend (14 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="productive" fill={productivityPalette.productive} radius={[6, 6, 0, 0]} />
                <Bar dataKey="distracted" fill={productivityPalette.distracted} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Average Productivity Score by Subject</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productivityBySubject.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                No rated sessions yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityBySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 3]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)} / 3`} />
                  <Bar dataKey="averageScore" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}