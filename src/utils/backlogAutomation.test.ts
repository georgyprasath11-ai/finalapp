import { describe, expect, test } from "vitest";
import { evaluateTaskBacklog, resolveAutoBacklogReschedule } from "@/utils/backlogAutomation";
import { Task, TaskType } from "@/types/models";

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Task",
  description: "",
  subjectId: null,
  type: TaskType.SHORT_TERM,
  category: "shortTerm",
  scheduledFor: "2026-03-02",
  bucket: "daily",
  priority: "medium",
  estimatedMinutes: null,
  dueDate: "2026-03-02",
  deadline: null,
  categoryId: "category-1",
  status: "active",
  completed: false,
  completedAt: null,
  isBacklog: false,
  isAutoBacklog: false,
  backlogSince: null,
  timeSpent: 0,
  totalTimeSpent: 0,
  totalTimeSeconds: 0,
  sessionCount: 0,
  lastWorkedAt: null,
  isTimerRunning: false,
  order: 1,
  rollovers: 0,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  ...overrides,
});

describe("backlog automation", () => {
  test("past-due short-term task becomes backlog", () => {
    const task = createTask({ type: TaskType.SHORT_TERM, dueDate: "2026-03-01" });
    const updated = evaluateTaskBacklog(task, { todayIso: "2026-03-03", nowMs: Date.parse("2026-03-03T08:00:00.000Z") });
    expect(updated.status).toBe("backlog");
    expect(updated.isAutoBacklog).toBe(true);
  });

  test("past-due long-term task becomes backlog", () => {
    const task = createTask({ type: TaskType.LONG_TERM, category: "longTerm", dueDate: "2026-03-01" });
    const updated = evaluateTaskBacklog(task, { todayIso: "2026-03-03", nowMs: Date.parse("2026-03-03T08:00:00.000Z") });
    expect(updated.status).toBe("backlog");
    expect(updated.isAutoBacklog).toBe(true);
  });

  test("past-due daily task stays unchanged", () => {
    const task = {
      ...createTask({ dueDate: "2026-03-01" }),
      type: TaskType.DAILY,
    } as unknown as Task;
    const updated = evaluateTaskBacklog(task, { todayIso: "2026-03-03", nowMs: Date.parse("2026-03-03T08:00:00.000Z") });
    expect(updated).toBe(task);
  });

  test("completed task never becomes backlog", () => {
    const task = createTask({ dueDate: "2026-03-01", completed: true, status: "completed" });
    const updated = evaluateTaskBacklog(task, { todayIso: "2026-03-03", nowMs: Date.parse("2026-03-03T08:00:00.000Z") });
    expect(updated).toBe(task);
  });

  test("rescheduled future task remains active", () => {
    const task = createTask({
      status: "backlog",
      isAutoBacklog: true,
      isBacklog: true,
      dueDate: "2026-03-01",
      backlogSince: Date.parse("2026-03-02T00:00:00.000Z"),
      bucket: "backlog",
    });
    const reset = resolveAutoBacklogReschedule(task, "2026-03-10", "2026-03-03");
    expect(reset).toEqual({
      status: "active",
      isAutoBacklog: false,
      isBacklog: false,
      backlogSince: null,
      bucket: "daily",
    });
  });
});
