import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDialog, TaskFormValue } from "@/components/tasks/TaskDialog";
import { TaskFilters, TaskFiltersValue } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { customTaskCategories } from "@/lib/constants";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { useAppStore } from "@/store/app-store";
import { Task } from "@/types/models";
import { addDays } from "@/utils/date";

const initialFilters: TaskFiltersValue = {
  search: "",
  subjectId: "all",
  status: "all",
  priority: "all",
};

export default function TasksPage() {
  const { data, addTask, updateTask, deleteTask, toggleTask, reorderTask } = useAppStore();
  const { todayIso, tomorrowIso, shortTermTasks, longTermTasks } = useDailyTaskStore();
  const minFutureDateIso = addDays(tomorrowIso, 1);

  const [filters, setFilters] = useState<TaskFiltersValue>(initialFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");

  const applyFilters = useCallback((tasks: Task[]): Task[] => {
    const query = filters.search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (filters.subjectId !== "all") {
        if (filters.subjectId === "none" && task.subjectId !== null) {
          return false;
        }

        if (filters.subjectId !== "none" && task.subjectId !== filters.subjectId) {
          return false;
        }
      }

      if (filters.status === "open" && task.completed) {
        return false;
      }

      if (filters.status === "done" && !task.completed) {
        return false;
      }

      if (filters.priority !== "all" && task.priority !== filters.priority) {
        return false;
      }

      if (query.length > 0) {
        const haystack = `${task.title} ${task.description}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const filteredShortTerm = useMemo(() => applyFilters(shortTermTasks), [applyFilters, shortTermTasks]);
  const filteredLongTerm = useMemo(() => applyFilters(longTermTasks), [applyFilters, longTermTasks]);

  const editingTask = editingTaskId && data ? data.tasks.find((task) => task.id === editingTaskId) : undefined;

  if (!data) {
    return null;
  }

  const submitTask = (value: TaskFormValue) => {
    setMessage("");
    const dueDate = value.dueDate;

    if (!dueDate) {
      setMessage("Please choose a date beyond tomorrow.");
      return;
    }

    if (dueDate <= tomorrowIso) {
      setMessage("Short-term and Long-term tasks must be scheduled after tomorrow.");
      return;
    }

    if (editingTask) {
      updateTask(editingTask.id, {
        title: value.title,
        description: value.description,
        subjectId: value.subjectId,
        priority: value.priority,
        categoryId: value.categoryId,
        estimatedMinutes: value.estimatedMinutes,
        dueDate,
      });
      setEditingTaskId(null);
      return;
    }

    addTask({
      title: value.title,
      description: value.description,
      subjectId: value.subjectId,
      bucket: "daily",
      priority: value.priority,
      categoryId: value.categoryId,
      estimatedMinutes: value.estimatedMinutes,
      dueDate,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Short-Term & Long-Term Tasks</CardTitle>
            <Button
              onClick={() => {
                setEditingTaskId(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Future Task
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            This page only accepts tasks scheduled after tomorrow. Daily task editing is restricted to the Daily Tasks page.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <TaskFilters value={filters} onChange={setFilters} subjects={data.subjects} />

          {message ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
              {message}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-border/60 bg-background/55">
              <CardHeader>
                <CardTitle className="text-sm">Short-Term</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList
                  tasks={filteredShortTerm}
                  subjects={data.subjects}
                  todayIso={todayIso}
                  selectedIds={selectedIds}
                  onSelectIds={setSelectedIds}
                  onToggleDone={toggleTask}
                  onEdit={(task) => {
                    setEditingTaskId(task.id);
                    setDialogOpen(true);
                  }}
                  onDelete={deleteTask}
                  onReorder={reorderTask}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-background/55">
              <CardHeader>
                <CardTitle className="text-sm">Long-Term</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList
                  tasks={filteredLongTerm}
                  subjects={data.subjects}
                  todayIso={todayIso}
                  selectedIds={selectedIds}
                  onSelectIds={setSelectedIds}
                  onToggleDone={toggleTask}
                  onEdit={(task) => {
                    setEditingTaskId(task.id);
                    setDialogOpen(true);
                  }}
                  onDelete={deleteTask}
                  onReorder={reorderTask}
                />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTaskId(null);
          }
        }}
        subjects={data.subjects}
        categories={customTaskCategories(data.categories)}
        activeCategoryId={data.activeCategoryId ?? null}
        initialTask={editingTask}
        defaultBucket="daily"
        minDueDate={minFutureDateIso}
        onSubmit={submitTask}
      />
    </div>
  );
}
