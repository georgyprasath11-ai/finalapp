import { memo, useMemo, useState } from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Subject, Task } from "@/types/models";
import { formatDateLabel, formatMinutes, formatStudyTime } from "@/utils/format";

interface TaskListProps {
  tasks: Task[];
  subjects: Subject[];
  todayIso: string;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onToggleDone: (taskId: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onReorder: (sourceTaskId: string, targetTaskId: string) => void;
}

const priorityClass = {
  high: "border-rose-400/35 bg-rose-500/10 text-rose-200",
  medium: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  low: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
} as const;

const formatLastWorked = (lastWorkedAt: number | null | undefined): string => {
  if (typeof lastWorkedAt !== "number" || !Number.isFinite(lastWorkedAt)) {
    return "Not worked yet";
  }

  return new Date(lastWorkedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface TaskRowProps {
  task: Task;
  subjectName: string;
  subjectColor: string;
  overdue: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleDone: (taskId: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onDragStart: (taskId: string) => void;
  onDropOn: (taskId: string) => void;
}

const TaskRow = memo(function TaskRow({
  task,
  subjectName,
  subjectColor,
  overdue,
  selected,
  onSelect,
  onToggleDone,
  onEdit,
  onDelete,
  onDragStart,
  onDropOn,
}: TaskRowProps) {
  const totalSeconds = typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
    ? Math.max(0, Math.floor(task.totalTimeSeconds))
    : 0;
  const sessionCount = typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
    ? Math.max(0, Math.floor(task.sessionCount))
    : 0;
  const averageSessionSeconds = Math.floor(totalSeconds / Math.max(sessionCount, 1));

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border/60 bg-card/85 p-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg",
        task.completed ? "opacity-75" : "",
        overdue && !task.completed ? "border-rose-400/40 bg-rose-500/10" : "",
      )}
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropOn(task.id)}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={(state) => onSelect(Boolean(state))} />
        <button type="button" className="mt-0.5 cursor-grab text-muted-foreground/60" aria-label="Drag task">
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleDone(task.id, !task.completed)}
              className={cn(
                "text-left text-sm font-semibold",
                task.completed ? "line-through text-muted-foreground" : "text-foreground",
              )}
            >
              {task.title}
            </button>
            <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", priorityClass[task.priority])}>
              {task.priority}
            </Badge>
            {overdue && !task.completed ? (
              <Badge variant="outline" className="rounded-full border-rose-400/45 bg-rose-500/15 text-rose-200">
                Overdue
              </Badge>
            ) : null}
          </div>

          {task.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subjectColor }} />
              {subjectName}
            </span>
            {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
            {task.dueDate ? <span>Due {formatDateLabel(task.dueDate)}</span> : null}
            {task.rollovers > 0 ? <span>Rolled over {task.rollovers}x</span> : null}
          </div>

          <div className="mt-2 grid gap-1 rounded-xl border border-border/60 bg-background/50 p-2 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <span className="tabular-nums">Time: {formatStudyTime(totalSeconds)}</span>
            <span className="tabular-nums">Sessions: {sessionCount}</span>
            <span className="tabular-nums">Avg: {formatStudyTime(averageSessionSeconds)}</span>
            <span className="tabular-nums">Last: {formatLastWorked(task.lastWorkedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onDelete(task.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
});

export function TaskList({
  tasks,
  subjects,
  todayIso,
  selectedIds,
  onSelectIds,
  onToggleDone,
  onEdit,
  onDelete,
  onReorder,
}: TaskListProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
        No tasks match the current filter.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const subject = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
        const selected = selectedIds.includes(task.id);
        const overdue = !task.completed && task.dueDate !== null && task.dueDate < todayIso;

        return (
          <TaskRow
            key={task.id}
            task={task}
            subjectName={subject?.name ?? "Unassigned"}
            subjectColor={subject?.color ?? "#64748b"}
            overdue={overdue}
            selected={selected}
            onSelect={(checked) => {
              if (checked) {
                onSelectIds(Array.from(new Set([...selectedIds, task.id])));
              } else {
                onSelectIds(selectedIds.filter((id) => id !== task.id));
              }
            }}
            onToggleDone={onToggleDone}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={(taskId) => setDraggingTaskId(taskId)}
            onDropOn={(targetTaskId) => {
              if (!draggingTaskId || draggingTaskId === targetTaskId) {
                return;
              }
              onReorder(draggingTaskId, targetTaskId);
              setDraggingTaskId(null);
            }}
          />
        );
      })}
    </div>
  );
}