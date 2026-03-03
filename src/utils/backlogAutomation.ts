import { Task, TaskType } from "@/types/models";
import { todayIsoDate } from "@/utils/date";
import { normalizeTaskLifecycleStatus } from "@/utils/task-lifecycle";

interface EvaluateTaskBacklogOptions {
  todayIso?: string;
  nowMs?: number;
}

const isTimedTask = (task: Task): boolean =>
  task.type === TaskType.SHORT_TERM || task.type === TaskType.LONG_TERM;

export const evaluateTaskBacklog = (
  task: Task,
  options: EvaluateTaskBacklogOptions = {},
): Task => {
  const today = options.todayIso ?? todayIsoDate();
  const nowMs = options.nowMs ?? Date.now();
  const status = normalizeTaskLifecycleStatus(task);

  if (!isTimedTask(task) || !task.dueDate || status === "completed" || status === "archived" || task.completed === true) {
    return task;
  }

  if (task.dueDate >= today) {
    return task;
  }

  if (status === "backlog" && task.isAutoBacklog === true) {
    return task;
  }

  const nowIso = new Date(nowMs).toISOString();
  const existingBacklogSince =
    typeof task.backlogSince === "number" && Number.isFinite(task.backlogSince) ? task.backlogSince : nowMs;

  return {
    ...task,
    status: "backlog",
    isAutoBacklog: true,
    isBacklog: true,
    backlogSince: existingBacklogSince,
    bucket: "backlog",
    updatedAt: nowIso,
  };
};

export const runBacklogSweep = (tasks: Task[], options: EvaluateTaskBacklogOptions = {}): Task[] => {
  let changed = false;
  const next = tasks.map((task) => {
    const updated = evaluateTaskBacklog(task, options);
    if (updated !== task) {
      changed = true;
    }
    return updated;
  });

  return changed ? next : tasks;
};

export const resolveAutoBacklogReschedule = (
  task: Task,
  nextDueDate: string | null | undefined,
  todayIso = todayIsoDate(),
) => {
  const status = normalizeTaskLifecycleStatus(task);
  if (status !== "backlog" || task.isAutoBacklog !== true) {
    return null;
  }

  if (!nextDueDate || nextDueDate < todayIso) {
    return null;
  }

  return {
    status: "active" as const,
    isAutoBacklog: false,
    isBacklog: false,
    backlogSince: null,
    bucket: "daily" as const,
  };
};
