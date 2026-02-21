import { Task, TaskCategory, TaskPriority, StudySession, StudySessionStatus, TimerMode } from "@/types/models";
import { createDefaultTaskCategories, createSystemTaskCategories, firstCustomTaskCategoryId, isSystemTaskCategoryId, SYSTEM_TASK_CATEGORY_IDS } from "@/lib/constants";
import { createId } from "@/utils/id";

export const MAX_SESSION_MINUTES = 10_000;
export const MAX_SESSION_SECONDS = MAX_SESSION_MINUTES * 60;

const TAB_ID_STORAGE_KEY = "study-dashboard:tab-id";

const isSessionStatus = (value: unknown): value is StudySessionStatus =>
  value === "running" || value === "paused" || value === "completed";

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const clampSessionSeconds = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_SESSION_SECONDS, Math.floor(value)));
};

export const resolveBrowserTabId = (): string => {
  if (typeof window === "undefined") {
    return "server-tab";
  }

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }

    const created = createId();
    window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return "fallback-tab";
  }
};

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

  const custom: TaskCategory[] = [];
  const seenCustom = new Set<string>();

  base.forEach((category) => {
    if (isSystemTaskCategoryId(category.id) || seenCustom.has(category.id)) {
      return;
    }

    seenCustom.add(category.id);
    custom.push(category);
  });

  const seededCustom = createDefaultTaskCategories(nowMs).filter((category) => !isSystemTaskCategoryId(category.id));
  const resolvedCustom = custom.length > 0 ? custom : seededCustom;

  const resolved = [...createSystemTaskCategories(nowMs), ...resolvedCustom];
  const nextActive =
    activeCategoryId && resolved.some((category) => category.id === activeCategoryId)
      ? activeCategoryId
      : SYSTEM_TASK_CATEGORY_IDS.incomplete;

  return {
    categories: resolved,
    activeCategoryId: nextActive,
  };
};

const completedSessionSnapshot = (session: StudySession): StudySession => {
  const startTime = asFiniteNumber(session.startTime) ?? Date.now();
  const durationSeconds = clampSessionSeconds(
    asFiniteNumber(session.accumulatedTime) ??
      asFiniteNumber(session.durationSeconds) ??
      Math.floor(session.durationMs / 1000),
  );
  const endTime = startTime + durationSeconds * 1000;

  return {
    ...session,
    sessionId: session.sessionId ?? session.id,
    tabId: session.tabId ?? resolveBrowserTabId(),
    startTime,
    endTime,
    startedAt: new Date(startTime).toISOString(),
    endedAt: new Date(endTime).toISOString(),
    durationSeconds,
    accumulatedTime: durationSeconds,
    durationMs: durationSeconds * 1000,
    status: "completed",
    lastStartTimestamp: null,
    isActive: false,
  };
};

const normalizeSession = (session: StudySession, fallbackTabId: string, nowMs: number): StudySession => {
  const id = typeof session.id === "string" && session.id.trim().length > 0 ? session.id : createId();
  const fallbackStart = Number.isFinite(Date.parse(session.startedAt)) ? Date.parse(session.startedAt) : nowMs;
  const startTime = asFiniteNumber(session.startTime) ?? fallbackStart;

  const durationSecondsFromMs = Math.max(0, Math.floor(session.durationMs / 1000));
  const durationSeconds = clampSessionSeconds(
    asFiniteNumber(session.accumulatedTime) ??
      asFiniteNumber(session.durationSeconds) ??
      durationSecondsFromMs,
  );

  const legacyIsActive = session.isActive === true;
  const rawStatus = isSessionStatus(session.status)
    ? session.status
    : legacyIsActive
      ? "paused"
      : "completed";
  const status: StudySessionStatus = rawStatus === "completed" ? "completed" : rawStatus;
  const isActive = status !== "completed";

  const rawEndTime =
    asFiniteNumber(session.endTime) ??
    (Number.isFinite(Date.parse(session.endedAt)) ? Date.parse(session.endedAt) : startTime + durationSeconds * 1000);

  const endTime = isActive ? null : Math.max(startTime, rawEndTime);
  const endedAt = new Date((endTime ?? (startTime + durationSeconds * 1000))).toISOString();

  const runningStart = asFiniteNumber(session.lastStartTimestamp);
  const lastStartTimestamp = status === "running" ? (runningStart ?? startTime) : null;

  return {
    ...session,
    id,
    sessionId: session.sessionId ?? id,
    tabId: typeof session.tabId === "string" && session.tabId.length > 0 ? session.tabId : fallbackTabId,
    startedAt: new Date(startTime).toISOString(),
    endedAt,
    durationMs: durationSeconds * 1000,
    startTime,
    endTime,
    durationSeconds,
    accumulatedTime: durationSeconds,
    status,
    lastStartTimestamp,
    isActive,
  };
};

const finalizeDuplicateActiveSessions = (sessions: StudySession[]): StudySession[] => {
  const activeIndexes = sessions
    .map((session, index) => ({ index, session }))
    .filter(({ session }) => session.isActive === true && session.status !== "completed");

  if (activeIndexes.length <= 1) {
    return sessions;
  }

  const keep = activeIndexes.reduce((best, candidate) => {
    const bestStart = asFiniteNumber(best.session.startTime) ?? 0;
    const candidateStart = asFiniteNumber(candidate.session.startTime) ?? 0;
    return candidateStart > bestStart ? candidate : best;
  });

  return sessions.map((session, index) => {
    if (index === keep.index) {
      return session;
    }

    if (session.isActive !== true || session.status === "completed") {
      return session;
    }

    return completedSessionSnapshot(session);
  });
};

const normalizeTaskBase = (
  task: Task,
  fallbackCategoryId: string | null,
  nowMs: number,
): Task => {
  const deadline =
    typeof task.deadline === "number" && Number.isFinite(task.deadline)
      ? task.deadline
      : isoDateToDeadlineMs(task.dueDate);

  const status = task.status === "completed" || task.completed === true ? "completed" : "incomplete";
  const completed = status === "completed";
  const shouldBeBacklog = !completed && deadline !== null && nowMs > deadline;
  const backlogSince = shouldBeBacklog
    ? (typeof task.backlogSince === "number" && Number.isFinite(task.backlogSince) ? task.backlogSince : nowMs)
    : null;

  const bucket = shouldBeBacklog ? "backlog" : "daily";
  const categoryId =
    typeof task.categoryId === "string" && task.categoryId.length > 0 && !isSystemTaskCategoryId(task.categoryId)
      ? task.categoryId
      : (fallbackCategoryId ?? undefined);

  return {
    ...task,
    categoryId,
    status,
    completed,
    deadline,
    dueDate: task.dueDate ?? deadlineMsToIsoDate(deadline),
    isBacklog: shouldBeBacklog,
    backlogSince,
    priority: shouldBeBacklog ? derivedBacklogPriority(backlogSince, nowMs) : task.priority,
    bucket,
    totalTimeSeconds:
      typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
        ? task.totalTimeSeconds
        : 0,
    sessionCount:
      typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
        ? Math.max(0, Math.floor(task.sessionCount))
        : 0,
    lastWorkedAt:
      typeof task.lastWorkedAt === "number" && Number.isFinite(task.lastWorkedAt) ? task.lastWorkedAt : null,
  };
};

export const recomputeTaskTotalsFromSessions = (tasks: Task[], sessions: StudySession[]): Task[] => {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const lastWorked = new Map<string, number>();

  sessions.forEach((session) => {
    if (!session.taskId || session.isActive === true || session.status !== "completed") {
      return;
    }

    const duration = clampSessionSeconds(
      asFiniteNumber(session.accumulatedTime) ??
        asFiniteNumber(session.durationSeconds) ??
        Math.floor(session.durationMs / 1000),
    );

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
  const fallbackCategoryId = firstCustomTaskCategoryId(normalizedCategories.categories);

  const fallbackTabId = resolveBrowserTabId();
  const normalizedSessions = finalizeDuplicateActiveSessions(
    sessions.map((session) => normalizeSession(session, fallbackTabId, nowMs)),
  );

  const normalizedTasks = tasks.map((task) => normalizeTaskBase(task, fallbackCategoryId, nowMs));
  const tasksWithTotals = recomputeTaskTotalsFromSessions(normalizedTasks, normalizedSessions);

  return {
    tasks: tasksWithTotals,
    sessions: normalizedSessions,
    categories: normalizedCategories.categories,
    activeCategoryId: normalizedCategories.activeCategoryId,
  };
};

interface BuildActiveSessionOptions {
  tabId?: string;
  status?: "running" | "paused";
  lastStartTimestamp?: number | null;
}

export const buildActiveSession = (
  taskId: string,
  subjectId: string | null,
  mode: TimerMode,
  phase: "focus" | "manual",
  startTime: number,
  initialDurationSeconds = 0,
  options: BuildActiveSessionOptions = {},
): StudySession => {
  const durationSeconds = clampSessionSeconds(initialDurationSeconds);
  const startIso = new Date(startTime).toISOString();
  const id = createId();
  const status = options.status === "paused" ? "paused" : "running";

  return {
    id,
    sessionId: id,
    subjectId,
    taskId,
    tabId: options.tabId ?? resolveBrowserTabId(),
    startedAt: startIso,
    endedAt: new Date(startTime + durationSeconds * 1000).toISOString(),
    durationMs: durationSeconds * 1000,
    startTime,
    endTime: null,
    durationSeconds,
    accumulatedTime: durationSeconds,
    status,
    lastStartTimestamp:
      status === "running"
        ? (options.lastStartTimestamp ?? Date.now())
        : null,
    isActive: true,
    mode,
    phase,
    rating: null,
    reflection: "",
    createdAt: startIso,
  };
};