import { clampPercent, goalPercent } from "@/lib/goals";
import { cn } from "@/lib/utils";
import { percentLabel } from "@/utils/format";

interface GoalProgressBarProps {
  label: string;
  completedHours: number;
  goalHours: number;
  className?: string;
}

const formatHours = (hours: number): string => {
  const rounded = Number(hours.toFixed(2));
  const trimmed = Number.isInteger(rounded) ? rounded.toString() : rounded.toString().replace(/0+$/, "").replace(/\.$/, "");
  return `${trimmed}h`;
};

export function GoalProgressBar({ label, completedHours, goalHours, className }: GoalProgressBarProps) {
  const percent = goalPercent(completedHours, goalHours);
  const cappedPercent = clampPercent(percent);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatHours(completedHours)} / {formatHours(goalHours)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-secondary/70">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${cappedPercent}%` }}
          />
        </div>
        <span className="min-w-14 text-right text-xs font-semibold text-primary">
          {percentLabel(percent)}
        </span>
      </div>
    </div>
  );
}
