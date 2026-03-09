import { describe, expect, it } from "vitest";
import {
  buildDailyTaskHistoryDay,
  createEmptyDailyTaskHistoryDataset,
  exportDailyTaskHistory,
  mergeDailyTaskHistoryDatasets,
} from "@/lib/daily-task-history";
import { DailyTask } from "@/types/models";

const makeTask = (overrides: Partial<DailyTask>): DailyTask => ({
  id: "task-1",
  title: "Revise chemistry",
  completed: false,
  priority: "medium",
  createdAt: "2026-03-01T08:00:00.000Z",
  scheduledFor: "2026-03-01",
  type: "daily",
  category: "daily",
  timeSpent: 45,
  rolloverCount: 0,
  isRolledOver: false,
  completedAt: null,
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const analyticsSnapshot = {
  todayCompleted: 1,
  todayRemaining: 0,
  dailyCompletionRate: 100,
  weeklyCompletionRate: 75,
  monthlyCompletionRate: 60,
  yearlyCompletionRate: 50,
  weeklyCompletions: [],
  monthlyCompletions: [],
  yearlyCompletions: [],
  statusBreakdown: { completed: 1, incomplete: 0, rolledOver: 0 },
  priorityBreakdown: { high: 0, medium: 1, low: 0 },
  currentStreak: 3,
  longestStreak: 7,
  streakCalendar: [],
  insights: [],
};

describe("daily-task-history", () => {
  it("builds a daily history entry with computed statistics", () => {
    const tasks = [makeTask({ completed: true, completedAt: "2026-03-01T11:00:00.000Z" })];
    const day = buildDailyTaskHistoryDay(
      "2026-03-01",
      tasks,
      {
        total: 1,
        completed: 1,
        rollover: 0,
        byPriority: { high: 0, medium: 1, low: 0 },
      },
      analyticsSnapshot,
    );

    expect(day.statistics.completedTasks).toBe(1);
    expect(day.statistics.incompleteTasks).toBe(0);
    expect(day.statistics.totalTimeSpent).toBe(45);
    expect(day.statistics.completionRate).toBe(100);
    expect(day.tasks).toHaveLength(1);
  });

  it("merges remote history using freshest day updates", () => {
    const local = createEmptyDailyTaskHistoryDataset();
    const remote = createEmptyDailyTaskHistoryDataset();

    local.days["2026-03-01"] = {
      date: "2026-03-01",
      tasks: [],
      statistics: {
        completedTasks: 0,
        incompleteTasks: 1,
        totalTimeSpent: 0,
        completionRate: 0,
        streakDays: 0,
      },
      analytics: {
        dailyCompletionRate: 0,
        weeklyCompletionRate: 0,
        monthlyCompletionRate: 0,
        yearlyCompletionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
      updatedAt: "2026-03-01T09:00:00.000Z",
    };

    remote.days["2026-03-01"] = {
      ...local.days["2026-03-01"],
      statistics: {
        completedTasks: 1,
        incompleteTasks: 0,
        totalTimeSpent: 20,
        completionRate: 100,
        streakDays: 1,
      },
      updatedAt: "2026-03-01T10:00:00.000Z",
    };

    const merged = mergeDailyTaskHistoryDatasets(local, remote);
    expect(merged.days["2026-03-01"]?.statistics.completedTasks).toBe(1);
    expect(merged.days["2026-03-01"]?.statistics.totalTimeSpent).toBe(20);
  });

  it("exports chronologically sorted history", () => {
    const dataset = createEmptyDailyTaskHistoryDataset();
    dataset.days["2026-03-02"] = {
      date: "2026-03-02",
      tasks: [],
      statistics: {
        completedTasks: 0,
        incompleteTasks: 0,
        totalTimeSpent: 0,
        completionRate: 0,
        streakDays: 0,
      },
      analytics: {
        dailyCompletionRate: 0,
        weeklyCompletionRate: 0,
        monthlyCompletionRate: 0,
        yearlyCompletionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
      updatedAt: "2026-03-02T10:00:00.000Z",
    };

    dataset.days["2026-03-01"] = {
      ...dataset.days["2026-03-02"],
      date: "2026-03-01",
      updatedAt: "2026-03-01T10:00:00.000Z",
    };

    const exported = exportDailyTaskHistory(dataset);
    expect(exported.dailyTaskHistory[0]?.date).toBe("2026-03-01");
    expect(exported.dailyTaskHistory[1]?.date).toBe("2026-03-02");
  });
});
