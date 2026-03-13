import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { useNow } from "@/hooks/useNow";
import { CalendarDays, Download, ListPlus, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BulkAddTasksDialog } from "@/components/tasks/BulkAddTasksDialog";
import { readRecentTaskMove } from "@/lib/task-move-feedback";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { DailyTask, TaskPriority } from "@/types/models";

const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-200",
  medium: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-200",
  low: "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
};

interface DailyTasksNotice {
  tone: "success" | "error";
  message: string;
}

const noticeToneClass: Record<DailyTasksNotice["tone"], string> = {
  success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-400/35 bg-rose-500/15 text-rose-100",
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

const isIsoDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeTaskTitleKey = (title: string): string => title.trim().replace(/\s+/g, " ").toLowerCase();

const parseBoolean = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return null;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

interface ImportedDailyTaskCsvRow {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
  completed: boolean;
}

const parseDailyTaskCsv = (raw: string): ImportedDailyTaskCsvRow[] => {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV is empty or missing rows.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const titleIndex = headers.indexOf("title");
  const priorityIndex = headers.indexOf("priority");
  const scheduledForIndex = headers.indexOf("scheduledfor");
  const completedIndex = headers.indexOf("completed");

  if (titleIndex < 0 || priorityIndex < 0 || scheduledForIndex < 0 || completedIndex < 0) {
    throw new Error("CSV header is invalid. Expected title, priority, scheduledFor, completed.");
  }

  const parsedRows: ImportedDailyTaskCsvRow[] = [];

  lines.slice(1).forEach((line) => {
    const cells = parseCsvLine(line);
    const title = (cells[titleIndex] ?? "").trim();
    const scheduledFor = (cells[scheduledForIndex] ?? "").trim();
    const priorityCandidate = (cells[priorityIndex] ?? "").trim().toLowerCase();
    const completedCandidate = parseBoolean(cells[completedIndex] ?? "");

    if (!title || !isIsoDateString(scheduledFor) || completedCandidate === null) {
      return;
    }

    if (priorityCandidate !== "high" && priorityCandidate !== "medium" && priorityCandidate !== "low") {
      return;
    }

    parsedRows.push({
      title,
      scheduledFor,
      priority: priorityCandidate as TaskPriority,
      completed: completedCandidate,
    });
  });

  if (parsedRows.length === 0) {
    throw new Error("No valid task rows were found in the CSV.");
  }

  return parsedRows;
};

const csvEscape = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

const buildDailyTaskCsv = (tasks: DailyTask[]): string => {
  const header = [
    "id",
    "title",
    "scheduledFor",
    "priority",
    "completed",
    "isRolledOver",
    "rolloverCount",
    "completedAt",
    "createdAt",
    "updatedAt",
  ];

  const rows = tasks.map((task) =>
    [
      task.id,
      task.title,
      task.scheduledFor,
      task.priority,
      String(task.completed),
      String(task.isRolledOver),
      String(task.rolloverCount),
      task.completedAt ?? "",
      task.createdAt,
      task.updatedAt,
    ]
      .map((cell) => csvEscape(cell))
      .join(","),
  );

  return [header.map((cell) => csvEscape(cell)).join(","), ...rows].join("\n");
};

function DailyTaskRow({
  task,
  removing,
  onToggle,
  onEdit,
  onDelete,
  todayIso,
  tomorrowIso,
  recentlyMoved,
}: {
  task: DailyTask;
  removing: boolean;
  onToggle: (task: DailyTask, checked: boolean) => void;
  onEdit: (task: DailyTask) => void;
  onDelete: (task: DailyTask) => void;
  todayIso: string;
  tomorrowIso: string;
  recentlyMoved: boolean;
}) {
  const dateLabel = task.scheduledFor === todayIso ? "Today" : task.scheduledFor === tomorrowIso ? "Tomorrow" : task.scheduledFor;

  return (
    <article
      className={`flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        removing ? "animate-out fade-out slide-out-to-right-4 duration-200" : "animate-in fade-in"
      } ${recentlyMoved ? "ring-2 ring-primary/40 animate-in slide-in-from-bottom-2 duration-300" : ""}`}
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
  const now = useNow(1_000);
  const {
    todayIso,
    tomorrowIso,
    dailyTasks,
    todayTasks,
    tomorrowTasks,
    analytics,
    exportDailyTaskHistory,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    toggleDailyTask,
  } = useDailyTaskStore();

  const [composer, setComposer] = useState<TaskComposerState>(() => taskComposer(todayIso));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DailyTasksNotice | null>(null);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const recentMove = useMemo(() => readRecentTaskMove(now), [now]);

  const taskMap = useMemo(
    () => new Map([...todayTasks, ...tomorrowTasks].map((task) => [task.id, task])),
    [todayTasks, tomorrowTasks],
  );

  const editingTask = editingTaskId ? taskMap.get(editingTaskId) ?? null : null;

  const showNotice = (message: string, tone: DailyTasksNotice["tone"]) => {
    setNotice({ message, tone });
  };

  const resetComposer = () => {
    setComposer(taskComposer(todayIso));
    setEditingTaskId(null);
    setNotice(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (!composer.title.trim()) {
      showNotice("Task name is required.", "error");
      return;
    }

    if (![todayIso, tomorrowIso].includes(composer.scheduledFor)) {
      showNotice("Daily Tasks only allow Today or Tomorrow.", "error");
      return;
    }

    if (editingTask) {
      const result = updateDailyTask(editingTask.id, {
        title: composer.title,
        priority: composer.priority,
        scheduledFor: composer.scheduledFor,
      });

      if (!result.ok) {
        showNotice(result.error ?? "Unable to update task.", "error");
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
      showNotice(result.error ?? "Unable to create task.", "error");
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
    setNotice(null);
  };

  const handleDelete = (task: DailyTask) => {
    setRemovingTaskId(task.id);
    window.setTimeout(() => {
      deleteDailyTask(task.id);
      setRemovingTaskId((current) => (current === task.id ? null : current));
    }, 190);
  };

  const exportDailyTasks = () => {
    const sortedTasks = [...dailyTasks].sort((a, b) => {
      const dateCompare = a.scheduledFor.localeCompare(b.scheduledFor);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return a.createdAt.localeCompare(b.createdAt);
    });

    const payload = buildDailyTaskCsv(sortedTasks);
    const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-tasks-${todayIso}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportDailyHistory = () => {
    const history = exportDailyTaskHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-task-history-${todayIso}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    setNotice(null);

    try {
      const raw = await file.text();
      const parsedRows = parseDailyTaskCsv(raw);
      const existingKeys = new Set(
        dailyTasks.map((task) => `${task.scheduledFor}::${normalizeTaskTitleKey(task.title)}`),
      );

      let imported = 0;
      let skipped = 0;

      parsedRows.forEach((row) => {
        const dedupeKey = `${row.scheduledFor}::${normalizeTaskTitleKey(row.title)}`;
        if (existingKeys.has(dedupeKey)) {
          skipped += 1;
          return;
        }

        const created = addDailyTask({
          title: row.title,
          priority: row.priority,
          scheduledFor: row.scheduledFor,
        });

        if (!created.ok || !created.taskId) {
          skipped += 1;
          return;
        }

        existingKeys.add(dedupeKey);
        imported += 1;

        if (row.completed) {
          toggleDailyTask(created.taskId, true, false);
        }
      });

      showNotice(
        imported > 0 ? `Imported ${imported} task(s). ${skipped} skipped.` : `No tasks imported. ${skipped} skipped.`,
        imported > 0 ? "success" : "error",
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to import CSV.";
      showNotice(msg, "error");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Daily Tasks (Today + Tomorrow)
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  void handleImportFile(event);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "Importing..." : "Import Daily Tasks"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportDailyTasks}>
                <Download className="mr-2 h-4 w-4" />
                Export Daily Tasks
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportDailyHistory}>
                <Download className="mr-2 h-4 w-4" />
                Export Full History
              </Button>
            </div>
          </div>
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

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                {editingTask ? "Save" : "Add"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBulkDialogOpen(true)}
                className="gap-1.5 rounded-xl"
              >
                <ListPlus className="h-4 w-4" />
                Add Multiple
              </Button>
              {editingTask ? (
                <Button type="button" variant="outline" className="rounded-xl" onClick={resetComposer}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          {notice ? (
            <p className={`rounded-xl border px-3 py-2 text-sm ${noticeToneClass[notice.tone]}`} role="status" aria-live="polite">
              {notice.message}
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
                  recentlyMoved={recentMove?.destination === "daily" && recentMove.taskId === task.id}
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
                  recentlyMoved={recentMove?.destination === "daily" && recentMove.taskId === task.id}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <BulkAddTasksDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        mode="daily"
        todayIso={todayIso}
        onConfirm={(titles, shared) => {
          let successCount = 0;
          for (const title of titles) {
            const result = addDailyTask({
              title,
              priority: shared.priority,
              scheduledFor: shared.scheduledFor,
            });
            if (result.ok) {
              successCount += 1;
            }
          }
          showNotice(
            `${successCount} task${successCount === 1 ? "" : "s"} created.`,
            successCount > 0 ? "success" : "error",
          );
        }}
      />
    </div>
  );
}

