import { SessionRating, Task, TaskCategory, TaskPriority, StudySession, StudySessionStatus, TimerMode } from "@/types/models";
import {
  createDefaultTaskCategories,
  createSystemTaskCategories,
  firstCustomTaskCategoryId,
  isSystemTaskCategoryId,
  SYSTEM_TASK_CATEGORY_IDS,
} from "@/lib/constants";
import { createId } from "@/utils/id";
import { classifyTimedTaskType } from "@/lib/daily-tasks";

export const MAX_SESSION_MINUTES = 10_000;
export const MAX_SESSION_SECONDS = MAX_SESSION_MINUTES * 60;

const TAB_ID_STORAGE_KEY = "study-dashboard:tab-id";

export type SessionTaskAllocations = Record<string, number>;

const isSessionStatus = (value: unknown): value is StudySessionStatus =>
  value === "running" || value === "paused" || value === "completed";

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asTaskId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSessionRating = (value: unknown): SessionRating | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "productive" || normalized === "average" || normalized === "distracted") {
    return normalized;
  }

  if (normalized === "great" || normalized === "good") {
    return "productive";
  }

  if (normalized === "okay" || normalized === "ok") {
    return "average";
  }

  return null;
};

const normalizeReflectionComment = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const uniqueTaskIds = (values: Array<unknown>): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const taskId = asTaskId(value);
    if (!taskId || seen.has(taskId)) {
      return;
    }

    seen.add(taskId);
    ids.push(taskId);
  });

  return ids;
};

const allocationSum = (allocations: SessionTaskAllocations): number =>
  Object.values(allocations).reduce((sum, value) => sum + clampSessionSeconds(value), 0);

const sanitizeAllocations = (
  value: unknown,
  allowedTaskIds: Set<string> | null,
): SessionTaskAllocations => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const cleaned: SessionTaskAllocations = {};

  Object.entries(source).forEach(([key, rawValue]) => {
    const taskId = asTaskId(key);
    if (!taskId) {
      return;
    }

    if (allowedTaskIds && !allowedTaskIds.has(taskId)) {
      return;
    }

    const seconds = clampSessionSeconds(typeof rawValue === "number" ? rawValue : Number(rawValue));
    if (seconds <= 0) {
      return;
    }

    cleaned[taskId] = seconds;
  });

  return cleaned;
};

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

export const resolveSessionTaskIds = (session: StudySession): string[] => {
  const fromSessionArray = Array.isArray(session.taskIds) ? session.taskIds : [];
  return uniqueTaskIds([...fromSessionArray, session.taskId]);
};

export const resolveSessionTaskAllocations = (
  session: StudySession,
  fallbackDurationSeconds?: number,
): SessionTaskAllocations => {
  const taskIds = resolveSessionTaskIds(session);
  const allowedTaskIds = taskIds.length > 0 ? new Set(taskIds) : null;
  const sanitized = sanitizeAllocations(session.taskAllocations, allowedTaskIds);

  if (Object.keys(sanitized).length > 0) {
    return sanitized;
  }

  const fallbackTaskId = asTaskId(session.taskId);
  if (!fallbackTaskId) {
    return {};
  }

  const fallbackDuration = clampSessionSeconds(
    fallbackDurationSeconds ??
      (typeof session.accumulatedTime === "number" && Number.isFinite(session.accumulatedTime)
        ? session.accumulatedTime
        : typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds)
          ? session.durationSeconds
          : Math.floor(session.durationMs / 1000)),
  );

  return fallbackDuration > 0 ? { [fallbackTaskId]: fallbackDuration } : {};
};

export const rebalanceSessionTaskAllocations = (
  allocations: SessionTaskAllocations,
  taskIds: string[],
  totalSeconds: number,
  preferredTaskId: string | null,
): SessionTaskAllocations => {
  const normalizedTaskIds = uniqueTaskIds(taskIds);
  const allowedTaskIds = normalizedTaskIds.length > 0 ? new Set(normalizedTaskIds) : null;
  const next = sanitizeAllocations(allocations, allowedTaskIds);
  const resolvedTotal = clampSessionSeconds(totalSeconds);

  if (resolvedTotal <= 0) {
    return {};
  }

  const preferred =
    preferredTaskId && (!allowedTaskIds || allowedTaskIds.has(preferredTaskId))
      ? preferredTaskId
      : normalizedTaskIds[0] ?? Object.keys(next)[0] ?? null;

  const currentTotal = allocationSum(next);

  if (currentTotal <= 0) {
    if (!preferred) {
      return {};
    }

    return {
      [preferred]: resolvedTotal,
    };
  }

  let difference = resolvedTotal - currentTotal;
  if (difference === 0) {
    return next;
  }

  const adjustmentOrder = uniqueTaskIds([
    preferred,
    ...normalizedTaskIds,
    ...Object.keys(next),
  ]);

  adjustmentOrder.forEach((taskId) => {
    if (difference === 0) {
      return;
    }

    const existing = clampSessionSeconds(next[taskId] ?? 0);

    if (difference > 0) {
      next[taskId] = existing + difference;
      difference = 0;
      return;
    }

    const updated = existing + difference;
    if (updated >= 0) {
      next[taskId] = updated;
      difference = 0;
    } else {
      next[taskId] = 0;
      difference = updated;
    }
  });

  const cleaned: SessionTaskAllocations = {};
  Object.entries(next).forEach(([taskId, seconds]) => {
    const normalized = clampSessionSeconds(seconds);
    if (normalized > 0) {
      cleaned[taskId] = normalized;
    }
  });

  if (allocationSum(cleaned) === 0 && preferred) {
    return {
      [preferred]: resolvedTotal,
    };
  }

  return cleaned;
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
  const taskIds = resolveSessionTaskIds(session);
  const preferredTaskId = asTaskId(session.taskId) ?? taskIds[taskIds.length - 1] ?? null;
  const taskAllocations = rebalanceSessionTaskAllocations(
    resolveSessionTaskAllocations(session, durationSeconds),
    taskIds,
    durationSeconds,
    preferredTaskId,
  );
  const reflectionRating = normalizeSessionRating(
    (session as Record<string, unknown>).reflectionRating ?? (session as Record<string, unknown>).rating,
  );
  const reflectionComment = normalizeReflectionComment(
    (session as Record<string, unknown>).reflectionComment ?? (session as Record<string, unknown>).reflection,
  );
  const reflectionTimestampRaw = asFiniteNumber((session as Record<string, unknown>).reflectionTimestamp);
  const reflectionTimestamp = reflectionRating ? (reflectionTimestampRaw ?? endTime) : null;

  return {
    ...session,
    sessionId: session.sessionId ?? session.id,
    tabId: session.tabId ?? resolveBrowserTabId(),
    taskId: preferredTaskId,
    taskIds,
    taskAllocations,
    activeTaskId: null,
    activeTaskStartedAt: null,
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
    reflectionRating,
    reflectionComment,
    reflectionTimestamp,
    rating: reflectionRating,
    reflection: reflectionComment,
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

  const taskIds = resolveSessionTaskIds(session);
  const fallbackTaskId = taskIds[taskIds.length - 1] ?? null;
  const desiredActiveTaskId = asTaskId(session.activeTaskId) ?? asTaskId(session.taskId) ?? fallbackTaskId;
  const activeTaskId =
    status === "completed"
      ? null
      : (desiredActiveTaskId && taskIds.includes(desiredActiveTaskId)
          ? desiredActiveTaskId
          : fallbackTaskId);

  const taskAllocations =
    status === "running"
      ? rebalanceSessionTaskAllocations(
          resolveSessionTaskAllocations(session),
          taskIds,
          allocationSum(resolveSessionTaskAllocations(session)),
          activeTaskId,
        )
      : rebalanceSessionTaskAllocations(
          resolveSessionTaskAllocations(session, durationSeconds),
          taskIds,
          durationSeconds,
          activeTaskId ?? fallbackTaskId,
        );

  const runningStart = asFiniteNumber(session.lastStartTimestamp);
  const activeTaskStartedAt =
    status === "running"
      ? (asFiniteNumber(session.activeTaskStartedAt) ?? runningStart ?? nowMs)
      : null;

  const lastStartTimestamp = status === "running" ? (runningStart ?? activeTaskStartedAt ?? nowMs) : null;
  const reflectionRating = normalizeSessionRating(
    (session as Record<string, unknown>).reflectionRating ?? (session as Record<string, unknown>).rating,
  );
  const reflectionComment = normalizeReflectionComment(
    (session as Record<string, unknown>).reflectionComment ?? (session as Record<string, unknown>).reflection,
  );
  const reflectionTimestampSource = asFiniteNumber((session as Record<string, unknown>).reflectionTimestamp);
  const completedAtMs = endTime ?? (startTime + durationSeconds * 1000);
  const reflectionTimestamp = reflectionRating
    ? (reflectionTimestampSource ?? (status === "completed" ? completedAtMs : nowMs))
    : null;

  return {
    ...session,
    id,
    sessionId: session.sessionId ?? id,
    tabId: typeof session.tabId === "string" && session.tabId.length > 0 ? session.tabId : fallbackTabId,
    taskId: activeTaskId ?? fallbackTaskId,
    taskIds,
    taskAllocations,
    activeTaskId,
    activeTaskStartedAt,
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
    reflectionRating,
    reflectionComment,
    reflectionTimestamp,
    rating: reflectionRating,
    reflection: reflectionComment,
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

  const fallbackDate = new Date(nowMs);
  const fallbackMonth = String(fallbackDate.getMonth() + 1).padStart(2, "0");
  const fallbackDay = String(fallbackDate.getDate()).padStart(2, "0");
  const fallbackIso = [fallbackDate.getFullYear(), fallbackMonth, fallbackDay].join("-");
  const scheduledFor = task.dueDate ?? task.scheduledFor ?? deadlineMsToIsoDate(deadline) ?? fallbackIso;
  const timedType = classifyTimedTaskType(scheduledFor, fallbackIso);

  const totalTimeSeconds =
    typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
      ? task.totalTimeSeconds
      : 0;

  return {
    ...task,
    type: timedType,
    scheduledFor,
    categoryId,
    status,
    completed,
    deadline,
    dueDate: scheduledFor,
    isBacklog: shouldBeBacklog,
    backlogSince,
    priority: shouldBeBacklog ? derivedBacklogPriority(backlogSince, nowMs) : task.priority,
    bucket,
    totalTimeSpent:
      typeof task.totalTimeSpent === "number" && Number.isFinite(task.totalTimeSpent)
        ? task.totalTimeSpent
        : totalTimeSeconds,
    totalTimeSeconds,
    sessionCount:
      typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
        ? Math.max(0, Math.floor(task.sessionCount))
        : 0,
    lastWorkedAt:
      typeof task.lastWorkedAt === "number" && Number.isFinite(task.lastWorkedAt) ? task.lastWorkedAt : null,
    isTimerRunning: task.isTimerRunning === true,
  };
};

export const recomputeTaskTotalsFromSessions = (tasks: Task[], sessions: StudySession[]): Task[] => {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const lastWorked = new Map<string, number>();

  sessions.forEach((session) => {
    if (session.isActive === true || session.status !== "completed") {
      return;
    }

    const duration = clampSessionSeconds(
      asFiniteNumber(session.accumulatedTime) ??
        asFiniteNumber(session.durationSeconds) ??
        Math.floor(session.durationMs / 1000),
    );

    const taskIds = resolveSessionTaskIds(session);
    const preferredTaskId = asTaskId(session.taskId) ?? taskIds[taskIds.length - 1] ?? null;
    const allocations = rebalanceSessionTaskAllocations(
      resolveSessionTaskAllocations(session, duration),
      taskIds,
      duration,
      preferredTaskId,
    );

    const endedAtMs =
      typeof session.endTime === "number" && Number.isFinite(session.endTime)
        ? session.endTime
        : Date.parse(session.endedAt);

    Object.entries(allocations).forEach(([taskId, seconds]) => {
      if (seconds <= 0) {
        return;
      }

      totals.set(taskId, (totals.get(taskId) ?? 0) + seconds);
      counts.set(taskId, (counts.get(taskId) ?? 0) + 1);

      if (Number.isFinite(endedAtMs)) {
        lastWorked.set(taskId, Math.max(lastWorked.get(taskId) ?? 0, endedAtMs));
      }
    });
  });

  return tasks.map((task) => {
    const totalTimeSeconds = totals.get(task.id) ?? 0;

    return {
      ...task,
      totalTimeSpent: totalTimeSeconds,
      totalTimeSeconds,
      sessionCount: counts.get(task.id) ?? 0,
      lastWorkedAt: lastWorked.get(task.id) ?? null,
    };
  });
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
  const activeTaskStartedAt = status === "running" ? (options.lastStartTimestamp ?? Date.now()) : null;

  return {
    id,
    sessionId: id,
    subjectId,
    taskId,
    taskIds: [taskId],
    taskAllocations: durationSeconds > 0 ? { [taskId]: durationSeconds } : {},
    activeTaskId: taskId,
    activeTaskStartedAt,
    tabId: options.tabId ?? resolveBrowserTabId(),
    startedAt: startIso,
    endedAt: new Date(startTime + durationSeconds * 1000).toISOString(),
    durationMs: durationSeconds * 1000,
    startTime,
    endTime: null,
    durationSeconds,
    accumulatedTime: durationSeconds,
    status,
    lastStartTimestamp: status === "running" ? activeTaskStartedAt : null,
    isActive: true,
    reflectionRating: null,
    reflectionComment: "",
    reflectionTimestamp: null,
    mode,
    phase,
    rating: null,
    reflection: "",
    createdAt: startIso,
  };
};




