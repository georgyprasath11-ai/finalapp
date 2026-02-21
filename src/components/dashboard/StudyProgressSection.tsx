import { GoalProgressBar } from "@/components/common/GoalProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StudyProgressSectionProps {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
}

export function StudyProgressSection({
  dailyHours,
  weeklyHours,
  monthlyHours,
  dailyGoalHours,
  weeklyGoalHours,
  monthlyGoalHours,
}: StudyProgressSectionProps) {
  return (
    <Card className="dashboard-surface rounded-[20px] border-border/60 bg-card/90">
      <CardHeader>
        <CardTitle className="text-base">Study Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 rounded-2xl border border-border/60 bg-background/55 p-4">
        <GoalProgressBar label="Daily study goal" completedHours={dailyHours} goalHours={dailyGoalHours} />
        <GoalProgressBar label="Weekly study goal" completedHours={weeklyHours} goalHours={weeklyGoalHours} />
        <GoalProgressBar label="Monthly study goal" completedHours={monthlyHours} goalHours={monthlyGoalHours} />
      </CardContent>
    </Card>
  );
}
