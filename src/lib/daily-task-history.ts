import { DailyTaskAnalytics } from "@/lib/daily-tasks";
import {
  DailyTask,
  DailyTaskDayStats,
  DailyTaskHistoryAnalyticsSnapshot,
  DailyTaskHistoryDataset,
  DailyTaskHistoryDay,
  DailyTaskHistoryStatistics,
  DailyTaskHistoryTaskRecord,
} from "@/types/models";

export const DAILY_TASK_HISTORY_SCHEMA_VERSION = 1;

export interface DailyTaskHistoryExportPayload {
  exportVersion: 1;
  exportedAt: string;
  dailyTaskHistory: DailyTaskHistoryDay[];
}

export const createEmptyDailyTaskHistoryDataset = (): DailyTaskHistoryDataset => ({
  version: DAILY_TASK_HISTORY_SCHEMA_VERSION,
  days: {},
  updatedAt: null,
});

const toHistoryTaskRecord = (task: DailyTask): DailyTaskHistoryTaskRecord => ({
  id: task.id,
  title: task.title,
  category: task.category,
  completed: task.completed,
  createdAt: task.createdAt,
  completedAt: task.completedAt,
  updatedAt: task.updatedAt,
  scheduledFor: task.scheduledFor,
  priority: task.priority,
  rolloverCount: task.rolloverCount,
  isRolledOver: task.isRolledOver,
  timeSpent: task.timeSpent,
});

const completionRate = (completed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  return Number(((completed / total) * 100).toFixed(1));
};

const toDayAnalyticsSnapshot = (analytics: DailyTaskAnalytics): DailyTaskHistoryAnalyticsSnapshot => ({
  dailyCompletionRate: analytics.dailyCompletionRate,
  weeklyCompletionRate: analytics.weeklyCompletionRate,
  monthlyCompletionRate: analytics.monthlyCompletionRate,
  yearlyCompletionRate: analytics.yearlyCompletionRate,
  currentStreak: analytics.currentStreak,
  longestStreak: analytics.longestStreak,
});

export const buildDailyTaskHistoryDay = (
  date: string,
  tasks: DailyTask[],
  stats: DailyTaskDayStats | undefined,
  analytics: DailyTaskAnalytics,
): DailyTaskHistoryDay => {
  const completed = stats?.completed ?? tasks.filter((task) => task.completed).length;
  const total = stats?.total ?? tasks.length;
  const incomplete = Math.max(0, total - completed);
  const totalTimeSpent = tasks.reduce((sum, task) => sum + (Number.isFinite(task.timeSpent) ? task.timeSpent : 0), 0);

  const statistics: DailyTaskHistoryStatistics = {
    completedTasks: completed,
    incompleteTasks: incomplete,
    totalTimeSpent,
    completionRate: completionRate(completed, total),
    streakDays: analytics.currentStreak,
  };

  return {
    date,
    tasks: tasks.map(toHistoryTaskRecord),
    statistics,
    analytics: toDayAnalyticsSnapshot(analytics),
    updatedAt: new Date().toISOString(),
  };
};

export const mergeDailyTaskHistoryDatasets = (
  localHistory: DailyTaskHistoryDataset,
  remoteHistory: DailyTaskHistoryDataset,
): DailyTaskHistoryDataset => {
  const mergedDays: Record<string, DailyTaskHistoryDay> = { ...localHistory.days };

  Object.entries(remoteHistory.days).forEach(([date, incoming]) => {
    const existing = mergedDays[date];
    if (!existing) {
      mergedDays[date] = incoming;
      return;
    }

    const existingUpdatedAt = Date.parse(existing.updatedAt);
    const incomingUpdatedAt = Date.parse(incoming.updatedAt);
    if (Number.isNaN(existingUpdatedAt) || incomingUpdatedAt > existingUpdatedAt) {
      mergedDays[date] = incoming;
    }
  });

  return {
    version: Math.max(localHistory.version, remoteHistory.version),
    days: mergedDays,
    updatedAt: new Date().toISOString(),
  };
};

export const exportDailyTaskHistory = (dataset: DailyTaskHistoryDataset): DailyTaskHistoryExportPayload => {
  const days = Object.values(dataset.days).sort((a, b) => a.date.localeCompare(b.date));

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    dailyTaskHistory: days,
  };
};
