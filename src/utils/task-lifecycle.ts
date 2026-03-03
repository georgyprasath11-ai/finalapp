import { Task } from "@/types/models";

export type TaskLifecycleStatus = "active" | "backlog" | "completed" | "archived";
export type LegacyTaskStatus = "incomplete" | "completed";
export type AnyTaskStatus = TaskLifecycleStatus | LegacyTaskStatus;

const isTaskLifecycleStatus = (value: unknown): value is TaskLifecycleStatus =>
  value === "active" || value === "backlog" || value === "completed" || value === "archived";

const isLegacyTaskStatus = (value: unknown): value is LegacyTaskStatus =>
  value === "incomplete" || value === "completed";

export const normalizeTaskLifecycleStatus = (
  task: Pick<Task, "status" | "completed" | "isBacklog">,
): TaskLifecycleStatus => {
  if (task.completed === true) {
    return "completed";
  }

  if (isTaskLifecycleStatus(task.status)) {
    return task.status;
  }

  if (isLegacyTaskStatus(task.status)) {
    return task.status === "completed" ? "completed" : (task.isBacklog === true ? "backlog" : "active");
  }

  return task.isBacklog === true ? "backlog" : "active";
};

export const normalizeTaskIsAutoBacklog = (task: Pick<Task, "isAutoBacklog">): boolean =>
  task.isAutoBacklog === true;
