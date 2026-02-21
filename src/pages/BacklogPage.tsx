import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysInBacklog, derivedBacklogPriority } from "@/lib/study-intelligence";
import { useAppStore } from "@/store/app-store";

const priorityClass = {
  low: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  medium: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  high: "border-rose-400/35 bg-rose-500/10 text-rose-200",
} as const;

export default function BacklogPage() {
  const { data } = useAppStore();

  const backlogTasks = useMemo(() => {
    if (!data) {
      return [];
    }

    const nowMs = Date.now();

    return data.tasks
      .filter((task) => task.isBacklog === true && !task.completed)
      .map((task) => {
        const backlogDays = daysInBacklog(task.backlogSince ?? null, nowMs);
        const priority = derivedBacklogPriority(task.backlogSince ?? null, nowMs);

        return {
          ...task,
          backlogDays,
          priority,
        };
      })
      .sort((a, b) => b.backlogDays - a.backlogDays);
  }, [data]);

  if (!data) {
    return null;
  }

  const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]));

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Automatic Backlog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {backlogTasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
              No overdue tasks in backlog right now.
            </p>
          ) : (
            backlogTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/65 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.subjectId ? subjectMap.get(task.subjectId)?.name ?? "Unknown" : "Unassigned"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.backlogDays} day(s) overdue</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] text-rose-200">
                    Overdue
                  </Badge>
                  <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 text-[11px] ${priorityClass[task.priority]}`}>
                    {task.priority}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}