import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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

export default function BacklogPage() {
  const { data, addTask, updateTask, toggleTask, deleteTask, reorderTask } = useAppStore();
  const [filters, setFilters] = useState<TaskFiltersValue>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(filters.search, 200);
  const today = todayIsoDate();

  const editingTask = data && editingTaskId ? data.tasks.find((task) => task.id === editingTaskId) : undefined;

  const tasks = useMemo(() => {
    if (!data) {
      return [];
    }

    const query = debouncedSearch.toLowerCase().trim();

    return data.tasks
      .filter((task) => task.bucket === "backlog")
      .filter((task) => {
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

        if (filters.priority !== "all" && filters.priority !== task.priority) {
          return false;
        }

        if (query.length > 0) {
          const text = `${task.title} ${task.description}`.toLowerCase();
          if (!text.includes(query)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [data, debouncedSearch, filters]);

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
        estimatedMinutes: value.estimatedMinutes,
        dueDate: value.dueDate,
      });
      setEditingTaskId(null);
      return;
    }

    addTask({ ...value, bucket: "backlog" });
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Backlog Queue</CardTitle>
          <Button
            onClick={() => {
              setEditingTaskId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Backlog Task
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskFilters value={filters} onChange={setFilters} subjects={data.subjects} />
          <TaskList
            tasks={tasks}
            subjects={data.subjects}
            todayIso={today}
            selectedIds={selectedIds}
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
        initialTask={editingTask}
        defaultBucket="backlog"
        onSubmit={submitTask}
      />
    </div>
  );
}
