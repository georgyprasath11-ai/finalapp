import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDialog, TaskFormValue } from "@/components/tasks/TaskDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { useAppStore } from "@/store/app-store";
import { todayIsoDate } from "@/utils/date";

export default function PlannerPage() {
  const { data, addTask, toggleTask, deleteTask, reorderTask, updateTask } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const today = todayIsoDate();

  const tasks = useMemo(
    () => {
      if (!data) {
        return [];
      }

      return data.tasks
        .filter((task) => task.bucket === "daily" && (task.dueDate ?? today) <= today)
        .sort((a, b) => a.order - b.order);
    },
    [data, today],
  );

  if (!data) {
    return null;
  }

  const editingTask = editTaskId ? data.tasks.find((task) => task.id === editTaskId) : undefined;

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
      setEditTaskId(null);
      return;
    }

    addTask(value);
  };

  return (
    <div className="space-y-6">
      <TimerPanel />

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Daily Planner</CardTitle>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Daily Task
          </Button>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={tasks}
            subjects={data.subjects}
            todayIso={today}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onToggleDone={toggleTask}
            onEdit={(task) => {
              setEditTaskId(task.id);
              setDialogOpen(true);
            }}
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
            setEditTaskId(null);
          }
        }}
        subjects={data.subjects}
        initialTask={editingTask}
        defaultBucket="daily"
        onSubmit={submitTask}
      />
    </div>
  );
}
