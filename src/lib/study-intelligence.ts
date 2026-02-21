import { Task, TaskCategory, TaskPriority, StudySession, TimerMode } from "@/types/models";
import { createDefaultTaskCategories } from "@/lib/constants";
import { createId } from "@/utils/id";

export const MAX_SESSION_SECONDS = 24 * 60 * 60;

export const isoDateToDeadlineMs = (isoDate: string | null | undefined): number | null => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const deadline = Date.parse(`${isoDate}T23:59:59`);
  return Number.isFinite(deadline) ? deadline : null;
};

export const deadlineMsToIsoDate = (deadlineMs: number | null | undefined): string | null => {
  if (typeof deadlineMs !== "number" || !Number.isFinite(deadlineMs)) {
    return null;
  }

  return new Date(deadlineMs).toISOString().slice(0, 10);
};

export const daysInBacklog = (backlogSince: number | null | undefined, nowMs = Date.now()): number => {
  if (typeof backlogSince !== "number" || !Number.isFinite(backlogSince)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - backlogSince) / 86_400_000));
};

export const derivedBacklogPriority = (backlogSince: number | null | undefined, nowMs = Date.now()): TaskPriority => {
  const days = daysInBacklog(backlogSince, nowMs);
  if (days >= 7) {
    return "high";
  }

  if (days >= 3) {
    return "medium";
  }

  return "low";
};

export const normalizeCategories = (
  categories: TaskCategory[] | undefined,
  activeCategoryId: string | null | undefined,
  nowMs = Date.now(),
): { categories: TaskCategory[]; activeCategoryId: string | null } => {
  const base = (categories ?? [])
    .map((category) => ({
      id: category.id,
      name: category.name.trim(),
      createdAt: Number.isFinite(category.createdAt) ? category.createdAt : nowMs,
    }))
    .filter((category) => category.id.trim().length > 0 && category.name.length > 0);

  const deduped: TaskCategory[] = [];
  const seen = new Set<string>();

  base.forEach((category) => {
    if (seen.has(category.id)) {
      return;
    }

    seen.add(category.id);
    deduped.push(category);
  });

  const resolved = deduped.length > 0 ? deduped : createDefaultTaskCategories(nowMs);
  const nextActive =
    activeCategoryId && resolved.some((category) => category.id === activeCategoryId)
      ? activeCategoryId
      : (resolved[0]?.id ?? null);

  return {
    categories: resolved,
    activeCategoryId: nextActive,
  };
};

const normalizeSession = (session: StudySession): StudySession => {
  const fallbackStart = Number.isFinite(Date.parse(session.startedAt)) ? Date.parse(session.startedAt) : Date.now();
  const startTime =
    typeof session.startTime === "number" && Number.isFinite(session.startTime) ? session.startTime : fallbackStart;

  const durationSecondsFromMs = Math.max(0, Math.floor(session.durationMs / 1000));
  const rawDurationSeconds =
    typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds)
      ? Math.floor(session.durationSeconds)
      : durationSecondsFromMs;
  const durationSeconds = Math.min(MAX_SESSION_SECONDS, Math.max(0, rawDurationSeconds));

  const isActive = session.isActive === true;
  const rawEndTime =
    typeof session.endTime === "number" && Number.isFinite(session.endTime)
      ? session.endTime
      : Number.isFinite(Date.parse(session.endedAt))
        ? Date.parse(session.endedAt)
        : startTime + durationSeconds * 1000;

  const endTime = isActive ? null : Math.max(startTime, rawEndTime);
  const endedAt = new Date((endTime ?? (startTime + durationSeconds * 1000))).toISOString();

  return {
    ...session,
    startedAt: new Date(startTime).toISOString(),
    endedAt,
    durationMs: durationSeconds * 1000,
    startTime,
    endTime,
    durationSeconds,
    isActive,
  };
};

const normalizeTaskBase = (
  task: Task,
  fallbackCategoryId: string,
  nowMs: number,
): Task => {
  const deadline =
    typeof task.deadline === "number" && Number.isFinite(task.deadline)
      ? task.deadline
      : isoDateToDeadlineMs(task.dueDate);

  const completed = task.completed === true;
  const shouldBeBacklog = !completed && deadline !== null && nowMs > deadline;
  const backlogSince = shouldBeBacklog
    ? (typeof task.backlogSince === "number" && Number.isFinite(task.backlogSince) ? task.backlogSince : nowMs)
    : null;

  const bucket = shouldBeBacklog ? "backlog" : "daily";

  return {
    ...task,
    categoryId: task.categoryId ?? fallbackCategoryId,
    deadline,
    dueDate: task.dueDate ?? deadlineMsToIsoDate(deadline),
    isBacklog: shouldBeBacklog,
    backlogSince,
    priority: shouldBeBacklog ? derivedBacklogPriority(backlogSince, nowMs) : task.priority,
    bucket,
    totalTimeSeconds: typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds) ? task.totalTimeSeconds : 0,
    sessionCount: typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount) ? Math.max(0, Math.floor(task.sessionCount)) : 0,
    lastWorkedAt: typeof task.lastWorkedAt === "number" && Number.isFinite(task.lastWorkedAt) ? task.lastWorkedAt : null,
  };
};

const finalizeDuplicateActiveSessions = (sessions: StudySession[]): StudySession[] => {
  const activeTaskSeen = new Set<string>();

  return sessions.map((session) => {
    if (session.isActive !== true || !session.taskId) {
      return session;
    }

    if (activeTaskSeen.has(session.taskId)) {
      const endTime = session.startTime + session.durationSeconds * 1000;
      return {
        ...session,
        isActive: false,
        endTime,
        endedAt: new Date(endTime).toISOString(),
      };
    }

    activeTaskSeen.add(session.taskId);
    return session;
  });
};

export const recomputeTaskTotalsFromSessions = (tasks: Task[], sessions: StudySession[]): Task[] => {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const lastWorked = new Map<string, number>();

  sessions.forEach((session) => {
    if (!session.taskId || session.isActive) {
      return;
    }

    const duration = Math.max(0, Math.floor(session.durationSeconds));
    totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + duration);
    counts.set(session.taskId, (counts.get(session.taskId) ?? 0) + 1);

    const endedAtMs =
      typeof session.endTime === "number" && Number.isFinite(session.endTime)
        ? session.endTime
        : Date.parse(session.endedAt);
    if (Number.isFinite(endedAtMs)) {
      lastWorked.set(session.taskId, Math.max(lastWorked.get(session.taskId) ?? 0, endedAtMs));
    }
  });

  return tasks.map((task) => ({
    ...task,
    totalTimeSeconds: totals.get(task.id) ?? 0,
    sessionCount: counts.get(task.id) ?? 0,
    lastWorkedAt: lastWorked.get(task.id) ?? null,
  }));
};

export const normalizeStudyCollections = (
  tasks: Task[],
  sessions: StudySession[],
  categories: TaskCategory[] | undefined,
  activeCategoryId: string | null | undefined,
  nowMs = Date.now(),
): {
  tasks: Task[];
  sessions: StudySession[];
  categories: TaskCategory[];
  activeCategoryId: string | null;
} => {
  const normalizedCategories = normalizeCategories(categories, activeCategoryId, nowMs);
  const fallbackCategoryId = normalizedCategories.activeCategoryId ?? createDefaultTaskCategories(nowMs)[0].id;

  const normalizedSessions = finalizeDuplicateActiveSessions(sessions.map(normalizeSession));
  const normalizedTasks = tasks.map((task) => normalizeTaskBase(task, fallbackCategoryId, nowMs));
  const tasksWithTotals = recomputeTaskTotalsFromSessions(normalizedTasks, normalizedSessions);

  return {
    tasks: tasksWithTotals,
    sessions: normalizedSessions,
    categories: normalizedCategories.categories,
    activeCategoryId: normalizedCategories.activeCategoryId,
  };
};

export const buildActiveSession = (
  taskId: string,
  subjectId: string | null,
  mode: TimerMode,
  phase: "focus" | "manual",
  startTime: number,
  initialDurationSeconds = 0,
): StudySession => {
  const durationSeconds = Math.max(0, Math.min(MAX_SESSION_SECONDS, Math.floor(initialDurationSeconds)));
  const startIso = new Date(startTime).toISOString();

  return {
    id: createId(),
    subjectId,
    taskId,
    startedAt: startIso,
    endedAt: new Date(startTime + durationSeconds * 1000).toISOString(),
    durationMs: durationSeconds * 1000,
    startTime,
    endTime: null,
    durationSeconds,
    isActive: true,
    mode,
    phase,
    rating: null,
    reflection: "",
    createdAt: startIso,
  };
};