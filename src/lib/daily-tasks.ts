import { SHORT_TERM_TASK_DAYS_THRESHOLD } from "@/lib/constants";
import {
  DailyTask,
  DailyTaskDayStats,
  TaskPriority,
  TaskType,
  TimedTask,
} from "@/types/models";
import {
  addDays,
  dayDiff,
  parseIsoDateLocal,
  startOfMonth,
  startOfWeek,
  startOfYear,
  todayIsoDate,
  toLocalIsoDate,
} from "@/utils/date";

export interface DailyTaskAnalytics {
  todayCompleted: number;
  todayRemaining: number;
  dailyCompletionRate: number;
  weeklyCompletionRate: number;
  monthlyCompletionRate: number;
  yearlyCompletionRate: number;
  weeklyCompletions: Array<{ date: string; label: string; completed: number }>;
  monthlyCompletions: Array<{ date: string; day: number; completed: number }>;
  yearlyCompletions: Array<{ month: string; completed: number }>;
  statusBreakdown: { completed: number; incomplete: number; rolledOver: number };
  priorityBreakdown: Record<TaskPriority, number>;
  currentStreak: number;
  longestStreak: number;
  streakCalendar: Array<{ date: string; completed: boolean }>;
  insights: string[];
}

export const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getTomorrowIso = (base = todayIsoDate()): string => addDays(base, 1);

export const isTodayOrTomorrow = (candidateIso: string, today = todayIsoDate()): boolean => {
  const tomorrow = getTomorrowIso(today);
  return candidateIso === today || candidateIso === tomorrow;
};

export const classifyTimedTaskType = (dateIso: string, today = todayIsoDate()): TaskType.SHORT_TERM | TaskType.LONG_TERM => {
  const distance = dayDiff(today, dateIso);
  if (distance <= SHORT_TERM_TASK_DAYS_THRESHOLD) {
    return TaskType.SHORT_TERM;
  }

  return TaskType.LONG_TERM;
};

export const splitTimedTasksByType = (
  tasks: TimedTask[],
  today = todayIsoDate(),
): { shortTermTasks: TimedTask[]; longTermTasks: TimedTask[] } => {
  const shortTermTasks: TimedTask[] = [];
  const longTermTasks: TimedTask[] = [];

  tasks.forEach((task) => {
    const dateIso = task.dueDate ?? task.scheduledFor;
    const resolvedType = classifyTimedTaskType(dateIso, today);

    const normalized: TimedTask = {
      ...task,
      type: resolvedType,
      scheduledFor: dateIso,
      dueDate: dateIso,
    };

    if (resolvedType === TaskType.SHORT_TERM) {
      shortTermTasks.push(normalized);
      return;
    }

    longTermTasks.push(normalized);
  });

  const byDate = (a: TimedTask, b: TimedTask): number => {
    const aDate = a.dueDate ?? a.scheduledFor;
    const bDate = b.dueDate ?? b.scheduledFor;
    const dateCompare = aDate.localeCompare(bDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.order - b.order;
  };

  shortTermTasks.sort(byDate);
  longTermTasks.sort(byDate);

  return { shortTermTasks, longTermTasks };
};

export const emptyDailyTaskStats = (): DailyTaskDayStats => ({
  total: 0,
  completed: 0,
  rollover: 0,
  byPriority: {
    high: 0,
    medium: 0,
    low: 0,
  },
});

export const clampNonNegative = (value: number): number => Math.max(0, Math.floor(value));

export const nextDailyTaskStats = (
  previous: DailyTaskDayStats | undefined,
  patch: Partial<DailyTaskDayStats> & { byPriority?: Partial<Record<TaskPriority, number>> },
): DailyTaskDayStats => {
  const base = previous ?? emptyDailyTaskStats();

  return {
    total: clampNonNegative((patch.total ?? base.total)),
    completed: clampNonNegative((patch.completed ?? base.completed)),
    rollover: clampNonNegative((patch.rollover ?? base.rollover)),
    byPriority: {
      high: clampNonNegative((patch.byPriority?.high ?? base.byPriority.high)),
      medium: clampNonNegative((patch.byPriority?.medium ?? base.byPriority.medium)),
      low: clampNonNegative((patch.byPriority?.low ?? base.byPriority.low)),
    },
  };
};

const completionRate = (completed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  return Number(((completed / total) * 100).toFixed(1));
};

const rangeIsoDates = (start: Date, endInclusive: Date): string[] => {
  const points: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endInclusive);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    points.push(toLocalIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
};

const weekdayName = (isoDate: string): string =>
  parseIsoDateLocal(isoDate).toLocaleDateString([], { weekday: "short" });

const monthName = (index: number): string =>
  new Date(2000, index, 1).toLocaleDateString([], { month: "short" });

const buildStreakData = (statsByDate: Record<string, DailyTaskDayStats>, today = todayIsoDate()) => {
  const allDates = Object.keys(statsByDate)
    .filter((date) => isIsoDate(date))
    .sort((a, b) => a.localeCompare(b));

  let currentStreak = 0;
  let longestStreak = 0;
  let active = 0;

  allDates.forEach((date) => {
    const completed = (statsByDate[date]?.completed ?? 0) > 0;
    if (completed) {
      active += 1;
      longestStreak = Math.max(longestStreak, active);
      return;
    }

    active = 0;
  });

  let cursor = today;
  while ((statsByDate[cursor]?.completed ?? 0) > 0) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  const streakStart = parseIsoDateLocal(addDays(today, -27));
  const streakEnd = parseIsoDateLocal(today);
  const streakCalendar = rangeIsoDates(streakStart, streakEnd).map((date) => ({
    date,
    completed: (statsByDate[date]?.completed ?? 0) > 0,
  }));

  return {
    currentStreak,
    longestStreak,
    streakCalendar,
  };
};

const productivityInsights = (
  statsByDate: Record<string, DailyTaskDayStats>,
  dailyTasks: DailyTask[],
  weeklyRate: number,
  monthlyRate: number,
): string[] => {
  const dates = Object.keys(statsByDate).sort((a, b) => a.localeCompare(b));
  if (dates.length < 3) {
    return [
      "Add a few daily tasks to unlock personalized productivity insights.",
      "Completing at least one task per day starts your streak quickly.",
    ];
  }

  const weekday = { completed: 0, total: 0 };
  const weekend = { completed: 0, total: 0 };

  dates.forEach((date) => {
    const stats = statsByDate[date] ?? emptyDailyTaskStats();
    const day = parseIsoDateLocal(date).getDay();
    const bucket = day === 0 || day === 6 ? weekend : weekday;
    bucket.completed += stats.completed;
    bucket.total += stats.total;
  });

  const weekdayRate = completionRate(weekday.completed, weekday.total);
  const weekendRate = completionRate(weekend.completed, weekend.total);

  const highPriorityIncomplete = dailyTasks.filter((task) => task.priority === "high" && !task.completed).length;

  const insights: string[] = [];

  if (weekday.total > 0 || weekend.total > 0) {
    if (weekdayRate >= weekendRate + 8) {
      insights.push("You complete more tasks on weekdays. Front-load high priority work there.");
    } else if (weekendRate >= weekdayRate + 8) {
      insights.push("Your weekend completion is stronger. Use weekdays for lighter planning.");
    }
  }

  if (weeklyRate >= monthlyRate + 5) {
    insights.push("Your completion rate improved this week. Keep your current pace going.");
  } else if (monthlyRate >= weeklyRate + 8) {
    insights.push("This week is below your monthly trend. Tighten tomorrow's task list.");
  }

  if (highPriorityIncomplete > 0) {
    insights.push("High priority tasks are still open. Start with one before lower-priority work.");
  }

  if (insights.length === 0) {
    insights.push("Consistency is building. Keep finishing at least one task daily to grow momentum.");
  }

  return insights;
};

export const computeDailyTaskAnalytics = (
  dailyTasks: DailyTask[],
  statsByDate: Record<string, DailyTaskDayStats>,
  today = todayIsoDate(),
): DailyTaskAnalytics => {
  const todayStats = statsByDate[today] ?? emptyDailyTaskStats();

  const now = parseIsoDateLocal(today);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const weeklyDates = rangeIsoDates(weekStart, now);
  const monthlyDates = rangeIsoDates(monthStart, now);
  const yearlyDates = rangeIsoDates(yearStart, now);

  const weeklyTotals = weeklyDates.reduce(
    (acc, date) => {
      const stats = statsByDate[date] ?? emptyDailyTaskStats();
      acc.total += stats.total;
      acc.completed += stats.completed;
      return acc;
    },
    { total: 0, completed: 0 },
  );

  const monthlyTotals = monthlyDates.reduce(
    (acc, date) => {
      const stats = statsByDate[date] ?? emptyDailyTaskStats();
      acc.total += stats.total;
      acc.completed += stats.completed;
      return acc;
    },
    { total: 0, completed: 0 },
  );

  const yearlyTotals = yearlyDates.reduce(
    (acc, date) => {
      const stats = statsByDate[date] ?? emptyDailyTaskStats();
      acc.total += stats.total;
      acc.completed += stats.completed;
      return acc;
    },
    { total: 0, completed: 0 },
  );

  const weeklyCompletions = weeklyDates.map((date) => ({
    date,
    label: weekdayName(date),
    completed: statsByDate[date]?.completed ?? 0,
  }));

  const monthlyCompletions = monthlyDates.map((date) => ({
    date,
    day: parseIsoDateLocal(date).getDate(),
    completed: statsByDate[date]?.completed ?? 0,
  }));

  const currentYear = now.getFullYear();
  const yearlyCompletions = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthKey = `${currentYear}-${`${monthIndex + 1}`.padStart(2, "0")}`;

    const completed = Object.entries(statsByDate).reduce((sum, [date, stats]) => {
      if (!date.startsWith(monthKey)) {
        return sum;
      }

      return sum + (stats?.completed ?? 0);
    }, 0);

    return {
      month: monthName(monthIndex),
      completed,
    };
  });

  const statusBreakdown = {
    completed: dailyTasks.filter((task) => task.completed).length,
    incomplete: dailyTasks.filter((task) => !task.completed && !task.isRolledOver).length,
    rolledOver: dailyTasks.filter((task) => task.isRolledOver && !task.completed).length,
  };

  const priorityBreakdown = dailyTasks.reduce<Record<TaskPriority, number>>(
    (acc, task) => {
      acc[task.priority] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const streak = buildStreakData(statsByDate, today);

  const weeklyRate = completionRate(weeklyTotals.completed, weeklyTotals.total);
  const monthlyRate = completionRate(monthlyTotals.completed, monthlyTotals.total);

  return {
    todayCompleted: todayStats.completed,
    todayRemaining: Math.max(0, todayStats.total - todayStats.completed),
    dailyCompletionRate: completionRate(todayStats.completed, todayStats.total),
    weeklyCompletionRate: weeklyRate,
    monthlyCompletionRate: monthlyRate,
    yearlyCompletionRate: completionRate(yearlyTotals.completed, yearlyTotals.total),
    weeklyCompletions,
    monthlyCompletions,
    yearlyCompletions,
    statusBreakdown,
    priorityBreakdown,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    streakCalendar: streak.streakCalendar,
    insights: productivityInsights(statsByDate, dailyTasks, weeklyRate, monthlyRate),
  };
};

