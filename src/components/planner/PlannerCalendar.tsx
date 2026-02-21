import { memo, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Subject, Task, TaskPriority } from "@/types/models";

const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const priorityTone: Record<TaskPriority, string> = {
  high: "border-rose-400/35 bg-rose-500/12",
  medium: "border-amber-400/35 bg-amber-500/10",
  low: "border-emerald-400/35 bg-emerald-500/10",
};

const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (base: Date): Date => {
  const date = new Date(base);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, delta: number): Date => {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + delta);
  return clone;
};

interface CalendarDay {
  date: Date;
  iso: string;
  inMonth: boolean;
}

const buildMonthGrid = (monthDate: Date): CalendarDay[] => {
  const monthStart = startOfMonth(monthDate);
  const offset = monthStart.getDay();
  const gridStart = addDays(monthStart, -offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      iso: toLocalIsoDate(date),
      inMonth: date.getMonth() === monthDate.getMonth() && date.getFullYear() === monthDate.getFullYear(),
    } satisfies CalendarDay;
  });
};

interface DayCellTask {
  id: string;
  title: string;
  subjectName: string;
  subjectColor: string;
  completed: boolean;
  priority: TaskPriority;
}

interface DayCellProps {
  day: CalendarDay;
  tasks: DayCellTask[];
  selected: boolean;
  todayIso: string;
  onSelectDay: (iso: string) => void;
  onOpenTask: (taskId: string) => void;
}

const DayCell = memo(function DayCell({ day, tasks, selected, todayIso, onSelectDay, onOpenTask }: DayCellProps) {
  const isToday = day.iso === todayIso;
  const showOverflowFade = tasks.length > 4;

  return (
    <article
      className={cn(
        "relative flex h-[184px] min-h-[184px] flex-col overflow-hidden rounded-2xl border bg-card/75 p-2.5 transition-all duration-200",
        day.inMonth ? "border-border/70" : "border-border/40 bg-card/45",
        selected ? "ring-2 ring-primary/60" : "",
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            day.inMonth ? "text-foreground" : "text-muted-foreground",
            isToday ? "bg-primary/20 text-primary" : "",
          )}
          onClick={() => onSelectDay(day.iso)}
        >
          {day.date.getDate()}
        </button>
      </div>

      <div className="relative mt-2 flex-1 overflow-hidden">
        <div className="planner-day-scroll thin-scrollbar h-full space-y-1 overflow-y-auto overflow-x-hidden pr-1">
          {tasks.length === 0 ? (
            <div className="grid h-full min-h-[72px] place-items-center rounded-xl border border-dashed border-border/50 bg-background/25 text-[11px] text-muted-foreground">
              {day.inMonth ? "No tasks" : ""}
            </div>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft",
                  priorityTone[task.priority],
                )}
                title={`${task.subjectName}: ${task.title}`}
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.subjectColor }} />
                <span
                  className={cn(
                    "min-w-0 truncate font-medium text-foreground",
                    task.completed ? "line-through decoration-2 text-muted-foreground opacity-75" : "",
                  )}
                >
                  {task.subjectName}: {task.title}
                </span>
              </button>
            ))
          )}
        </div>
        {showOverflowFade ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card/90 to-transparent" />
        ) : null}
      </div>
    </article>
  );
});

interface PlannerCalendarProps {
  tasks: Task[];
  subjects: Subject[];
  todayIso: string;
  onOpenTask: (taskId: string) => void;
}

export function PlannerCalendar({ tasks, subjects, todayIso, onOpenTask }: PlannerCalendarProps) {
  const [monthDate, setMonthDate] = useState(() => {
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [selectedDayIso, setSelectedDayIso] = useState(todayIso);

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, DayCellTask[]>();

    tasks.forEach((task) => {
      if (!task.dueDate) {
        return;
      }

      const list = grouped.get(task.dueDate) ?? [];
      const subject = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
      list.push({
        id: task.id,
        title: task.title,
        subjectName: subject?.name ?? "Unassigned",
        subjectColor: subject?.color ?? "#64748b",
        completed: task.status === "completed" || task.completed,
        priority: task.priority,
      });
      grouped.set(task.dueDate, list);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => {
        const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority] || a.title.localeCompare(b.title);
      });
    });

    return grouped;
  }, [subjectMap, tasks]);

  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString([], { month: "long", year: "numeric" }),
    [monthDate],
  );

  return (
    <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Planner Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Previous month"
              onClick={() => setMonthDate((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[168px] rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-center text-sm font-semibold">
              {monthLabel}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Next month"
              onClick={() => setMonthDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[860px] space-y-2">
            <div className="grid grid-cols-7 gap-2">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/60 bg-secondary/25 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <DayCell
                  key={day.iso}
                  day={day}
                  tasks={tasksByDate.get(day.iso) ?? []}
                  selected={day.iso === selectedDayIso}
                  todayIso={todayIso}
                  onSelectDay={setSelectedDayIso}
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
