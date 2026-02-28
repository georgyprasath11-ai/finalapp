import { useMemo } from "react";
import { PlannerCalendar } from "@/components/planner/PlannerCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { normalizeGoalHours } from "@/lib/goals";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { useAppStore } from "@/store/app-store";

type GoalKey = "dailyHours" | "weeklyHours" | "monthlyHours";

export default function PlannerPage() {
  const { data, updateSettings } = useAppStore();
  const { todayIso, shortTermTasks, longTermTasks } = useDailyTaskStore();

  const calendarTasks = useMemo(() => [...shortTermTasks, ...longTermTasks], [longTermTasks, shortTermTasks]);

  if (!data) {
    return null;
  }

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
            Daily Task add/edit/delete actions are intentionally restricted to the Daily Tasks page.
          </p>
        </CardContent>
      </Card>

      <PlannerCalendar
        tasks={calendarTasks}
        subjects={data.subjects}
        todayIso={todayIso}
        onOpenTask={() => {
          // Daily task editing is intentionally blocked outside Daily Tasks page.
        }}
      />
    </div>
  );
}
