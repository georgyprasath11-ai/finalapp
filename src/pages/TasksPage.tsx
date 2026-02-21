import { useMemo, useState } from "react";
import { CheckCheck, Plus, Trash2, Undo2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDialog, TaskFormValue } from "@/components/tasks/TaskDialog";
import { TaskFilters, TaskFiltersValue } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAppStore } from "@/store/app-store";
import { Task } from "@/types/models";
import { todayIsoDate } from "@/utils/date";

const initialFilters: TaskFiltersValue = {
  search: "",
  subjectId: "all",
  status: "all",
  priority: "all",
};

type BucketView = "all" | "daily" | "backlog";

export default function TasksPage() {
  const {
    data,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    reorderTask,
    bulkCompleteTasks,
    bulkDeleteTasks,
    bulkMoveTasks,
    addTaskCategory,
    renameTaskCategory,
    deleteTaskCategory,
    setActiveTaskCategory,
  } = useAppStore();

  const [filters, setFilters] = useState<TaskFiltersValue>(initialFilters);
  const [bucket, setBucket] = useState<BucketView>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(filters.search, 200);
  const today = todayIsoDate();
  const editingTask = data && editingTaskId ? data.tasks.find((task) => task.id === editingTaskId) : undefined;

  const filteredTasks = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalized = debouncedSearch.trim().toLowerCase();
    const activeCategoryId = data.activeCategoryId;

    return data.tasks
      .filter((task) => {
        const isBacklog = task.isBacklog === true;

        if (bucket === "daily" && isBacklog) {
          return false;
        }

        if (bucket === "backlog" && !isBacklog) {
          return false;
        }

        if (activeCategoryId && task.categoryId && task.categoryId !== activeCategoryId) {
          return false;
        }

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

        if (normalized.length > 0) {
          const text = `${task.title} ${task.description}`.toLowerCase();
          if (!text.includes(normalized)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [bucket, data, debouncedSearch, filters.priority, filters.status, filters.subjectId]);

  const selectedExistingIds = selectedIds.filter((id) => filteredTasks.some((task) => task.id === id));

  if (!data) {
    return null;
  }

  const submitTask = (value: TaskFormValue) => {
    if (editingTask) {
      updateTask(editingTask.id, {
        title: value.title,
        description: value.description,
        subjectId: value.subjectId,
        priority: value.priority,
        categoryId: value.categoryId,
        estimatedMinutes: value.estimatedMinutes,
        dueDate: value.dueDate,
      });
      setEditingTaskId(null);
      return;
    }

    addTask(value);
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setDialogOpen(true);
  };

  const activeCategory = (data.categories ?? []).find((category) => category.id === data.activeCategoryId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Task Workspace</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant={bucket === "all" ? "default" : "outline"} size="sm" onClick={() => setBucket("all")}>All</Button>
              <Button variant={bucket === "daily" ? "default" : "outline"} size="sm" onClick={() => setBucket("daily")}>Active</Button>
              <Button variant={bucket === "backlog" ? "default" : "outline"} size="sm" onClick={() => setBucket("backlog")}>Backlog</Button>
              <Button
                onClick={() => {
                  setEditingTaskId(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                {(data.categories ?? []).map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={data.activeCategoryId === category.id ? "default" : "ghost"}
                    className="whitespace-nowrap rounded-xl transition-all duration-200"
                    onClick={() => setActiveTaskCategory(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  const name = window.prompt("New category name");
                  if (name) {
                    addTaskCategory(name);
                  }
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Tab
              </Button>
            </div>

            {activeCategory ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Active: {activeCategory.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg px-2"
                  onClick={() => {
                    const next = window.prompt("Rename category", activeCategory.name);
                    if (next && next.trim()) {
                      renameTaskCategory(activeCategory.id, next.trim());
                    }
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg px-2 text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete category "${activeCategory.name}"? Tasks will be moved.`)) {
                      deleteTaskCategory(activeCategory.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <TaskFilters value={filters} onChange={setFilters} subjects={data.subjects} />

          {selectedExistingIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2">
              <span className="text-xs font-medium text-muted-foreground">{selectedExistingIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => bulkCompleteTasks(selectedExistingIds, true)}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkCompleteTasks(selectedExistingIds, false)}>
                <Undo2 className="mr-2 h-4 w-4" />
                Reopen
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkMoveTasks(selectedExistingIds, "daily")}>
                Move to Active
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkDeleteTasks(selectedExistingIds)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          ) : null}

          <TaskList
            tasks={filteredTasks}
            subjects={data.subjects}
            todayIso={today}
            selectedIds={selectedExistingIds}
            onSelectIds={setSelectedIds}
            onToggleDone={toggleTask}
            onEdit={handleEdit}
            onDelete={deleteTask}
            onReorder={reorderTask}
          />
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
        categories={data.categories ?? []}
        activeCategoryId={data.activeCategoryId ?? null}
        initialTask={editingTask}
        onSubmit={submitTask}
      />
    </div>
  );
}