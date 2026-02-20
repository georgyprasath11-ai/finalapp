import { GoalSettings } from "@/types/models";
import { startOfMonth, startOfWeek } from "@/utils/date";

interface DurationEntry {
  endedAt: string;
  durationMs: number;
}

const pad = (value: number): string => value.toString().padStart(2, "0");

export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const roundHours = (hours: number): number => Number(hours.toFixed(2));

export const msToHours = (durationMs: number): number => roundHours(Math.max(0, durationMs) / 3_600_000);

export const normalizeGoalHours = (value: number, fallback = 0): number =>
  roundHours(Number.isFinite(value) && value >= 0 ? value : fallback);

export const normalizeGoalSettings = (goals: GoalSettings): GoalSettings => ({
  dailyHours: normalizeGoalHours(goals.dailyHours),
  weeklyHours: normalizeGoalHours(goals.weeklyHours),
  monthlyHours: normalizeGoalHours(goals.monthlyHours),
});

export interface GoalTotalsMs {
  dailyMs: number;
  weeklyMs: number;
  monthlyMs: number;
}

export const computeGoalTotalsMs = (entries: DurationEntry[], base = new Date()): GoalTotalsMs => {
  const today = toLocalIsoDate(base);
  const weekStartDate = startOfWeek(base);
  const weekStart = weekStartDate.getTime();
  const weekEnd = weekStart + (7 * 86_400_000);
  const monthStartDate = startOfMonth(base);
  const monthStart = monthStartDate.getTime();
  const monthEndDate = new Date(monthStartDate);
  monthEndDate.setMonth(monthEndDate.getMonth() + 1);
  const monthEnd = monthEndDate.getTime();

  return entries.reduce<GoalTotalsMs>(
    (totals, entry) => {
      const endedAtMs = Date.parse(entry.endedAt);
      if (!Number.isFinite(endedAtMs) || entry.durationMs <= 0) {
        return totals;
      }

      if (toLocalIsoDate(new Date(endedAtMs)) === today) {
        totals.dailyMs += entry.durationMs;
      }

      if (endedAtMs >= weekStart && endedAtMs < weekEnd) {
        totals.weeklyMs += entry.durationMs;
      }

      if (endedAtMs >= monthStart && endedAtMs < monthEnd) {
        totals.monthlyMs += entry.durationMs;
      }

      return totals;
    },
    { dailyMs: 0, weeklyMs: 0, monthlyMs: 0 },
  );
};

export const goalPercent = (completedHours: number, goalHours: number): number => {
  if (!Number.isFinite(goalHours) || goalHours <= 0) {
    return 0;
  }

  return Math.max(0, (completedHours / goalHours) * 100);
};

export const clampPercent = (percent: number): number => Math.min(100, Math.max(0, percent));
