import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { StatCard } from "@/components/common/StatCard";
import { msToHours } from "@/lib/goals";
import { useAppStore } from "@/store/app-store";
import { formatDuration, formatHours, formatMinutes, percentLabel } from "@/utils/format";
import { todayIsoDate } from "@/utils/date";

export default function DashboardPage() {
  const { data, analytics } = useAppStore();

  if (!data) {
    return null;
  }

  const today = todayIsoDate();
  const todaysTasks = data.tasks
    .filter((task) => task.bucket === "daily" && !task.completed && (task.dueDate ?? today) <= today)
    .sort((a, b) => a.order - b.order)
    .slice(0, 6);

  const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]));

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today Study Time"
          value={formatDuration(analytics.todayStudyMs)}
          hint="Tracked from saved sessions"
        />
        <StatCard
          title="Productivity"
          value={percentLabel(analytics.productivityPercent)}
          hint="Based on 15h daily max"
          accentClassName="text-primary"
        />
        <StatCard title="Current Streak" value={`${analytics.streakDays} days`} hint="Days with any study" />
        <StatCard
          title="Best Day"
          value={analytics.bestDayLabel}
          hint={analytics.bestDayMinutes > 0 ? formatMinutes(analytics.bestDayMinutes) : "No study yet"}
        />
      </section>

      <TimerPanel />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Today Planner Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending daily tasks right now.</p>
            ) : (
              todaysTasks.map((task) => {
                const subject = task.subjectId ? subjectMap.get(task.subjectId) : null;
                return (
                  <div key={task.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 p-2">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{subject?.name ?? "Unassigned"}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {task.priority}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Goal Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
              <p className="text-muted-foreground">Daily goal</p>
              <p className="font-semibold">
                {formatHours(msToHours(analytics.todayStudyMs))} / {formatHours(data.settings.goals.dailyHours)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
              <p className="text-muted-foreground">Weekly total</p>
              <p className="font-semibold">{formatDuration(analytics.weeklyTotalMs)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
              <p className="text-muted-foreground">Monthly total</p>
              <p className="font-semibold">{formatDuration(analytics.monthlyTotalMs)}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
