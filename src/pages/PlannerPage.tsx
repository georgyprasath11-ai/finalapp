import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PlannerCalendar } from "@/components/planner/PlannerCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskDialog, TaskFormValue } from "@/components/tasks/TaskDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { normalizeGoalHours } from "@/lib/goals";
import { useAppStore } from "@/store/app-store";
import { todayIsoDate } from "@/utils/date";

type GoalKey = "dailyHours" | "weeklyHours" | "monthlyHours";

export default function PlannerPage() {
  const { data, addTask, toggleTask, deleteTask, reorderTask, updateTask, updateSettings } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const today = todayIsoDate();

  const tasks = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.tasks
      .filter((task) => {
        const isCompleted = task.status === "completed" || task.completed;
        return !isCompleted && (task.isBacklog ?? false) === false && (task.dueDate ?? today) <= today;
      })
      .sort((a, b) => a.order - b.order);
  }, [data, today]);

  if (!data) {
    return null;
  }

  const editingTask = editTaskId ? data.tasks.find((task) => task.id === editTaskId) : undefined;

  const updateStudyGoal = (key: GoalKey, rawValue: string) => {
    const parsed = Number(rawValue);
    updateSettings((previous) => ({
      ...previous,
      goals: {
        ...previous.goals,
        [key]: normalizeGoalHours(parsed, previous.goals[key]),
      },
    }));
  };

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
      setEditTaskId(null);
      return;
    }

    addTask(value);
  };

  return (
    <div className="space-y-6">
      <TimerPanel />

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Study Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Daily goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.settings.goals.dailyHours}
                onChange={(event) => updateStudyGoal("dailyHours", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weekly goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.settings.goals.weeklyHours}
                onChange={(event) => updateStudyGoal("weeklyHours", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly goal (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={data.settings.goals.monthlyHours}
                onChange={(event) => updateStudyGoal("monthlyHours", event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Goal progress has moved to Dashboard for quick visibility.
          </p>
        </CardContent>
      </Card>

      <PlannerCalendar
        tasks={data.tasks}
        subjects={data.subjects}
        todayIso={today}
        onOpenTask={(taskId) => {
          setEditTaskId(taskId);
          setDialogOpen(true);
        }}
      />

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
        categories={data.categories ?? []}
        activeCategoryId={data.activeCategoryId ?? null}
        initialTask={editingTask}
        defaultBucket="daily"
        onSubmit={submitTask}
      />
    </div>
  );
}
