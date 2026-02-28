import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { DailyTask, TaskPriority } from "@/types/models";

const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-200",
  medium: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-200",
  low: "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
};

interface TaskComposerState {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
}

const taskComposer = (todayIso: string): TaskComposerState => ({
  title: "",
  priority: "medium",
  scheduledFor: todayIso,
});

function DailyTaskRow({
  task,
  removing,
  onToggle,
  onEdit,
  onDelete,
  todayIso,
  tomorrowIso,
}: {
  task: DailyTask;
  removing: boolean;
  onToggle: (task: DailyTask, checked: boolean) => void;
  onEdit: (task: DailyTask) => void;
  onDelete: (task: DailyTask) => void;
  todayIso: string;
  tomorrowIso: string;
}) {
  const dateLabel = task.scheduledFor === todayIso ? "Today" : task.scheduledFor === tomorrowIso ? "Tomorrow" : task.scheduledFor;

  return (
    <article
      className={`flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        removing ? "animate-out fade-out slide-out-to-right-4 duration-200" : "animate-in fade-in"
      }`}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(next) => onToggle(task, Boolean(next))}
        className="mt-1 data-[state=checked]:scale-105 transition-transform duration-200"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold transition-colors ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
          <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 text-[11px] ${priorityBadgeClass[task.priority]}`}>
            {task.priority}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
            {dateLabel}
          </Badge>
          {task.isRolledOver ? (
            <Badge variant="outline" className="rounded-full border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-700 dark:text-rose-200">
              Incomplete
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive" onClick={() => onDelete(task)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function DailyTasksPage() {
  const {
    todayIso,
    tomorrowIso,
    todayTasks,
    tomorrowTasks,
    analytics,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    toggleDailyTask,
  } = useDailyTaskStore();

  const [composer, setComposer] = useState<TaskComposerState>(() => taskComposer(todayIso));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);

  const taskMap = useMemo(
    () => new Map([...todayTasks, ...tomorrowTasks].map((task) => [task.id, task])),
    [todayTasks, tomorrowTasks],
  );

  const editingTask = editingTaskId ? taskMap.get(editingTaskId) ?? null : null;

  const resetComposer = () => {
    setComposer(taskComposer(todayIso));
    setEditingTaskId(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!composer.title.trim()) {
      setMessage("Task name is required.");
      return;
    }

    if (![todayIso, tomorrowIso].includes(composer.scheduledFor)) {
      setMessage("Daily Tasks only allow Today or Tomorrow.");
      return;
    }

    if (editingTask) {
      const result = updateDailyTask(editingTask.id, {
        title: composer.title,
        priority: composer.priority,
        scheduledFor: composer.scheduledFor,
      });

      if (!result.ok) {
        setMessage(result.error ?? "Unable to update task.");
        return;
      }

      resetComposer();
      return;
    }

    const result = addDailyTask({
      title: composer.title,
      priority: composer.priority,
      scheduledFor: composer.scheduledFor,
    });

    if (!result.ok) {
      setMessage(result.error ?? "Unable to create task.");
      return;
    }

    resetComposer();
  };

  const handleEdit = (task: DailyTask) => {
    setEditingTaskId(task.id);
    setComposer({
      title: task.title,
      priority: task.priority,
      scheduledFor: task.scheduledFor,
    });
    setMessage("");
  };

  const handleDelete = (task: DailyTask) => {
    setRemovingTaskId(task.id);
    window.setTimeout(() => {
      deleteDailyTask(task.id);
      setRemovingTaskId((current) => (current === task.id ? null : current));
    }, 190);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Daily Tasks (Today + Tomorrow)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_180px_auto] md:items-end" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="daily-task-title">Task name</Label>
              <Input
                id="daily-task-title"
                value={composer.title}
                onChange={(event) => setComposer((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Read chapter notes"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={composer.priority}
                onValueChange={(priority) => setComposer((prev) => ({ ...prev, priority: priority as TaskPriority }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="daily-task-date">Date</Label>
              <Input
                id="daily-task-date"
                type="date"
                min={todayIso}
                max={tomorrowIso}
                value={composer.scheduledFor}
                onChange={(event) => setComposer((prev) => ({ ...prev, scheduledFor: event.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                {editingTask ? "Save" : "Add"}
              </Button>
              {editingTask ? (
                <Button type="button" variant="outline" className="rounded-xl" onClick={resetComposer}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          {message ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
              {message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Completed Today</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{analytics.todayCompleted}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Remaining Today</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{analytics.todayRemaining}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Week Rate</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{analytics.weeklyCompletionRate}%</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current Streak</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{analytics.currentStreak}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                No tasks for today yet.
              </p>
            ) : (
              todayTasks.map((task) => (
                <DailyTaskRow
                  key={task.id}
                  task={task}
                  removing={removingTaskId === task.id}
                  onToggle={(target, checked) => toggleDailyTask(target.id, checked, checked)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  todayIso={todayIso}
                  tomorrowIso={tomorrowIso}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Tomorrow Planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tomorrowTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                Plan tomorrow by adding tasks above.
              </p>
            ) : (
              tomorrowTasks.map((task) => (
                <DailyTaskRow
                  key={task.id}
                  task={task}
                  removing={removingTaskId === task.id}
                  onToggle={(target, checked) => toggleDailyTask(target.id, checked, checked)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  todayIso={todayIso}
                  tomorrowIso={tomorrowIso}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

