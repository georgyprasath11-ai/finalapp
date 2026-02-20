import { WorkoutSession } from "@/types/models";
import { toLocalIsoDate } from "@/lib/goals";
import { formatDateLabel } from "@/utils/format";
import { startOfWeek } from "@/utils/date";

const WORKOUT_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const normalizeMuscle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const endedAtMs = (session: WorkoutSession): number => Date.parse(session.endedAt);

const trackedDatesFromSessions = (sessions: WorkoutSession[]): string[] => {
  const dates = sessions
    .map((session) => (session.date ? session.date : null))
    .filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date));

  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
};

export const workoutTrackedDays = (
  sessions: WorkoutSession[],
  markedDays: string[],
): string[] => Array.from(new Set([...trackedDatesFromSessions(sessions), ...markedDays])).sort((a, b) => a.localeCompare(b));

export interface WorkoutStreakStats {
  currentStreak: number;
  longestStreak: number;
}

export const workoutStreakStats = (dates: string[], base = new Date()): WorkoutStreakStats => {
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const dateSet = new Set(dates);
  const today = toLocalIsoDate(base);

  let currentStreak = 0;
  let pointer = new Date(base);
  pointer.setHours(0, 0, 0, 0);

  while (dateSet.has(toLocalIsoDate(pointer))) {
    currentStreak += 1;
    pointer = addDays(pointer, -1);
  }

  let longestStreak = 0;
  let streak = 0;
  let previousDate: string | null = null;

  dates.forEach((date) => {
    if (!previousDate) {
      streak = 1;
      longestStreak = 1;
      previousDate = date;
      return;
    }

    const previousMs = Date.parse(`${previousDate}T00:00:00`);
    const currentMs = Date.parse(`${date}T00:00:00`);
    const dayDelta = Math.round((currentMs - previousMs) / 86_400_000);
    streak = dayDelta === 1 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previousDate = date;
  });

  if (!dateSet.has(today)) {
    currentStreak = 0;
  }

  return { currentStreak, longestStreak };
};

export interface MuscleDistributionPoint {
  muscle: string;
  minutes: number;
  fill: string;
}

export const muscleDistributionSeries = (sessions: WorkoutSession[]): MuscleDistributionPoint[] => {
  const totals = new Map<string, number>();

  sessions.forEach((session) => {
    if (session.durationMs <= 0) {
      return;
    }

    const muscles = Array.from(
      new Set(
        session.exercises
          .flatMap((exercise) => exercise.muscles.map(normalizeMuscle))
          .filter((muscle) => muscle.length > 0),
      ),
    );

    if (muscles.length === 0) {
      totals.set("Unspecified", (totals.get("Unspecified") ?? 0) + session.durationMs);
      return;
    }

    const splitDuration = session.durationMs / muscles.length;
    muscles.forEach((muscle) => {
      totals.set(muscle, (totals.get(muscle) ?? 0) + splitDuration);
    });
  });

  return Array.from(totals.entries())
    .map(([muscle, durationMs], index) => ({
      muscle,
      minutes: Math.max(0, Math.round(durationMs / 60_000)),
      fill: WORKOUT_CHART_COLORS[index % WORKOUT_CHART_COLORS.length],
    }))
    .sort((a, b) => b.minutes - a.minutes);
};

export interface WeeklyWorkoutPoint {
  weekLabel: string;
  minutes: number;
}

export const weeklyWorkoutSeries = (sessions: WorkoutSession[], weeks = 8): WeeklyWorkoutPoint[] => {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);

  const points: WeeklyWorkoutPoint[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * index);
    const weekEnd = addDays(weekStart, 7);
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();

    const totalMs = sessions.reduce((sum, session) => {
      const end = endedAtMs(session);
      if (!Number.isFinite(end) || end < weekStartMs || end >= weekEndMs) {
        return sum;
      }
      return sum + session.durationMs;
    }, 0);

    const iso = toLocalIsoDate(weekStart);
    points.push({
      weekLabel: formatDateLabel(iso),
      minutes: Math.round(totalMs / 60_000),
    });
  }

  return points;
};

export interface DailyWorkoutPoint {
  date: string;
  label: string;
  minutes: number;
}

export const dailyWorkoutSeries = (sessions: WorkoutSession[], days = 30): DailyWorkoutPoint[] => {
  const totalsByDate = new Map<string, number>();

  sessions.forEach((session) => {
    const end = endedAtMs(session);
    if (!Number.isFinite(end)) {
      return;
    }

    const key = toLocalIsoDate(new Date(end));
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + session.durationMs);
  });

  const today = new Date();
  const points: DailyWorkoutPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const dateIso = toLocalIsoDate(day);

    points.push({
      date: dateIso,
      label: formatDateLabel(dateIso),
      minutes: Math.round((totalsByDate.get(dateIso) ?? 0) / 60_000),
    });
  }

  return points;
};
