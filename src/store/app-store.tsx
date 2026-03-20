import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { computeAnalytics } from "@/lib/analytics";
import { buildLovableExport } from "@/lib/lovable-export";
import { classifyTimedTaskType } from "@/lib/daily-tasks";
import { resolveAutoBacklogReschedule, runBacklogSweep } from "@/utils/backlogAutomation";
import {
  APP_SCHEMA_VERSION,
  DEFAULT_PARENT_VIEWER,
  DEFAULT_SETTINGS,
  DEFAULT_STUDY_GOALS,
  DEFAULT_VACATION_MODE,
  DEFAULT_WORKOUT_GOALS,
  DEFAULT_WORKOUT_DATA,
  DEFAULT_TIMER_SNAPSHOT,
  EMPTY_USER_DATA,
  PARENT_FAILED_ATTEMPT_LIMIT,
  PARENT_LOCKOUT_MS,
  PARENT_OTP_EXPIRY_MS,
  VACATION_COOLDOWN_DAYS,
  VACATION_MAX_DURATION_DAYS,
  createDefaultTaskCategories,
  firstCustomTaskCategoryId,
  isSystemTaskCategoryId,
  PROFILES_SCHEMA_VERSION,
  SHORT_TERM_TASK_DAYS_THRESHOLD,
  SYSTEM_TASK_CATEGORY_IDS,
  STORAGE_KEYS,
} from "@/lib/constants";
import { browserStorageAdapter } from "@/lib/storage";
import {
  AppAnalytics,
  AppRole,
  AppSettings,
  DailyTask,
  GoalSettings,
  ParentViewerState,
  PendingReflection,
  PomodoroPhase,
  ProfilesState,
  SessionRating,
  StudySession,
  Subject,
  Task,
  TaskBucket,
  TaskCategory,
  TaskPriority,
  TaskLifecycleStatus,
  TaskType,
  TimerMode,
  TimerSnapshot,
  UserData,
  UserProfile,
  VacationModeState,
  WorkoutData,
  WorkoutExercise,
  WorkoutSession,
  canUseTimer,
} from "@/types/models";
import { LocalStorageMigrationMap } from "@/types/storage";
import {
  buildActiveSession,
  clampSessionSeconds,
  isoDateToDeadlineMs,
  MAX_SESSION_SECONDS,
  normalizeStudyCollections,
  rebalanceSessionTaskAllocations,
  resolveBrowserTabId,
  resolveSessionTaskAllocations,
  resolveSessionTaskIds,
} from "@/lib/study-intelligence";
import { addDays, dayDiff, todayIsoDate } from "@/utils/date";
import { createId } from "@/utils/id";
import { normalizeTaskLifecycleStatus } from "@/utils/task-lifecycle";
import {
  ParentViewerSession,
  appendParentViewerAuditEvent,
  buildParentViewerAuditEvent,
  clearParentRateLimit,
  clearParentViewerSession,
  constantTimeEqualHex,
  consumeParentRateLimitAttempt,
  formatParentOtpForDisplay,
  generateParentOtp,
  getParentViewerClientId,
  normalizeParentOtpInput,
  readParentViewerSession,
  sha256Hex,
  writeParentViewerSession,
} from "@/lib/parent-viewer";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

interface DailyTaskStoreRef {
  getDailyTasks: () => DailyTask[];
  toggleDailyTask: (taskId: string, completed: boolean, playSound?: boolean) => void;
}

const dailyTaskStoreRef: { current: DailyTaskStoreRef | null } = { current: null };

export const registerDailyTaskStore = (ref: DailyTaskStoreRef | null) => {
  dailyTaskStoreRef.current = ref;
};

const minTimedTaskDueDate = (todayIso = todayIsoDate()): string => addDays(todayIso, 2);

const normalizeTimedTaskDueDate = (candidate: string | null | undefined, todayIso = todayIsoDate()): string => {
  const fallback = minTimedTaskDueDate(todayIso);
  if (!candidate || !isIsoDate(candidate)) {
    return fallback;
  }

  return dayDiff(todayIso, candidate) > 1 ? candidate : fallback;
};

const isValidCustomCategoryId = (categories: TaskCategory[], categoryId: string | null | undefined): categoryId is string => {
  if (typeof categoryId !== "string" || categoryId.trim().length === 0 || isSystemTaskCategoryId(categoryId)) {
    return false;
  }

  return categories.some((category) => category.id === categoryId && !isSystemTaskCategoryId(category.id));
};

const resolveTaskCategoryId = (
  categories: TaskCategory[],
  requestedCategoryId: string | null | undefined,
  preferredCategoryId?: string | null,
): string | undefined => {
  if (isValidCustomCategoryId(categories, requestedCategoryId)) {
    return requestedCategoryId;
  }

  if (isValidCustomCategoryId(categories, preferredCategoryId)) {
    return preferredCategoryId;
  }

  return firstCustomTaskCategoryId(categories) ?? undefined;
};

export type SubjectTaskMoveDestination = "shortTerm" | "longTerm" | "daily";

export interface SubjectTaskMoveOptions {
  existingDailyTitleKeys?: string[];
  scheduledFor?: string;
}

export interface SubjectTaskDailyDraft {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
}

export interface SubjectTaskMoveResult {
  ok: boolean;
  error?: string;
  movedTaskId?: string;
  destination?: SubjectTaskMoveDestination;
  timerStopped?: boolean;
  dailyTaskDraft?: SubjectTaskDailyDraft;
  rollbackSnapshot?: UserData;
}

export interface DeleteTaskCategoryOptions {
  strategy: "move" | "delete";
  targetCategoryId?: string;
}

export interface DeleteTaskCategoryResult {
  ok: boolean;
  error?: string;
}
export interface ParentAccessCodeResult {
  ok: boolean;
  code?: string;
  displayCode?: string;
  expiresAt?: string;
  error?: string;
}

export interface ParentAccessVerificationResult {
  ok: boolean;
  error?: string;
  status?: number;
  retryAfterMs?: number;
  lockedUntil?: string | null;
}

export interface VacationModeMutationResult {
  ok: boolean;
  error?: string;
  state?: VacationModeState;
}

const destinationType = (destination: Exclude<SubjectTaskMoveDestination, "daily">): TaskType =>
  destination === "shortTerm" ? TaskType.SHORT_TERM : TaskType.LONG_TERM;

const destinationCategory = (
  destination: Exclude<SubjectTaskMoveDestination, "daily">,
): "shortTerm" | "longTerm" => (destination === "shortTerm" ? "shortTerm" : "longTerm");

const destinationLabel = (destination: SubjectTaskMoveDestination): string => {
  if (destination === "daily") {
    return "Daily Tasks";
  }

  return destination === "shortTerm" ? "Short-Term Tasks" : "Long-Term Tasks";
};

const resolveDueDateForDestination = (
  candidate: string | null | undefined,
  destination: Exclude<SubjectTaskMoveDestination, "daily">,
  todayIso = todayIsoDate(),
): string => {
  if (destination === "shortTerm") {
    const isShortTerm =
      candidate &&
      isIsoDate(candidate) &&
      dayDiff(todayIso, candidate) > 1 &&
      dayDiff(todayIso, candidate) <= SHORT_TERM_TASK_DAYS_THRESHOLD;

    if (isShortTerm && candidate) {
      return candidate;
    }

    const shortFallbackOffset = Math.max(2, Math.min(7, SHORT_TERM_TASK_DAYS_THRESHOLD));
    return addDays(todayIso, shortFallbackOffset);
  }

  const isLongTerm =
    candidate &&
    isIsoDate(candidate) &&
    dayDiff(todayIso, candidate) > SHORT_TERM_TASK_DAYS_THRESHOLD;

  if (isLongTerm && candidate) {
    return candidate;
  }

  return addDays(todayIso, SHORT_TERM_TASK_DAYS_THRESHOLD + 1);
};

const normalizeTaskTitleKey = (title: string): string =>
  title.trim().replace(/\s+/g, " ").toLowerCase();

const restoreTaskStatusFromCompletion = (task: Task): Exclude<TaskLifecycleStatus, "completed"> => {
  const candidate = task.previousStatus;
  if (candidate === "active" || candidate === "backlog" || candidate === "archived") {
    return candidate;
  }

  return "active";
};

const detachTaskFromSessions = (sessions: StudySession[], taskId: string): StudySession[] =>
  sessions.map((session) => {
    const existingTaskIds = dedupeSessionTaskIds(session);
    if (!existingTaskIds.includes(taskId)) {
      return session;
    }

    const nextTaskIds = existingTaskIds.filter((id) => id !== taskId);
    const nextTaskId = session.taskId === taskId ? (nextTaskIds[nextTaskIds.length - 1] ?? null) : session.taskId ?? null;

    const allocations = {
      ...resolveSessionTaskAllocations(session),
    };
    delete allocations[taskId];

    const totalSeconds = resolveSessionSeconds(session);
    const nextAllocations = rebalanceSessionTaskAllocations(
      allocations,
      nextTaskIds,
      totalSeconds,
      nextTaskId,
    );

    const nextActiveTaskId =
      session.activeTaskId === taskId
        ? (nextTaskId ?? null)
        : (session.activeTaskId && nextTaskIds.includes(session.activeTaskId)
            ? session.activeTaskId
            : (nextTaskId ?? null));

    return {
      ...session,
      taskId: nextTaskId,
      taskIds: nextTaskIds,
      taskAllocations: nextAllocations,
      activeTaskId: nextActiveTaskId,
      activeTaskStartedAt: nextActiveTaskId ? session.activeTaskStartedAt ?? null : null,
    };
  });
const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeGoalNumber = (value: number, fallback: number): number =>
  Number((Number.isFinite(value) && value >= 0 ? value : fallback).toFixed(2));

const minutesToHours = (value: unknown): number | null => {
  const minutes = asFiniteNumber(value);
  if (minutes === null || minutes < 0) {
    return null;
  }

  return Number((minutes / 60).toFixed(2));
};

const ensureGoalSettingsShape = (candidate: unknown, fallback: GoalSettings): GoalSettings => {
  if (!isRecord(candidate)) {
    return { ...fallback };
  }

  const dailyHoursRaw = asFiniteNumber(candidate.dailyHours) ?? minutesToHours(candidate.dailyMinutes);
  const weeklyHoursRaw = asFiniteNumber(candidate.weeklyHours) ?? minutesToHours(candidate.weeklyMinutes);
  const monthlyHoursRaw = asFiniteNumber(candidate.monthlyHours) ?? minutesToHours(candidate.monthlyMinutes);

  const weeklyHours = normalizeGoalNumber(weeklyHoursRaw ?? fallback.weeklyHours, fallback.weeklyHours);
  const monthlyHours = normalizeGoalNumber(monthlyHoursRaw ?? fallback.monthlyHours, fallback.monthlyHours);
  const derivedDailyHours = weeklyHours > 0 ? weeklyHours / 7 : fallback.dailyHours;
  const dailyHours = normalizeGoalNumber(dailyHoursRaw ?? derivedDailyHours, fallback.dailyHours);

  return {
    dailyHours,
    weeklyHours,
    monthlyHours,
  };
};

const isGoalSettings = (value: unknown): value is GoalSettings =>
  isRecord(value) &&
  typeof value.dailyHours === "number" &&
  Number.isFinite(value.dailyHours) &&
  typeof value.weeklyHours === "number" &&
  Number.isFinite(value.weeklyHours) &&
  typeof value.monthlyHours === "number" &&
  Number.isFinite(value.monthlyHours);

const ensureTimerSettingsShape = (candidate: unknown): AppSettings["timer"] => {
  if (!isRecord(candidate)) {
    return { ...DEFAULT_SETTINGS.timer };
  }

  return {
    focusMinutes: Math.max(1, Math.round(asFiniteNumber(candidate.focusMinutes) ?? DEFAULT_SETTINGS.timer.focusMinutes)),
    shortBreakMinutes: Math.max(
      1,
      Math.round(asFiniteNumber(candidate.shortBreakMinutes) ?? DEFAULT_SETTINGS.timer.shortBreakMinutes),
    ),
    longBreakMinutes: Math.max(
      1,
      Math.round(asFiniteNumber(candidate.longBreakMinutes) ?? DEFAULT_SETTINGS.timer.longBreakMinutes),
    ),
    longBreakInterval: Math.max(
      1,
      Math.round(asFiniteNumber(candidate.longBreakInterval) ?? DEFAULT_SETTINGS.timer.longBreakInterval),
    ),
    autoStartNextPhase:
      typeof candidate.autoStartNextPhase === "boolean"
        ? candidate.autoStartNextPhase
        : DEFAULT_SETTINGS.timer.autoStartNextPhase,
    soundEnabled: typeof candidate.soundEnabled === "boolean" ? candidate.soundEnabled : DEFAULT_SETTINGS.timer.soundEnabled,
    preventAccidentalReset:
      typeof candidate.preventAccidentalReset === "boolean"
        ? candidate.preventAccidentalReset
        : DEFAULT_SETTINGS.timer.preventAccidentalReset,
  };
};

const ensureSettingsShape = (candidate: unknown): AppSettings => {
  if (!isRecord(candidate)) {
    return {
      ...DEFAULT_SETTINGS,
      goals: { ...DEFAULT_STUDY_GOALS },
      timer: { ...DEFAULT_SETTINGS.timer },
    };
  }

  const themeCandidate = candidate.theme;
  const theme =
    themeCandidate === "light" || themeCandidate === "dark" || themeCandidate === "system"
      ? themeCandidate
      : DEFAULT_SETTINGS.theme;

  return {
    goals: ensureGoalSettingsShape(candidate.goals, DEFAULT_STUDY_GOALS),
    timer: ensureTimerSettingsShape(candidate.timer),
    theme,
  };
};

const isAppSettings = (value: unknown): value is AppSettings =>
  isRecord(value) && isGoalSettings(value.goals) && isRecord(value.timer) && typeof value.theme === "string";

const sortUniqueIsoDates = (dates: string[]): string[] =>
  Array.from(new Set(dates.filter(isIsoDate))).sort((a, b) => a.localeCompare(b));

const isWorkoutData = (value: unknown): value is WorkoutData =>
  isRecord(value) &&
  typeof value.enabled === "boolean" &&
  Array.isArray(value.markedDays) &&
  Array.isArray(value.sessions) &&
  isGoalSettings(value.goals);

const isParentViewerAuditEvent = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.timestamp === "string" &&
  typeof value.userId === "string" &&
  typeof value.clientId === "string" &&
  typeof value.action === "string" &&
  typeof value.success === "boolean";

const isParentViewerState = (value: unknown): value is ParentViewerState =>
  isRecord(value) &&
  (typeof value.otpHash === "string" || value.otpHash === null) &&
  (typeof value.otpCreatedAt === "string" || value.otpCreatedAt === null) &&
  (typeof value.otpExpiresAt === "string" || value.otpExpiresAt === null) &&
  (typeof value.lastAccessAt === "string" || value.lastAccessAt === null) &&
  typeof value.failedAttempts === "number" &&
  Number.isFinite(value.failedAttempts) &&
  (typeof value.lockedUntil === "string" || value.lockedUntil === null) &&
  Array.isArray(value.auditLog) &&
  value.auditLog.every((event) => isParentViewerAuditEvent(event));

const isVacationModeState = (value: unknown): value is VacationModeState =>
  isRecord(value) &&
  typeof value.enabled === "boolean" &&
  (typeof value.startedAt === "string" || value.startedAt === null) &&
  (typeof value.expiresAt === "string" || value.expiresAt === null) &&
  (typeof value.cooldownUntil === "string" || value.cooldownUntil === null || value.cooldownUntil === undefined);

const ensureParentViewerShape = (candidate: unknown): ParentViewerState => {
  if (!isRecord(candidate)) {
    return {
      ...DEFAULT_PARENT_VIEWER,
      auditLog: [],
    };
  }

  return {
    otpHash: typeof candidate.otpHash === "string" ? candidate.otpHash : null,
    otpCreatedAt: typeof candidate.otpCreatedAt === "string" ? candidate.otpCreatedAt : null,
    otpExpiresAt: typeof candidate.otpExpiresAt === "string" ? candidate.otpExpiresAt : null,
    lastAccessAt: typeof candidate.lastAccessAt === "string" ? candidate.lastAccessAt : null,
    failedAttempts:
      typeof candidate.failedAttempts === "number" && Number.isFinite(candidate.failedAttempts)
        ? Math.max(0, Math.floor(candidate.failedAttempts))
        : 0,
    lockedUntil: typeof candidate.lockedUntil === "string" ? candidate.lockedUntil : null,
    auditLog: Array.isArray(candidate.auditLog)
      ? candidate.auditLog.filter((event): event is ParentViewerState["auditLog"][number] => isParentViewerAuditEvent(event))
      : [],
  };
};

const ensureVacationModeShape = (candidate: unknown): VacationModeState => {
  if (!isRecord(candidate)) {
    return {
      ...DEFAULT_VACATION_MODE,
    };
  }

  return {
    enabled: candidate.enabled === true,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : null,
    expiresAt: typeof candidate.expiresAt === "string" ? candidate.expiresAt : null,
    cooldownUntil: typeof candidate.cooldownUntil === "string" ? candidate.cooldownUntil : null,
  };
};

const parseIsoTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const isProfilesState = (value: unknown): value is ProfilesState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.version === "number" &&
    (typeof value.activeProfileId === "string" || value.activeProfileId === null) &&
    Array.isArray(value.profiles)
  );
};

const isUserData = (value: unknown): value is UserData => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.version === "number" &&
    typeof value.profileId === "string" &&
    Array.isArray(value.subjects) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.sessions) &&
    isWorkoutData(value.workout) &&
    isParentViewerState(value.parentViewer) &&
    isVacationModeState(value.vacationMode) &&
    isAppSettings(value.settings) &&
    isRecord(value.timer)
  );
};

const profileMigrations: LocalStorageMigrationMap = {
  0: (legacy) => {
    if (!isRecord(legacy) || !Array.isArray(legacy.profiles)) {
      return {
        version: PROFILES_SCHEMA_VERSION,
        activeProfileId: null,
        profiles: [],
      } satisfies ProfilesState;
    }

    const legacyProfiles = legacy.profiles
      .filter((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id as string,
        name: item.name as string,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        lastActiveAt:
          typeof item.lastActiveAt === "string"
            ? item.lastActiveAt
            : typeof item.createdAt === "string"
              ? item.createdAt
              : new Date().toISOString(),
      }));

    return {
      version: PROFILES_SCHEMA_VERSION,
      activeProfileId: typeof legacy.activeProfileId === "string" ? legacy.activeProfileId : null,
      profiles: legacyProfiles,
    } satisfies ProfilesState;
  },
};

const ensureTimerShape = (candidate: unknown): TimerSnapshot => {
  if (!isRecord(candidate)) {
    return DEFAULT_TIMER_SNAPSHOT;
  }

  const mode = candidate.mode === "pomodoro" ? "pomodoro" : "stopwatch";
  const phase: PomodoroPhase =
    candidate.phase === "shortBreak" || candidate.phase === "longBreak" ? candidate.phase : "focus";

  return {
    mode,
    phase,
    isRunning: candidate.isRunning === true,
    startedAtMs: typeof candidate.startedAtMs === "number" ? candidate.startedAtMs : null,
    accumulatedMs: typeof candidate.accumulatedMs === "number" ? candidate.accumulatedMs : 0,
    phaseStartedAtMs: typeof candidate.phaseStartedAtMs === "number" ? candidate.phaseStartedAtMs : null,
    phaseAccumulatedMs: typeof candidate.phaseAccumulatedMs === "number" ? candidate.phaseAccumulatedMs : 0,
    cycleCount: typeof candidate.cycleCount === "number" ? candidate.cycleCount : 0,
    subjectId: typeof candidate.subjectId === "string" ? candidate.subjectId : null,
    taskId: typeof candidate.taskId === "string" ? candidate.taskId : null,
  };
};

const ensureWorkoutShape = (candidate: unknown): WorkoutData => {
  if (!isRecord(candidate)) {
    return {
      ...DEFAULT_WORKOUT_DATA,
      markedDays: [],
      sessions: [],
      goals: { ...DEFAULT_WORKOUT_GOALS },
    };
  }

  const markedDays = Array.isArray(candidate.markedDays)
    ? candidate.markedDays
        .map((value) => (typeof value === "string" ? value : null))
        .filter((value): value is string => value !== null)
    : [];

  const sessions: WorkoutSession[] = Array.isArray(candidate.sessions)
    ? candidate.sessions
        .map((session) => {
          if (!isRecord(session) || typeof session.id !== "string") {
            return null;
          }

          const startedAt =
            typeof session.startedAt === "string" && !Number.isNaN(Date.parse(session.startedAt))
              ? new Date(session.startedAt).toISOString()
              : null;
          const endedAt =
            typeof session.endedAt === "string" && !Number.isNaN(Date.parse(session.endedAt))
              ? new Date(session.endedAt).toISOString()
              : null;

          if (!startedAt || !endedAt) {
            return null;
          }

          const durationMs =
            typeof session.durationMs === "number" && Number.isFinite(session.durationMs) && session.durationMs > 0
              ? Math.round(session.durationMs)
              : Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

          const date =
            typeof session.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(session.date)
              ? session.date
              : endedAt.slice(0, 10);

          const exercises = Array.isArray(session.exercises)
            ? session.exercises
                .map((exercise) => {
                  if (!isRecord(exercise)) {
                    return null;
                  }

                  const name = typeof exercise.name === "string" ? exercise.name.trim() : "";
                  if (name.length === 0) {
                    return null;
                  }

                  const muscles = Array.isArray(exercise.muscles)
                    ? exercise.muscles
                        .map((muscle) => (typeof muscle === "string" ? muscle.trim() : ""))
                        .filter((muscle) => muscle.length > 0)
                    : [];

                  const normalized: WorkoutExercise = {
                    name,
                    muscles,
                  };
                  return normalized;
                })
                .filter((exercise): exercise is WorkoutExercise => exercise !== null)
            : [];

          return {
            id: session.id,
            date,
            durationMs,
            startedAt,
            endedAt,
            exercises,
            createdAt:
              typeof session.createdAt === "string" && !Number.isNaN(Date.parse(session.createdAt))
                ? new Date(session.createdAt).toISOString()
                : endedAt,
          };
        })
        .filter((session): session is WorkoutSession => session !== null)
    : [];

  return {
    enabled: candidate.enabled === true,
    markedDays: sortUniqueIsoDates(markedDays),
    sessions,
    goals: ensureGoalSettingsShape(candidate.goals, DEFAULT_WORKOUT_GOALS),
  };
};

const userDataMigrations: LocalStorageMigrationMap = {
  0: (legacy) => {
    const nowIso = new Date().toISOString();
    if (!isRecord(legacy)) {
      return {
        version: 1,
        profileId: "legacy",
        subjects: [],
        tasks: [],
        sessions: [],
        workout: {
          ...DEFAULT_WORKOUT_DATA,
          markedDays: [],
          sessions: [],
          goals: { ...DEFAULT_WORKOUT_GOALS },
        },
        settings: ensureSettingsShape(null),
        timer: DEFAULT_TIMER_SNAPSHOT,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    return {
      version: 1,
      profileId: typeof legacy.profileId === "string" ? legacy.profileId : "legacy",
      subjects: Array.isArray(legacy.subjects) ? legacy.subjects : [],
      tasks: Array.isArray(legacy.tasks) ? legacy.tasks : [],
      sessions: Array.isArray(legacy.sessions) ? legacy.sessions : [],
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
      timer: ensureTimerShape(legacy.timer),
      createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : nowIso,
      updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : nowIso,
    };
  },
  1: (legacy) => {
    if (!isRecord(legacy)) {
      return legacy;
    }

    return {
      ...legacy,
      version: 2,
      lastRolloverDate:
        typeof legacy.lastRolloverDate === "string" || legacy.lastRolloverDate === null
          ? legacy.lastRolloverDate
          : null,
    };
  },
  2: (legacy) => {
    if (!isRecord(legacy)) {
      return legacy;
    }

    return {
      ...legacy,
      version: 3,
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
    };
  },
  3: (legacy) => {
    if (!isRecord(legacy)) {
      return legacy;
    }

    const seededCategories = createDefaultTaskCategories(Date.now());
    const normalizedCollections = normalizeStudyCollections(
      Array.isArray(legacy.tasks) ? (legacy.tasks as Task[]) : [],
      Array.isArray(legacy.sessions) ? (legacy.sessions as StudySession[]) : [],
      Array.isArray(legacy.categories) ? (legacy.categories as TaskCategory[]) : seededCategories,
      typeof legacy.activeCategoryId === "string" || legacy.activeCategoryId === null
        ? (legacy.activeCategoryId as string | null)
        : seededCategories[0]?.id ?? null,
      Date.now(),
    );

    return {
      ...legacy,
      version: 4,
      categories: normalizedCollections.categories,
      activeCategoryId: normalizedCollections.activeCategoryId,
      tasks: normalizedCollections.tasks,
      sessions: normalizedCollections.sessions,
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
      timer: ensureTimerShape(legacy.timer),
    };
  },
  4: (legacy) => {
    if (!isRecord(legacy)) {
      return legacy;
    }

    return {
      ...legacy,
      version: 5,
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
      timer: ensureTimerShape(legacy.timer),
    };
  },
  5: (legacy) => {
    if (!isRecord(legacy)) {
      return legacy;
    }

    return {
      ...legacy,
      version: APP_SCHEMA_VERSION,
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
      timer: ensureTimerShape(legacy.timer),
      parentViewer: ensureParentViewerShape(legacy.parentViewer),
      vacationMode: ensureVacationModeShape(legacy.vacationMode),
    };
  },
};
const parseLegacyField = <T,>(value: unknown, fallback: T): T => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoDate = (value: unknown): string | null => {
  const dateValue = asTrimmedString(value);
  if (!dateValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
};

const toIsoDateTime = (value: unknown): string | null => {
  const dateValue = asTrimmedString(value);
  if (!dateValue) {
    return null;
  }

  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
};

const normalizeLegacyColor = (value: string | null): string => {
  if (!value) {
    return "#64748b";
  }

  if (value.startsWith("#") || value.startsWith("rgb(") || value.startsWith("hsl(")) {
    return value;
  }

  if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(value)) {
    return `hsl(${value})`;
  }

  return value;
};

const inferTaskPriority = (minutes: number | null): TaskPriority => {
  if (minutes === null) {
    return "medium";
  }

  if (minutes >= 180) {
    return "high";
  }

  if (minutes >= 60) {
    return "medium";
  }

  return "low";
};

const mapLegacySessionRating = (value: string | null): SessionRating | null => {
  if (!value) {
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

const normalizeReflectionText = (value: string | null | undefined): string =>
  value?.trim() ?? "";

const sessionHasReflection = (session: Pick<StudySession, "reflectionRating" | "rating">): boolean => {
  const rating = session.reflectionRating ?? session.rating;
  return rating !== null;
};

const resolveSessionReflectionTimestamp = (
  current: Pick<StudySession, "reflectionTimestamp" | "endTime" | "endedAt">,
  fallback = Date.now(),
): number => {
  if (typeof current.reflectionTimestamp === "number" && Number.isFinite(current.reflectionTimestamp)) {
    return current.reflectionTimestamp;
  }

  if (typeof current.endTime === "number" && Number.isFinite(current.endTime)) {
    return current.endTime;
  }

  const endedAt = Date.parse(current.endedAt);
  if (Number.isFinite(endedAt)) {
    return endedAt;
  }

  return fallback;
};

const dayDifference = (fromIsoDate: string, toIsoDate: string): number => {
  const fromDate = Date.parse(`${fromIsoDate}T00:00:00.000Z`);
  const toDate = Date.parse(`${toIsoDate}T00:00:00.000Z`);

  if (Number.isNaN(fromDate) || Number.isNaN(toDate)) {
    return 0;
  }

  return Math.max(0, Math.round((toDate - fromDate) / 86_400_000));
};

const toLegacyUserData = (parsed: Record<string, unknown>, profileId: string): UserData | null => {
  const looksLikeLegacy =
    "study-sessions" in parsed ||
    "study-tasks" in parsed ||
    "study-subjects" in parsed ||
    "workout-sessions" in parsed ||
    "workout-marked-days" in parsed;

  if (!looksLikeLegacy) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const legacySubjects = parseLegacyField<unknown[]>(parsed["study-subjects"], []);
  const legacyTasks = parseLegacyField<unknown[]>(parsed["study-tasks"], []);
  const legacySessions = parseLegacyField<unknown[]>(parsed["study-sessions"], []);
  const legacyGoals = parseLegacyField<Record<string, unknown>>(parsed["study-goals"], {});
  const legacyWorkoutGoals = parseLegacyField<Record<string, unknown>>(parsed["workout-goals"], {});
  const legacyTimer = parseLegacyField<Record<string, unknown>>(parsed["study-timer-state"], {});
  const legacySettings = parseLegacyField<Record<string, unknown>>(parsed["app-settings"], {});
  const legacyLastRollover = parseLegacyField<unknown>(parsed["study-last-auto-move"], null);
  const legacyWorkoutSessions = parseLegacyField<unknown[]>(parsed["workout-sessions"], []);
  const legacyWorkoutMarkedDays = parseLegacyField<unknown[]>(parsed["workout-marked-days"], []);

  const subjects: Subject[] = [];
  const usedSubjectIds = new Set<string>();
  const subjectByName = new Map<string, Subject>();
  const normalizeName = (value: string) => value.trim().toLowerCase();

  const upsertSubject = (name: string | null, preferredId?: string | null, preferredColor?: string | null): string | null => {
    if (!name) {
      return null;
    }

    const key = normalizeName(name);
    const existing = subjectByName.get(key);
    if (existing) {
      return existing.id;
    }

    let id = preferredId ?? createId();
    if (usedSubjectIds.has(id)) {
      id = createId();
    }

    usedSubjectIds.add(id);

    const createdAt = nowIso;
    const subject: Subject = {
      id,
      name: name.trim(),
      color: normalizeLegacyColor(preferredColor),
      createdAt,
      updatedAt: createdAt,
    };

    subjects.push(subject);
    subjectByName.set(key, subject);
    return subject.id;
  };

  legacySubjects.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    upsertSubject(asTrimmedString(item.name), asTrimmedString(item.id), asTrimmedString(item.color));
  });

  const taskIds = new Set<string>();
  const tasks: Task[] = [];
  let dailyOrder = 0;
  let backlogOrder = 0;

  legacyTasks.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const title = asTrimmedString(item.title);
    if (!title) {
      return;
    }

    const bucket: TaskBucket = item.isBacklog === true ? "backlog" : "daily";
    const plannedMinutes = asFiniteNumber(item.plannedTime);
    const legacyPriority = asTrimmedString(item.priority)?.toLowerCase();
    const priority: TaskPriority =
      legacyPriority === "low" || legacyPriority === "medium" || legacyPriority === "high"
        ? legacyPriority
        : inferTaskPriority(plannedMinutes);

    const description = asTrimmedString(item.description);
    const notes = asTrimmedString(item.notes);
    const descriptionParts = [description, notes].filter(
      (value, index, values): value is string => value !== null && values.indexOf(value) === index,
    );

    let id = asTrimmedString(item.id) ?? createId();
    if (taskIds.has(id)) {
      id = createId();
    }
    taskIds.add(id);

    const dueDate = toIsoDate(item.scheduledDate);
    const originalDate = toIsoDate(item.originalDate);
    const createdAt = toIsoDateTime(item.createdAt) ?? nowIso;
    const completedAt = toIsoDateTime(item.completedAt);
    const completed = item.completed === true;
    const status: TaskLifecycleStatus = completed ? "completed" : (bucket === "backlog" ? "backlog" : "active");
    const order = bucket === "daily" ? ++dailyOrder : ++backlogOrder;
    const todayIso = todayIsoDate();
    const normalizedDueDate = normalizeTimedTaskDueDate(dueDate, todayIso);
    const normalizedType = classifyTimedTaskType(normalizedDueDate, todayIso);
    const subjectId = upsertSubject(asTrimmedString(item.subject));
    const normalizedCategory = subjectId ? "subject" : (normalizedType === TaskType.SHORT_TERM ? "shortTerm" : "longTerm");
    const deadline = Date.parse(`${normalizedDueDate}T23:59:59`);

    tasks.push({
      id,
      title,
      description: descriptionParts.join("\n\n"),
      subjectId,
      type: normalizedType,
      category: normalizedCategory,
      scheduledFor: normalizedDueDate,
      bucket,
      priority,
      estimatedMinutes: plannedMinutes !== null ? Math.max(0, Math.round(plannedMinutes)) : null,
      dueDate: normalizedDueDate,
      deadline: Number.isFinite(deadline) ? deadline : null,
      status,
      previousStatus: null,
      completed,
      completedAt,
      isBacklog: bucket === "backlog",
      isAutoBacklog: false,
      backlogSince: bucket === "backlog" ? Date.now() : null,
      order,
      rollovers: originalDate && normalizedDueDate ? dayDifference(originalDate, normalizedDueDate) : 0,
      timeSpent: 0,
      totalTimeSpent: 0,
      totalTimeSeconds: 0,
      sessionCount: 0,
      lastWorkedAt: null,
      isTimerRunning: false,
      createdAt,
      updatedAt: completedAt ?? createdAt,
    });
  });
  const sessions: StudySession[] = [];
  const sessionIds = new Set<string>();

  legacySessions.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const dateOnly = toIsoDate(item.date);
    const startedAt = toIsoDateTime(item.startTime) ?? (dateOnly ? `${dateOnly}T00:00:00.000Z` : nowIso);
    const endedAtRaw = toIsoDateTime(item.endTime);
    const durationSeconds = asFiniteNumber(item.duration);
    let durationMs = durationSeconds !== null ? Math.max(0, Math.round(durationSeconds * 1000)) : 0;

    let endedAt = endedAtRaw ?? new Date(Date.parse(startedAt) + durationMs).toISOString();
    if (durationMs <= 0) {
      const computed = Date.parse(endedAt) - Date.parse(startedAt);
      durationMs = Math.max(0, computed);
    }

    if (durationMs <= 0) {
      return;
    }

    if (Date.parse(endedAt) < Date.parse(startedAt)) {
      endedAt = new Date(Date.parse(startedAt) + durationMs).toISOString();
    }

    let id = asTrimmedString(item.id) ?? createId();
    if (sessionIds.has(id)) {
      id = createId();
    }
    sessionIds.add(id);

    const reflectionRating = mapLegacySessionRating(asTrimmedString(item.rating));
    const reflectionComment = normalizeReflectionText(asTrimmedString(item.note));
    const reflectionTimestampValue = reflectionRating ? Date.parse(endedAt) : Number.NaN;

    sessions.push({
      id,
      subjectId: upsertSubject(asTrimmedString(item.subject)),
      taskId: asTrimmedString(item.taskId),
      startedAt,
      endedAt,
      durationMs,
      mode: "stopwatch",
      phase: "manual",
      reflectionRating,
      reflectionComment,
      reflectionTimestamp: Number.isFinite(reflectionTimestampValue) ? reflectionTimestampValue : null,
      rating: reflectionRating,
      reflection: reflectionComment,
      createdAt: endedAt,
    });
  });

  const workoutSessionIds = new Set<string>();
  const workoutSessions: WorkoutSession[] = [];

  legacyWorkoutSessions.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const startedAtRaw = toIsoDateTime(item.startTime);
    const endedAtRaw = toIsoDateTime(item.endTime);
    const dateOnly = toIsoDate(item.date);
    const durationSeconds = asFiniteNumber(item.duration);
    let durationMs = durationSeconds !== null ? Math.max(0, Math.round(durationSeconds * 1000)) : 0;

    if (durationMs <= 0 && startedAtRaw && endedAtRaw) {
      durationMs = Math.max(0, Date.parse(endedAtRaw) - Date.parse(startedAtRaw));
    }

    if (durationMs <= 0) {
      return;
    }

    const endedAt =
      endedAtRaw ??
      (startedAtRaw ? new Date(Date.parse(startedAtRaw) + durationMs).toISOString() : null);
    const startedAt =
      startedAtRaw ??
      (endedAt ? new Date(Date.parse(endedAt) - durationMs).toISOString() : null);

    if (!startedAt || !endedAt) {
      return;
    }

    let id = asTrimmedString(item.id) ?? createId();
    if (workoutSessionIds.has(id)) {
      id = createId();
    }
    workoutSessionIds.add(id);

    const exercises = Array.isArray(item.exercises)
      ? item.exercises
          .map((exercise) => {
            if (!isRecord(exercise)) {
              return null;
            }

            const name = asTrimmedString(exercise.name);
            if (!name) {
              return null;
            }

            const muscles = Array.isArray(exercise.muscles)
              ? exercise.muscles
                  .map((muscle) => (typeof muscle === "string" ? muscle.trim() : ""))
                  .filter((muscle) => muscle.length > 0)
              : [];

            return {
              name,
              muscles,
            };
          })
          .filter((exercise): exercise is { name: string; muscles: string[] } => exercise !== null)
      : [];

    workoutSessions.push({
      id,
      date: dateOnly ?? endedAt.slice(0, 10),
      durationMs,
      startedAt,
      endedAt,
      exercises,
      createdAt: endedAt,
    });
  });

  const workoutMarkedDays = legacyWorkoutMarkedDays
    .map((value) => toIsoDate(value))
    .filter((value): value is string => value !== null);
  const workoutEnabledFromLegacy = legacySettings.workoutEnabled === true;
  const workoutGoals = ensureGoalSettingsShape(legacyWorkoutGoals, DEFAULT_WORKOUT_GOALS);
  const workout: WorkoutData = {
    enabled: workoutEnabledFromLegacy || workoutSessions.length > 0 || workoutMarkedDays.length > 0,
    markedDays: sortUniqueIsoDates(workoutMarkedDays),
    sessions: workoutSessions,
    goals: workoutGoals,
  };

  const studyGoals = ensureGoalSettingsShape(legacyGoals, DEFAULT_STUDY_GOALS);

  const themeCandidate = asTrimmedString(legacySettings.theme);
  const theme =
    themeCandidate === "light" || themeCandidate === "dark" || themeCandidate === "system"
      ? themeCandidate
      : DEFAULT_SETTINGS.theme;

  const timerSubjectId = upsertSubject(asTrimmedString(legacyTimer.currentSubject));
  const timerTaskId = asTrimmedString(legacyTimer.currentTaskId);
  const elapsedSeconds = asFiniteNumber(legacyTimer.elapsedTime) ?? 0;

  const timer: TimerSnapshot = {
    ...DEFAULT_TIMER_SNAPSHOT,
    isRunning: false,
    accumulatedMs: Math.max(0, Math.round(elapsedSeconds * 1000)),
    subjectId: timerSubjectId,
    taskId: timerTaskId,
  };

  const createdCandidates = [
    ...subjects.map((item) => Date.parse(item.createdAt)),
    ...tasks.map((item) => Date.parse(item.createdAt)),
    ...sessions.map((item) => Date.parse(item.createdAt)),
    ...workout.sessions.map((item) => Date.parse(item.createdAt)),
  ].filter((value) => Number.isFinite(value));

  const createdAt =
    createdCandidates.length > 0 ? new Date(Math.min(...createdCandidates)).toISOString() : nowIso;

  const seededCategories = createDefaultTaskCategories(Date.now());
  const normalizedCollections = normalizeStudyCollections(
    tasks,
    sessions,
    seededCategories,
    seededCategories[0]?.id ?? null,
    Date.now(),
  );

  return {
    version: APP_SCHEMA_VERSION,
    profileId,
    subjects,
    categories: normalizedCollections.categories,
    activeCategoryId: normalizedCollections.activeCategoryId,
    tasks: normalizedCollections.tasks,
    sessions: normalizedCollections.sessions,
    workout,
    parentViewer: {
      ...DEFAULT_PARENT_VIEWER,
      auditLog: [],
    },
    vacationMode: {
      ...DEFAULT_VACATION_MODE,
    },
    settings: {
      ...DEFAULT_SETTINGS,
      goals: studyGoals,
      timer: { ...DEFAULT_SETTINGS.timer },
      theme,
    },
    timer,
    lastRolloverDate: toIsoDate(legacyLastRollover),
    createdAt,
    updatedAt: nowIso,
  };
};

const phaseDurationMs = (settings: AppSettings["timer"], phase: PomodoroPhase): number => {
  if (phase === "focus") {
    return settings.focusMinutes * 60_000;
  }

  if (phase === "shortBreak") {
    return settings.shortBreakMinutes * 60_000;
  }

  return settings.longBreakMinutes * 60_000;
};

const timerElapsedMs = (timer: TimerSnapshot, now = Date.now()): number => {
  if (!timer.isRunning || timer.startedAtMs === null) {
    return timer.accumulatedMs;
  }
  return timer.accumulatedMs + Math.max(0, now - timer.startedAtMs);
};

const timerPhaseElapsedMs = (timer: TimerSnapshot, now = Date.now()): number => {
  if (!timer.isRunning || timer.phaseStartedAtMs === null) {
    return timer.phaseAccumulatedMs;
  }
  return timer.phaseAccumulatedMs + Math.max(0, now - timer.phaseStartedAtMs);
};

const isTimerTaskEligible = (task: Task, subjectId: string | null): boolean =>
  subjectId !== null && canUseTimer(task) && !task.completed && task.subjectId === subjectId;

const sanitizeTimerTaskSelection = (timer: TimerSnapshot, tasks: Task[]): TimerSnapshot => {
  if (!timer.taskId) {
    return timer;
  }

  const selectedTask = tasks.find((task) => task.id === timer.taskId);
  if (selectedTask && isTimerTaskEligible(selectedTask, timer.subjectId)) {
    return timer;
  }

  return {
    ...timer,
    taskId: null,
  };
};

interface FinalizeSessionResult {
  sessions: StudySession[];
  finalized: StudySession | null;
}

const resolveTimerSessionPhase = (mode: TimerMode, phase: "focus" | "manual"): "focus" | "manual" =>
  mode === "pomodoro" ? "focus" : phase;

const TAB_ID = resolveBrowserTabId();

const dedupeSessionTaskIds = (session: StudySession, nextTaskId: string | null = null): string[] => {
  const taskIds = [...resolveSessionTaskIds(session)];

  if (nextTaskId && !taskIds.includes(nextTaskId)) {
    taskIds.push(nextTaskId);
  }

  return taskIds;
};

const resolveSessionActiveTaskId = (session: StudySession, fallbackTaskId: string | null): string | null => {
  const taskIds = dedupeSessionTaskIds(session, fallbackTaskId);
  const preferred =
    typeof session.activeTaskId === "string" && session.activeTaskId.length > 0
      ? session.activeTaskId
      : (fallbackTaskId ?? session.taskId);

  if (preferred && taskIds.includes(preferred)) {
    return preferred;
  }

  return taskIds[taskIds.length - 1] ?? preferred ?? null;
};

const resolveSessionSeconds = (session: StudySession): number =>
  clampSessionSeconds(
    typeof session.accumulatedTime === "number" && Number.isFinite(session.accumulatedTime)
      ? session.accumulatedTime
      : typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds)
        ? session.durationSeconds
        : Math.floor(session.durationMs / 1000),
  );

const resolveRunningSessionElapsedSeconds = (session: StudySession, nowMs: number): number => {
  const baseSeconds = resolveSessionSeconds(session);
  if (session.status !== "running") {
    return baseSeconds;
  }

  const runningSince =
    typeof session.lastStartTimestamp === "number" && Number.isFinite(session.lastStartTimestamp)
      ? session.lastStartTimestamp
      : nowMs;

  const liveSeconds = Math.max(0, Math.floor((nowMs - runningSince) / 1000));
  return clampSessionSeconds(baseSeconds + liveSeconds);
};

interface SessionAllocationState {
  taskIds: string[];
  activeTaskId: string | null;
  taskAllocations: Record<string, number>;
}

const sessionAllocationState = (
  session: StudySession,
  nowMs: number,
  fallbackTaskId: string | null,
): SessionAllocationState => {
  const taskIds = dedupeSessionTaskIds(session, fallbackTaskId);
  const activeTaskId = resolveSessionActiveTaskId(session, fallbackTaskId);
  const taskAllocations = {
    ...resolveSessionTaskAllocations(session),
  };

  if (
    session.status === "running" &&
    session.isActive === true &&
    typeof session.activeTaskStartedAt === "number" &&
    Number.isFinite(session.activeTaskStartedAt) &&
    activeTaskId
  ) {
    const deltaSeconds = clampSessionSeconds(Math.floor((nowMs - session.activeTaskStartedAt) / 1000));
    if (deltaSeconds > 0) {
      taskAllocations[activeTaskId] = clampSessionSeconds((taskAllocations[activeTaskId] ?? 0) + deltaSeconds);
    }
  }

  return {
    taskIds,
    activeTaskId,
    taskAllocations,
  };
};

const upsertActiveTaskSession = (
  sessions: StudySession[],
  taskId: string | null,
  subjectId: string | null,
  mode: TimerMode,
  phase: "focus" | "manual",
  elapsedMs: number,
  nowMs: number,
): StudySession[] => {
  if (!taskId) {
    return sessions;
  }

  const elapsedSeconds = clampSessionSeconds(Math.floor(elapsedMs / 1000));
  const sessionPhase = resolveTimerSessionPhase(mode, phase);
  const activeIndex = sessions.findIndex((session) => session.isActive === true);

  if (activeIndex >= 0) {
    const current = sessions[activeIndex];
    if (!current) {
      return sessions;
    }

    const allocationState = sessionAllocationState(current, nowMs, current.taskId ?? taskId);
    const taskIds = dedupeSessionTaskIds(current, taskId);
    const startTime =
      typeof current.startTime === "number" && Number.isFinite(current.startTime)
        ? current.startTime
        : nowMs - elapsedSeconds * 1000;

    const updated: StudySession = {
      ...current,
      sessionId: current.sessionId ?? current.id,
      tabId: current.tabId ?? TAB_ID,
      taskId,
      taskIds,
      taskAllocations: allocationState.taskAllocations,
      activeTaskId: taskId,
      activeTaskStartedAt: nowMs,
      subjectId,
      mode,
      phase: sessionPhase,
      startTime,
      startedAt: new Date(startTime).toISOString(),
      endTime: null,
      endedAt: new Date(startTime + elapsedSeconds * 1000).toISOString(),
      durationSeconds: elapsedSeconds,
      accumulatedTime: elapsedSeconds,
      durationMs: elapsedSeconds * 1000,
      status: "running",
      lastStartTimestamp: nowMs,
      isActive: true,
    };

    return sessions.map((session, index) => (index === activeIndex ? updated : session));
  }

  const startTime = nowMs - elapsedSeconds * 1000;
  return [
    ...sessions,
    buildActiveSession(taskId, subjectId, mode, sessionPhase, startTime, elapsedSeconds, {
      tabId: TAB_ID,
      status: "running",
      lastStartTimestamp: nowMs,
    }),
  ];
};

const pauseActiveTaskSession = (
  sessions: StudySession[],
  taskId: string | null,
  subjectId: string | null,
  mode: TimerMode,
  phase: "focus" | "manual",
  elapsedMs: number,
  nowMs: number,
): StudySession[] => {
  if (!taskId) {
    return sessions;
  }

  const elapsedSeconds = clampSessionSeconds(Math.floor(elapsedMs / 1000));
  const sessionPhase = resolveTimerSessionPhase(mode, phase);
  const activeIndex = sessions.findIndex((session) => session.isActive === true);

  if (activeIndex < 0) {
    if (elapsedSeconds <= 0) {
      return sessions;
    }

    const startTime = nowMs - elapsedSeconds * 1000;
    return [
      ...sessions,
      buildActiveSession(taskId, subjectId, mode, sessionPhase, startTime, elapsedSeconds, {
        tabId: TAB_ID,
        status: "paused",
        lastStartTimestamp: null,
      }),
    ];
  }

  const current = sessions[activeIndex];
  if (!current) {
    return sessions;
  }

  const allocationState = sessionAllocationState(current, nowMs, current.taskId ?? taskId);
  const taskIds = dedupeSessionTaskIds(current, taskId);
  const activeTaskId = taskId ?? allocationState.activeTaskId;
  const taskAllocations = rebalanceSessionTaskAllocations(
    allocationState.taskAllocations,
    taskIds,
    elapsedSeconds,
    activeTaskId,
  );

  const startTime =
    typeof current.startTime === "number" && Number.isFinite(current.startTime)
      ? current.startTime
      : nowMs - elapsedSeconds * 1000;

  const paused: StudySession = {
    ...current,
    sessionId: current.sessionId ?? current.id,
    tabId: current.tabId ?? TAB_ID,
    taskId: activeTaskId,
    taskIds,
    taskAllocations,
    activeTaskId,
    activeTaskStartedAt: null,
    subjectId,
    mode,
    phase: sessionPhase,
    startTime,
    startedAt: new Date(startTime).toISOString(),
    endTime: null,
    endedAt: new Date(startTime + elapsedSeconds * 1000).toISOString(),
    durationSeconds: elapsedSeconds,
    accumulatedTime: elapsedSeconds,
    durationMs: elapsedSeconds * 1000,
    status: "paused",
    lastStartTimestamp: null,
    isActive: true,
  };

  return sessions.map((session, index) => (index === activeIndex ? paused : session));
};

const finalizeTaskSession = (
  sessions: StudySession[],
  taskId: string | null,
  subjectId: string | null,
  mode: TimerMode,
  phase: "focus" | "manual",
  elapsedMs: number,
  nowMs: number,
): FinalizeSessionResult => {
  const sessionPhase = resolveTimerSessionPhase(mode, phase);
  const activeIndex = sessions.findIndex((session) => session.isActive === true);
  let durationSeconds = clampSessionSeconds(Math.floor(elapsedMs / 1000));

  if (durationSeconds <= 0 && activeIndex >= 0) {
    const existing = sessions[activeIndex];
    if (existing) {
      const fallbackDuration = clampSessionSeconds(
        typeof existing.accumulatedTime === "number" && Number.isFinite(existing.accumulatedTime)
          ? existing.accumulatedTime
          : typeof existing.durationSeconds === "number" && Number.isFinite(existing.durationSeconds)
            ? existing.durationSeconds
            : Math.floor(existing.durationMs / 1000),
      );

      durationSeconds = fallbackDuration;
    }
  }

  if (durationSeconds <= 0) {
    return { sessions, finalized: null };
  }

  const endedAt = new Date(nowMs).toISOString();

  if (activeIndex >= 0) {
    const existing = sessions[activeIndex];
    if (!existing) {
      return { sessions, finalized: null };
    }

    const allocationState = sessionAllocationState(existing, nowMs, taskId ?? existing.taskId ?? null);
    const preferredTaskId = taskId ?? allocationState.activeTaskId ?? existing.taskId;
    const taskIds = dedupeSessionTaskIds(existing, preferredTaskId ?? null);
    const taskAllocations = rebalanceSessionTaskAllocations(
      allocationState.taskAllocations,
      taskIds,
      durationSeconds,
      preferredTaskId,
    );

    const startTime =
      typeof existing.startTime === "number" && Number.isFinite(existing.startTime)
        ? existing.startTime
        : nowMs - durationSeconds * 1000;

    const finalized: StudySession = {
      ...existing,
      sessionId: existing.sessionId ?? existing.id,
      tabId: existing.tabId ?? TAB_ID,
      taskId: preferredTaskId,
      taskIds,
      taskAllocations,
      activeTaskId: null,
      activeTaskStartedAt: null,
      subjectId,
      mode,
      phase: sessionPhase,
      startTime,
      startedAt: new Date(startTime).toISOString(),
      endTime: nowMs,
      endedAt,
      durationSeconds,
      accumulatedTime: durationSeconds,
      durationMs: durationSeconds * 1000,
      status: "completed",
      lastStartTimestamp: null,
      isActive: false,
    };

    return {
      sessions: sessions.map((session, index) => (index === activeIndex ? finalized : session)),
      finalized,
    };
  }

  if (!taskId) {
    return { sessions, finalized: null };
  }

  const startTime = nowMs - durationSeconds * 1000;
  const id = createId();
  const finalized: StudySession = {
    id,
    sessionId: id,
    subjectId,
    taskId,
    taskIds: [taskId],
    taskAllocations: {
      [taskId]: durationSeconds,
    },
    activeTaskId: null,
    activeTaskStartedAt: null,
    tabId: TAB_ID,
    startedAt: new Date(startTime).toISOString(),
    endedAt,
    durationMs: durationSeconds * 1000,
    startTime,
    endTime: nowMs,
    durationSeconds,
    accumulatedTime: durationSeconds,
    status: "completed",
    lastStartTimestamp: null,
    isActive: false,
    mode,
    phase: sessionPhase,
    reflectionRating: null,
    reflectionComment: "",
    reflectionTimestamp: null,
    rating: null,
    reflection: "",
    createdAt: endedAt,
  };

  return {
    sessions: [...sessions, finalized],
    finalized,
  };
};

const nextPomodoroPhase = (
  currentPhase: PomodoroPhase,
  currentCycleCount: number,
  longBreakInterval: number,
): { phase: PomodoroPhase; cycleCount: number; justCompletedFocus: boolean } => {
  if (currentPhase === "focus") {
    const nextCycleCount = currentCycleCount + 1;
    const isLongBreak = nextCycleCount % Math.max(1, longBreakInterval) === 0;
    return {
      phase: isLongBreak ? "longBreak" : "shortBreak",
      cycleCount: nextCycleCount,
      justCompletedFocus: true,
    };
  }

  return {
    phase: "focus",
    cycleCount: currentCycleCount,
    justCompletedFocus: false,
  };
};

const playCompletionTone = () => {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 920;
    gainNode.gain.value = 0.06;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.18);

    oscillator.onended = () => {
      audioContext.close().catch(() => {
        // Ignore close errors.
      });
    };
  } catch {
    // Ignore audio errors.
  }
};

interface NewTaskInput {
  title: string;
  description?: string;
  subjectId?: string | null;
  bucket: TaskBucket;
  priority: TaskPriority;
  categoryId?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
}

interface NewSubjectTaskInput {
  title: string;
  subjectId: string;
  description?: string;
  priority?: TaskPriority;
  categoryId?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
}
interface UpdateTaskInput {
  title?: string;
  description?: string;
  subjectId?: string | null;
  priority?: TaskPriority;
  categoryId?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  status?: TaskLifecycleStatus;
  isAutoBacklog?: boolean;
  previousStatus?: Exclude<TaskLifecycleStatus, "completed"> | null;
}

interface NewWorkoutSessionInput {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  exercises: WorkoutExercise[];
  date?: string;
}

interface AppStoreContextValue {
  isReady: boolean;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  data: UserData | null;
  role: AppRole;
  isViewerMode: boolean;
  analytics: AppAnalytics;
  parentViewer: ParentViewerState | null;
  pendingReflection: PendingReflection | null;
  createProfile: (name: string) => void;
  renameProfile: (profileId: string, name: string) => void;
  switchProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  addSubject: (name: string, color: string) => void;
  updateSubject: (subjectId: string, name: string, color: string) => void;
  deleteSubject: (subjectId: string) => void;
  addTaskCategory: (name: string) => void;
  renameTaskCategory: (categoryId: string, name: string) => void;
  deleteTaskCategory: (categoryId: string, options: DeleteTaskCategoryOptions) => DeleteTaskCategoryResult;
  reorderTaskCategory: (sourceCategoryId: string, targetCategoryId: string) => void;
  setActiveTaskCategory: (categoryId: string) => void;
  addSubjectTask: (input: NewSubjectTaskInput) => void;
  addTask: (input: NewTaskInput) => void;
  updateTask: (taskId: string, input: UpdateTaskInput) => void;
  deleteTask: (taskId: string) => void;
  toggleTask: (taskId: string, completed: boolean) => void;
  reorderTask: (sourceTaskId: string, targetTaskId: string) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  bulkMoveTasks: (taskIds: string[], bucket: TaskBucket) => void;
  bulkCompleteTasks: (taskIds: string[], completed: boolean) => void;
  bulkSetTaskLifecycleStatus: (taskIds: string[], status: Exclude<TaskLifecycleStatus, "completed">) => void;
  runTaskBacklogAutomation: () => void;
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  setVacationMode: (enabled: boolean) => VacationModeMutationResult;
  setTheme: (mode: AppSettings["theme"]) => void;
  generateParentAccessCode: () => Promise<ParentAccessCodeResult>;
  refreshParentAccessCode: () => Promise<ParentAccessCodeResult>;
  verifyParentAccessCode: (code: string) => Promise<ParentAccessVerificationResult>;
  exitViewerMode: () => void;
  logViewerWriteViolation: (action: string) => void;
  setTimerMode: (mode: TimerMode) => void;
  selectTimerSubject: (subjectId: string | null) => void;
  selectTimerTask: (taskId: string | null) => void;
  addTaskToActiveSession: (taskId: string) => boolean;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: (force?: boolean) => boolean;
  stopTimer: () => void;
  completePomodoroPhaseIfDue: () => void;
  dismissPendingReflection: () => void;
  saveSessionReflection: (sessionId: string, rating: SessionRating | null, reflection: string) => void;
  updateSessionDuration: (sessionId: string, durationSeconds: number) => boolean;
  continueSession: (sessionId: string) => boolean;
  continueSessionWithTask: (sessionId: string, taskId: string) => boolean;
  deleteSession: (sessionId: string) => void;
  addWorkoutSession: (input: NewWorkoutSessionInput) => void;
  deleteWorkoutSession: (sessionId: string) => void;
  toggleWorkoutMarkedDay: (dateIso: string) => void;
  updateWorkoutGoals: (updater: (previous: GoalSettings) => GoalSettings) => void;
  tasksForSubject: (subjectId: string) => Task[];
  moveSubjectTask: (
    taskId: string,
    destination: SubjectTaskMoveDestination,
    options?: SubjectTaskMoveOptions,
  ) => SubjectTaskMoveResult;
  restoreProfileDataSnapshot: (snapshot: UserData) => boolean;
  exportCurrentProfileData: () => string | null;
  exportLovableProfileData: () => string | null;
  importCurrentProfileData: (raw: string) => boolean;
  resetCurrentProfileData: () => void;
}

const defaultAnalytics: AppAnalytics = {
  todayStudyMs: 0,
  productivityPercent: 0,
  streakDays: 0,
  bestDayLabel: "No study day yet",
  bestDayMinutes: 0,
  weeklyTotalMs: 0,
  previousWeekTotalMs: 0,
  monthlyTotalMs: 0,
  previousMonthTotalMs: 0,
};

const AppStoreContext = createContext<AppStoreContextValue | undefined>(undefined);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [pendingReflection, setPendingReflection] = useState<PendingReflection | null>(null);
  const [viewerSession, setViewerSession] = useState<ParentViewerSession | null>(() => readParentViewerSession());

  const profilesStorage = useLocalStorage<ProfilesState>({
    key: STORAGE_KEYS.profiles,
    version: PROFILES_SCHEMA_VERSION,
    initialValue: {
      version: PROFILES_SCHEMA_VERSION,
      activeProfileId: null,
      profiles: [],
    },
    validate: isProfilesState,
    migrations: profileMigrations,
  });

  const activeProfileId = profilesStorage.value.activeProfileId;
  const activeProfile =
    activeProfileId === null
      ? null
      : profilesStorage.value.profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const isViewerMode = viewerSession !== null && activeProfile?.id === viewerSession.profileId;
  const role: AppRole = isViewerMode ? "viewer" : "student";
  const setProfilesStorageValue = profilesStorage.setValue;
  const profileStorageKey = activeProfile
    ? STORAGE_KEYS.profileData(activeProfile.id)
    : STORAGE_KEYS.profileData("__inactive__");

  const initialProfileData = useMemo(
    () => EMPTY_USER_DATA(activeProfile?.id ?? "__inactive__", new Date().toISOString()),
    [activeProfile?.id],
  );

  const profileDataStorage = useLocalStorage<UserData>({
    key: profileStorageKey,
    version: APP_SCHEMA_VERSION,
    initialValue: initialProfileData,
    validate: isUserData,
    migrations: userDataMigrations,
  });

  const data = activeProfile ? profileDataStorage.value : null;

  const normalizeProfileData = useCallback(
    (next: UserData, profileId: string): UserData => {
      const normalizedCollections = normalizeStudyCollections(
        next.tasks,
        next.sessions,
        next.categories,
        next.activeCategoryId,
        Date.now(),
      );
      const normalizedTimer = sanitizeTimerTaskSelection(next.timer, normalizedCollections.tasks);

      return {
        ...next,
        categories: normalizedCollections.categories,
        activeCategoryId: normalizedCollections.activeCategoryId,
        tasks: normalizedCollections.tasks,
        sessions: normalizedCollections.sessions,
        timer: ensureTimerShape(normalizedTimer),
        workout: ensureWorkoutShape(next.workout),
        settings: ensureSettingsShape(next.settings),
        parentViewer: ensureParentViewerShape(next.parentViewer),
        vacationMode: ensureVacationModeShape(next.vacationMode),
        version: APP_SCHEMA_VERSION,
        profileId,
        updatedAt: new Date().toISOString(),
      };
    },
    [],
  );

  const logViewerWriteViolation = useCallback(
    (action: string) => {
      if (!activeProfile || !isViewerMode) {
        return;
      }

      const clientId = getParentViewerClientId();
      profileDataStorage.trySetValue((previous) => {
        const parentViewer = ensureParentViewerShape(previous.parentViewer);
        return normalizeProfileData(
          {
            ...previous,
            parentViewer: {
              ...parentViewer,
              auditLog: appendParentViewerAuditEvent(
                parentViewer.auditLog,
                buildParentViewerAuditEvent(activeProfile.id, clientId, "viewer_write_blocked", false, action),
              ),
            },
          },
          activeProfile.id,
        );
      });
    },
    [activeProfile, isViewerMode, normalizeProfileData, profileDataStorage],
  );

  const tryPatchData = useCallback(
    (updater: (previous: UserData) => UserData) => {
      if (!activeProfile) {
        return {
          ok: false,
          previous: null,
          value: null,
          error: new Error("No active profile selected."),
        };
      }

      if (isViewerMode) {
        logViewerWriteViolation("Blocked write in viewer mode.");
        return {
          ok: false,
          previous: data,
          value: data,
          error: new Error("Viewer mode is read-only."),
        };
      }

      return profileDataStorage.trySetValue((previous) => normalizeProfileData(updater(previous), activeProfile.id));
    },
    [activeProfile, data, isViewerMode, logViewerWriteViolation, normalizeProfileData, profileDataStorage],
  );

  const patchData = useCallback(
    (updater: (previous: UserData) => UserData) => {
      if (!activeProfile) {
        return;
      }

      tryPatchData(updater);
    },
    [activeProfile, tryPatchData],
  );
  useEffect(() => {
    if (!viewerSession) {
      return;
    }

    if (!activeProfile || !data || viewerSession.profileId !== activeProfile.id) {
      clearParentViewerSession();
      setViewerSession(null);
      return;
    }

    const parentViewer = ensureParentViewerShape(data.parentViewer);
    const nowMs = Date.now();
    const sessionExpiresMs = parseIsoTimestamp(viewerSession.expiresAt);
    const otpExpiresMs = parseIsoTimestamp(parentViewer.otpExpiresAt);

    const invalidSession =
      !parentViewer.otpHash ||
      !constantTimeEqualHex(parentViewer.otpHash, viewerSession.otpHash) ||
      (sessionExpiresMs !== null && nowMs > sessionExpiresMs) ||
      (otpExpiresMs !== null && nowMs > otpExpiresMs);

    if (invalidSession) {
      clearParentViewerSession();
      setViewerSession(null);
    }
  }, [activeProfile, data, viewerSession]);

  useEffect(() => {
    if (!data || !activeProfile || !data.vacationMode.enabled || isViewerMode) {
      return;
    }

    const expiresMs = parseIsoTimestamp(data.vacationMode.expiresAt);
    if (expiresMs === null || Date.now() <= expiresMs) {
      return;
    }

    patchData((previous) => ({
      ...previous,
      vacationMode: {
        ...ensureVacationModeShape(previous.vacationMode),
        enabled: false,
        startedAt: null,
        expiresAt: null,
        cooldownUntil: new Date(Date.now() + VACATION_COOLDOWN_DAYS * 86_400_000).toISOString(),
      },
    }));
  }, [activeProfile, data, isViewerMode, patchData]);

  useEffect(() => {
    if (!activeProfile || !data?.tasks) {
      return;
    }

    const needsNormalization =
      !Array.isArray(data.categories) ||
      data.categories.length === 0 ||
      data.activeCategoryId === undefined ||
      !isParentViewerState(data.parentViewer) ||
      !isVacationModeState(data.vacationMode) ||
      data.tasks.some(
        (task) =>
          task.status === undefined ||
          task.status === "incomplete" ||
          task.totalTimeSeconds === undefined ||
          task.sessionCount === undefined ||
          task.isBacklog === undefined ||
          task.isAutoBacklog === undefined ||
          task.category === undefined ||
          task.timeSpent === undefined,
      ) ||
      data.sessions.some(
        (session) =>
          session.startTime === undefined ||
          session.durationSeconds === undefined ||
          session.accumulatedTime === undefined ||
          session.status === undefined ||
          session.sessionId === undefined ||
          session.tabId === undefined ||
          session.lastStartTimestamp === undefined ||
          session.isActive === undefined,
      );

    if (!needsNormalization) {
      return;
    }

    patchData((previous) => ({ ...previous }));
  }, [activeProfile, data, patchData]);

  useEffect(() => {
    if (!data || !activeProfile) {
      return;
    }

    const normalizedTimer = sanitizeTimerTaskSelection(data.timer, data.tasks);
    if (normalizedTimer === data.timer) {
      return;
    }

    patchData((previous) => ({
      ...previous,
      timer: sanitizeTimerTaskSelection(previous.timer, previous.tasks),
    }));
  }, [activeProfile, data, patchData]);

  useEffect(() => {
    if (!data || !activeProfile || !data.timer.taskId) {
      return;
    }

    const elapsed = timerElapsedMs(data.timer);
    const expectedStatus: "running" | "paused" | null =
      data.timer.isRunning ? "running" : elapsed > 0 ? "paused" : null;

    if (!expectedStatus) {
      return;
    }

    const activeSession = data.sessions.find((session) => session.isActive === true);

    const needsSessionSync =
      !activeSession ||
      activeSession.status !== expectedStatus ||
      activeSession.sessionId === undefined ||
      activeSession.tabId === undefined ||
      activeSession.accumulatedTime === undefined;

    if (!needsSessionSync) {
      return;
    }

    patchData((previous) => {
      const nowMs = Date.now();
      const currentElapsed = timerElapsedMs(previous.timer, nowMs);

      if (!previous.timer.taskId) {
        return previous;
      }

      const sessions = previous.timer.isRunning
        ? upsertActiveTaskSession(
            previous.sessions,
            previous.timer.taskId,
            previous.timer.subjectId,
            previous.timer.mode,
            previous.timer.mode === "pomodoro" ? "focus" : "manual",
            currentElapsed,
            nowMs,
          )
        : pauseActiveTaskSession(
            previous.sessions,
            previous.timer.taskId,
            previous.timer.subjectId,
            previous.timer.mode,
            previous.timer.mode === "pomodoro" ? "focus" : "manual",
            currentElapsed,
            nowMs,
          );

      return {
        ...previous,
        sessions,
      };
    });
  }, [activeProfile, data, patchData]);
  useEffect(() => {
    if (!activeProfileId) {
      return;
    }

    setProfilesStorageValue((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === activeProfileId
          ? {
              ...profile,
              lastActiveAt: new Date().toISOString(),
            }
          : profile,
        ),
    }));
  }, [activeProfileId, setProfilesStorageValue]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = data.settings.theme === "dark" || (data.settings.theme === "system" && media.matches);
      if (dark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    apply();

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data]);

  useEffect(() => {
    if (!data || !activeProfile) {
      return;
    }

    const today = todayIsoDate();
    if (data.lastRolloverDate === today) {
      return;
    }

    patchData((previous) => {
      if (previous.lastRolloverDate === today) {
        return previous;
      }

      return {
        ...previous,
        lastRolloverDate: today,
      };
    });
  }, [activeProfile, data, patchData]);

  useEffect(() => {
    if (!activeProfile || !data?.tasks) {
      return;
    }

    const runSweep = () => {
      patchData((previous) => {
        const nextTasks = runBacklogSweep(previous.tasks);
        if (nextTasks === previous.tasks) {
          return previous;
        }

        return {
          ...previous,
          tasks: nextTasks,
        };
      });
    };

    runSweep();
    const interval = window.setInterval(runSweep, 60_000);

    return () => window.clearInterval(interval);
  }, [activeProfile, data?.tasks, patchData]);

  // ── Sleep / wake / tab-visibility timer rebase ──────────────────────────
  // When the laptop sleeps or the tab is hidden for a long time, the browser
  // freezes timers. On wake, `startedAtMs` is stale by hours. Without this
  // handler, `timerElapsedMs` would return a huge value all at once, causing
  // completePomodoroPhaseIfDue to fire in a burst and crash the page.
  //
  // Fix: when the page becomes visible again, if the timer is running:
  //   1. Compute the TRUE elapsed time using the stale startedAtMs (correct).
  //   2. Write that total into accumulatedMs.
  //   3. Reset startedAtMs to Date.now().
  // All future ticks now measure from "right now", so no burst happens.
  // The displayed elapsed time is correct because accumulatedMs holds the total.
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only act when the tab becomes VISIBLE (i.e. user returned to the tab)
      if (document.visibilityState !== "visible") {
        return;
      }

      patchData((previous) => {
        const { timer } = previous;

        // Only rebase if the timer is actively running
        if (!timer.isRunning || timer.startedAtMs === null) {
          return previous;
        }

        const nowMs = Date.now();
        const timeSinceStart = nowMs - timer.startedAtMs;

        // Only rebase if the gap is significant (> 5 seconds).
        // Normal tab switches happen in milliseconds; a sleep is seconds or more.
        if (timeSinceStart < 5_000) {
          return previous;
        }

        // Snapshot the correct elapsed totals computed from the stale timestamp
        const trueElapsedMs = timer.accumulatedMs + Math.max(0, timeSinceStart);
        const truePhaseElapsedMs =
          timer.phaseStartedAtMs !== null
            ? timer.phaseAccumulatedMs + Math.max(0, nowMs - timer.phaseStartedAtMs)
            : timer.phaseAccumulatedMs;

        return {
          ...previous,
          timer: {
            ...timer,
            // Write the correct totals into the accumulator fields
            accumulatedMs: trueElapsedMs,
            phaseAccumulatedMs: truePhaseElapsedMs,
            // Reset the "started at" references to right now
            // so all future elapsed calculations measure from this moment
            startedAtMs: nowMs,
            phaseStartedAtMs: nowMs,
          },
        };
      });
    };

    // visibilitychange: fires when switching tabs, minimising, or waking from sleep
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // pageshow: fires when the browser restores the page from the bfcache
    // (back-forward cache). This is a separate event from visibilitychange.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // persisted = true means the page was restored from bfcache
        handleVisibilityChange();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [patchData]);

  // ── Worker-precision timer rebase ─────────────────────────────────────────
  // When the tab becomes visible, we ask the Web Worker (via a custom DOM event)
  // to send its current timestamp via PING → PONG. The worker's clock was NOT
  // frozen during background throttling, so its timestamp is more accurate than
  // calling Date.now() directly in the main thread immediately after wake-up
  // (the main thread may still be slightly stale from freeze).
  //
  // Flow:
  //   1. visibilitychange fires → dispatch "timer:request-worker-timestamp"
  //   2. useNow.ts receives the event → pings the worker
  //   3. Worker responds with PONG containing its timestamp
  //   4. useNow.ts dispatches "timer:worker-timestamp" with the timestamp
  //   5. This effect receives the timestamp → rebases startedAtMs to it
  useEffect(() => {
    const requestWorkerTimestamp = () => {
      if (document.visibilityState === "visible") {
        window.dispatchEvent(new CustomEvent("timer:request-worker-timestamp"));
      }
    };

    const handleWorkerTimestamp = (event: Event) => {
      const workerTimestamp = (event as CustomEvent<number>).detail;

      patchData((previous) => {
        const { timer } = previous;

        // Only rebase if the timer is actively running
        if (!timer.isRunning || timer.startedAtMs === null) {
          return previous;
        }

        const timeSinceStart = workerTimestamp - timer.startedAtMs;

        // Only rebase if the gap is significant (> 5 seconds).
        // The existing visibilitychange handler already covers small gaps.
        if (timeSinceStart < 5_000) {
          return previous;
        }

        const trueElapsedMs = timer.accumulatedMs + Math.max(0, timeSinceStart);
        const truePhaseElapsedMs =
          timer.phaseStartedAtMs !== null
            ? timer.phaseAccumulatedMs + Math.max(0, workerTimestamp - timer.phaseStartedAtMs)
            : timer.phaseAccumulatedMs;

        return {
          ...previous,
          timer: {
            ...timer,
            accumulatedMs: trueElapsedMs,
            phaseAccumulatedMs: truePhaseElapsedMs,
            // Reset both reference points to the authoritative worker timestamp
            startedAtMs: workerTimestamp,
            phaseStartedAtMs: timer.phaseStartedAtMs !== null ? workerTimestamp : null,
          },
        };
      });
    };

    document.addEventListener("visibilitychange", requestWorkerTimestamp);
    window.addEventListener("timer:worker-timestamp", handleWorkerTimestamp);

    return () => {
      document.removeEventListener("visibilitychange", requestWorkerTimestamp);
      window.removeEventListener("timer:worker-timestamp", handleWorkerTimestamp);
    };
  }, [patchData]);

  const createProfile = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      const now = new Date().toISOString();
      const profile: UserProfile = {
        id: createId(),
        name: trimmed,
        createdAt: now,
        lastActiveAt: now,
      };

      profilesStorage.setValue((previous) => ({
        ...previous,
        activeProfileId: profile.id,
        profiles: [...previous.profiles, profile],
      }));
    },
    [profilesStorage],
  );

  const renameProfile = useCallback(
    (profileId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      profilesStorage.setValue((previous) => ({
        ...previous,
        profiles: previous.profiles.map((profile) =>
          profile.id === profileId ? { ...profile, name: trimmed } : profile,
        ),
      }));
    },
    [profilesStorage],
  );

  const switchProfile = useCallback(
    (profileId: string) => {
      profilesStorage.setValue((previous) => {
        if (!previous.profiles.some((profile) => profile.id === profileId)) {
          return previous;
        }

        return {
          ...previous,
          activeProfileId: profileId,
        };
      });
      setPendingReflection(null);
      clearParentViewerSession();
      setViewerSession(null);
    },
    [profilesStorage],
  );

  const deleteProfile = useCallback(
    (profileId: string) => {
      profilesStorage.setValue((previous) => {
        const remaining = previous.profiles.filter((profile) => profile.id !== profileId);
        const nextActive = previous.activeProfileId === profileId ? remaining[0]?.id ?? null : previous.activeProfileId;

        return {
          ...previous,
          activeProfileId: nextActive,
          profiles: remaining,
        };
      });

      browserStorageAdapter.removeItem(STORAGE_KEYS.profileData(profileId));
      setPendingReflection(null);
      clearParentViewerSession();
      setViewerSession(null);
    },
    [profilesStorage],
  );

  const addSubject = useCallback(
    (name: string, color: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => {
        const now = new Date().toISOString();
        const subject: Subject = {
          id: createId(),
          name: trimmed,
          color,
          createdAt: now,
          updatedAt: now,
        };

        return {
          ...previous,
          subjects: [...previous.subjects, subject],
        };
      });
    },
    [patchData],
  );

  const updateSubject = useCallback(
    (subjectId: string, name: string, color: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => ({
        ...previous,
        subjects: previous.subjects.map((subject) =>
          subject.id === subjectId
            ? {
                ...subject,
                name: trimmed,
                color,
                updatedAt: new Date().toISOString(),
              }
            : subject,
        ),
      }));
    },
    [patchData],
  );

  const deleteSubject = useCallback(
    (subjectId: string) => {
      patchData((previous) => ({
        ...previous,
        subjects: previous.subjects.filter((subject) => subject.id !== subjectId),
        tasks: previous.tasks.map((task) => (task.subjectId === subjectId ? { ...task, subjectId: null } : task)),
        sessions: previous.sessions.map((session) =>
          session.subjectId === subjectId ? { ...session, subjectId: null } : session,
        ),
      }));
    },
    [patchData],
  );

  const addTaskCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => {
        const nextCategory: TaskCategory = {
          id: createId(),
          name: trimmed,
          createdAt: Date.now(),
        };

        return {
          ...previous,
          categories: [...(previous.categories ?? createDefaultTaskCategories(Date.now())), nextCategory],
          activeCategoryId: nextCategory.id,
        };
      });
    },
    [patchData],
  );

  const renameTaskCategory = useCallback(
    (categoryId: string, name: string) => {
      if (isSystemTaskCategoryId(categoryId)) {
        return;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => ({
        ...previous,
        categories: (previous.categories ?? []).map((category) =>
          category.id === categoryId ? { ...category, name: trimmed } : category,
        ),
      }));
    },
    [patchData],
  );

  const reorderTaskCategory = useCallback(
    (sourceCategoryId: string, targetCategoryId: string) => {
      if (
        sourceCategoryId === targetCategoryId ||
        isSystemTaskCategoryId(sourceCategoryId) ||
        isSystemTaskCategoryId(targetCategoryId)
      ) {
        return;
      }

      patchData((previous) => {
        const categories = previous.categories ?? createDefaultTaskCategories(Date.now());
        const systemCategories = categories.filter((category) => isSystemTaskCategoryId(category.id));
        const customCategories = categories.filter((category) => !isSystemTaskCategoryId(category.id));
        const sourceIndex = customCategories.findIndex((category) => category.id === sourceCategoryId);
        const targetIndex = customCategories.findIndex((category) => category.id === targetCategoryId);

        if (sourceIndex < 0 || targetIndex < 0) {
          return previous;
        }

        const reordered = [...customCategories];
        const [moved] = reordered.splice(sourceIndex, 1);
        if (!moved) {
          return previous;
        }

        reordered.splice(targetIndex, 0, moved);

        return {
          ...previous,
          categories: [...systemCategories, ...reordered],
        };
      });
    },
    [patchData],
  );

  const deleteTaskCategory = useCallback(
    (categoryId: string, options: DeleteTaskCategoryOptions): DeleteTaskCategoryResult => {
      if (isSystemTaskCategoryId(categoryId)) {
        return {
          ok: false,
          error: "System categories cannot be deleted.",
        };
      }

      let validationError: string | null = null;
      const strategy = options.strategy;

      const result = tryPatchData((previous) => {
        const existing = previous.categories ?? createDefaultTaskCategories(Date.now());
        const matchingCategory = existing.find((category) => category.id === categoryId && !isSystemTaskCategoryId(category.id));
        if (!matchingCategory) {
          validationError = "Category not found.";
          return previous;
        }

        const remaining = existing.filter((category) => category.id !== categoryId || isSystemTaskCategoryId(category.id));
        const remainingCustom = remaining.filter((category) => !isSystemTaskCategoryId(category.id));
        if (remainingCustom.length === 0) {
          validationError = "At least one category is required.";
          return previous;
        }

        const fallbackCategoryId = firstCustomTaskCategoryId(remaining);
        const targetCategoryId =
          strategy === "move"
            ? resolveTaskCategoryId(remaining, options.targetCategoryId, fallbackCategoryId)
            : undefined;

        if (strategy === "move" && !targetCategoryId) {
          validationError = "Select a destination category before deleting.";
          return previous;
        }

        const nextActiveCategoryId =
          previous.activeCategoryId === categoryId
            ? (targetCategoryId ?? SYSTEM_TASK_CATEGORY_IDS.incomplete)
            : (previous.activeCategoryId ?? SYSTEM_TASK_CATEGORY_IDS.incomplete);

        const tasks =
          strategy === "delete"
            ? previous.tasks.filter((task) => task.categoryId !== categoryId)
            : previous.tasks.map((task) =>
                task.categoryId === categoryId
                  ? {
                      ...task,
                      categoryId: targetCategoryId,
                      updatedAt: new Date().toISOString(),
                    }
                  : task,
              );

        return {
          ...previous,
          categories: remaining,
          activeCategoryId: remaining.some((category) => category.id === nextActiveCategoryId)
            ? nextActiveCategoryId
            : SYSTEM_TASK_CATEGORY_IDS.incomplete,
          tasks,
        };
      });

      if (!result.ok) {
        return {
          ok: false,
          error: result.error?.message ?? "Unable to delete category right now.",
        };
      }

      if (validationError) {
        return {
          ok: false,
          error: validationError,
        };
      }

      return {
        ok: true,
      };
    },
    [tryPatchData],
  );

  const setActiveTaskCategory = useCallback(
    (categoryId: string) => {
      patchData((previous) => {
        const categories = previous.categories ?? [];
        if (!categories.some((category) => category.id === categoryId)) {
          return previous;
        }

        return {
          ...previous,
          activeCategoryId: categoryId,
        };
      });
    },
    [patchData],
  );

  const addSubjectTask = useCallback(
    (input: NewSubjectTaskInput) => {
      const title = input.title.trim();
      const subjectId = input.subjectId.trim();

      if (!title || !subjectId) {
        return;
      }

      patchData((previous) => {
        if (!previous.subjects.some((subject) => subject.id === subjectId)) {
          return previous;
        }

        const now = new Date().toISOString();
        const categories = previous.categories ?? createDefaultTaskCategories(Date.now());
        const activeCategoryId = previous.activeCategoryId ?? SYSTEM_TASK_CATEGORY_IDS.incomplete;

        const selectedCategoryId = resolveTaskCategoryId(
          categories,
          input.categoryId,
          !isSystemTaskCategoryId(activeCategoryId) ? activeCategoryId : null,
        );
        if (!selectedCategoryId) {
          return previous;
        }

        const todayIso = todayIsoDate();
        const dueDate = normalizeTimedTaskDueDate(input.dueDate, todayIso);
        const deadline = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null;
        const maxOrder = previous.tasks.reduce((max, task) => Math.max(max, task.order), 0);

        const task: Task = {
          id: createId(),
          title,
          description: input.description?.trim() ?? "",
          subjectId,
          type: classifyTimedTaskType(dueDate, todayIso),
          category: "subject",
          scheduledFor: dueDate,
          bucket: "daily",
          priority: input.priority ?? "medium",
          estimatedMinutes: input.estimatedMinutes ?? null,
          dueDate,
          deadline: Number.isFinite(deadline) ? deadline : null,
          categoryId: selectedCategoryId,
          status: "active",
          previousStatus: null,
          completed: false,
          completedAt: null,
          isBacklog: false,
          isAutoBacklog: false,
          backlogSince: null,
          timeSpent: 0,
          totalTimeSpent: 0,
          isTimerRunning: false,
          totalTimeSeconds: 0,
          sessionCount: 0,
          lastWorkedAt: null,
          order: maxOrder + 1,
          rollovers: 0,
          createdAt: now,
          updatedAt: now,
        };

        return {
          ...previous,
          categories,
          activeCategoryId,
          tasks: [...previous.tasks, task],
        };
      });
    },
    [patchData],
  );
  const addTask = useCallback(
    (input: NewTaskInput) => {
      const trimmed = input.title.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => {
        const now = new Date().toISOString();
        const categories = previous.categories ?? createDefaultTaskCategories(Date.now());
        const activeCategoryId = previous.activeCategoryId ?? SYSTEM_TASK_CATEGORY_IDS.incomplete;

        const selectedCategoryId = resolveTaskCategoryId(
          categories,
          input.categoryId,
          !isSystemTaskCategoryId(activeCategoryId) ? activeCategoryId : null,
        );
        if (!selectedCategoryId) {
          return previous;
        }

        const todayIso = todayIsoDate();
        const dueDate = normalizeTimedTaskDueDate(input.dueDate, todayIso);
        const deadline = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null;

        const maxOrder = previous.tasks.reduce((max, task) => Math.max(max, task.order), 0);

        const taskType = classifyTimedTaskType(dueDate, todayIso);
        const taskCategory = taskType === TaskType.SHORT_TERM ? "shortTerm" : "longTerm";

        const task: Task = {
          id: createId(),
          title: trimmed,
          description: input.description?.trim() ?? "",
          subjectId: input.subjectId ?? null,
          type: taskType,
          category: taskCategory,
          scheduledFor: dueDate,
          bucket: "daily",
          priority: input.priority,
          estimatedMinutes: input.estimatedMinutes ?? null,
          dueDate,
          deadline: Number.isFinite(deadline) ? deadline : null,
          categoryId: selectedCategoryId,
          status: "active",
          previousStatus: null,
          completed: false,
          completedAt: null,
          isBacklog: false,
          isAutoBacklog: false,
          backlogSince: null,
          timeSpent: 0,
          totalTimeSpent: 0,
          isTimerRunning: false,
          totalTimeSeconds: 0,
          sessionCount: 0,
          lastWorkedAt: null,
          order: maxOrder + 1,
          rollovers: 0,
          createdAt: now,
          updatedAt: now,
        };

        return {
          ...previous,
          categories,
          activeCategoryId,
          tasks: [...previous.tasks, task],
        };
      });
    },
    [patchData],
  );

  const updateTask = useCallback(
    (taskId: string, input: UpdateTaskInput) => {
      patchData((previous) => {
        const categories = previous.categories ?? createDefaultTaskCategories(Date.now());

        return {
          ...previous,
          categories,
          tasks: previous.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            const todayIso = todayIsoDate();
            const dueDateInput = input.dueDate === undefined ? task.dueDate : input.dueDate;
            const dueDate =
              input.dueDate === undefined
                ? (dueDateInput ?? minTimedTaskDueDate(todayIso))
                : normalizeTimedTaskDueDate(dueDateInput, todayIso);
            const deadline = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null;
            const existingCategoryId =
              typeof task.categoryId === "string" && !isSystemTaskCategoryId(task.categoryId)
                ? task.categoryId
                : undefined;

            const categoryId = resolveTaskCategoryId(
              categories,
              input.categoryId === undefined ? existingCategoryId : input.categoryId,
              existingCategoryId,
            );
            const currentStatus = normalizeTaskLifecycleStatus(task);
            const classifiedType = classifyTimedTaskType(dueDate, todayIso);
            let nextStatus = input.status ?? currentStatus;

            const rescheduleReset = input.dueDate !== undefined
              ? resolveAutoBacklogReschedule(task, dueDate, todayIso)
              : null;
            if (rescheduleReset && nextStatus === "backlog") {
              // Auto-backlog tasks return to active once rescheduled to today/future.
              nextStatus = rescheduleReset.status;
            }

            const nowIso = new Date().toISOString();
            const nextCompleted = nextStatus === "completed";
            const nextPreviousStatus =
              input.previousStatus !== undefined
                ? input.previousStatus
                : nextCompleted
                  ? (currentStatus === "completed"
                      ? task.previousStatus ?? "active"
                      : currentStatus === "archived"
                        ? "archived"
                        : currentStatus === "backlog"
                          ? "backlog"
                          : "active")
                  : (task.previousStatus ?? null);
            const nextIsBacklog = nextStatus === "backlog";
            const nextIsAutoBacklog =
              nextStatus === "backlog"
                ? (input.isAutoBacklog ?? (task.isAutoBacklog === true))
                : false;
            const nextBacklogSince = nextIsBacklog
              ? (typeof task.backlogSince === "number" && Number.isFinite(task.backlogSince)
                  ? task.backlogSince
                  : Date.now())
              : null;

            return {
              ...task,
              title: input.title?.trim() ?? task.title,
              description: input.description?.trim() ?? task.description,
              subjectId: input.subjectId === undefined ? task.subjectId : input.subjectId,
              priority: input.priority ?? task.priority,
              categoryId: categoryId ?? task.categoryId,
              estimatedMinutes:
                input.estimatedMinutes === undefined ? task.estimatedMinutes : input.estimatedMinutes,
              type: classifiedType,
              category:
                task.category === "subject"
                  ? "subject"
                  : (classifiedType === TaskType.SHORT_TERM ? "shortTerm" : "longTerm"),
              scheduledFor: dueDate,
              dueDate,
              deadline: Number.isFinite(deadline) ? deadline : null,
              status: nextStatus,
              previousStatus: nextPreviousStatus,
              completed: nextCompleted,
              completedAt: nextCompleted ? (task.completedAt ?? nowIso) : null,
              isBacklog: nextIsBacklog,
              isAutoBacklog: rescheduleReset ? rescheduleReset.isAutoBacklog : nextIsAutoBacklog,
              backlogSince: rescheduleReset ? rescheduleReset.backlogSince : nextBacklogSince,
              bucket: rescheduleReset ? rescheduleReset.bucket : (nextIsBacklog ? "backlog" : "daily"),
              timeSpent:
                typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
                  ? task.totalTimeSeconds
                  : task.totalTimeSpent,
              updatedAt: nowIso,
            };
          }),
        };
      });
    },
    [patchData],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.filter((task) => task.id !== taskId),
      }));
    },
    [patchData],
  );

  const toggleTask = useCallback(
    (taskId: string, completed: boolean) => {
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((task) =>
          task.id === taskId
            ? (() => {
                const nowIso = new Date().toISOString();
                if (completed) {
                  const currentStatus = normalizeTaskLifecycleStatus(task);
                  const previousStatus =
                    currentStatus === "completed"
                      ? (task.previousStatus ?? "active")
                      : currentStatus === "backlog"
                        ? "backlog"
                        : currentStatus === "archived"
                          ? "archived"
                          : "active";

                  return {
                    ...task,
                    status: "completed",
                    previousStatus,
                    completed: true,
                    completedAt: nowIso,
                    updatedAt: nowIso,
                  };
                }

                const restoredStatus = restoreTaskStatusFromCompletion(task);
                const isBacklog = restoredStatus === "backlog";
                return {
                  ...task,
                  status: restoredStatus,
                  completed: false,
                  completedAt: null,
                  isBacklog,
                  isAutoBacklog: isBacklog ? task.isAutoBacklog === true : false,
                  backlogSince: isBacklog ? (task.backlogSince ?? Date.now()) : null,
                  bucket: isBacklog ? "backlog" : "daily",
                  updatedAt: nowIso,
                };
              })()
            : task,
        ),
      }));

      const mirror = dailyTaskStoreRef.current?.getDailyTasks().find((task) => task.linkedTimedTaskId === taskId);
      if (mirror) {
        dailyTaskStoreRef.current?.toggleDailyTask(mirror.id, completed, false);
      }
    },
    [patchData],
  );

  const reorderTask = useCallback(
    (sourceTaskId: string, targetTaskId: string) => {
      patchData((previous) => {
        const source = previous.tasks.find((task) => task.id === sourceTaskId);
        const target = previous.tasks.find((task) => task.id === targetTaskId);
        if (!source || !target || source.bucket !== target.bucket || source.id === target.id) {
          return previous;
        }

        const bucketTasks = previous.tasks
          .filter((task) => task.bucket === source.bucket)
          .sort((a, b) => a.order - b.order);

        const sourceIndex = bucketTasks.findIndex((task) => task.id === sourceTaskId);
        const targetIndex = bucketTasks.findIndex((task) => task.id === targetTaskId);
        if (sourceIndex < 0 || targetIndex < 0) {
          return previous;
        }

        const reordered = [...bucketTasks];
        const [moved] = reordered.splice(sourceIndex, 1);
        if (!moved) {
          return previous;
        }
        reordered.splice(targetIndex, 0, moved);

        const orderMap = new Map<string, number>();
        reordered.forEach((task, index) => {
          orderMap.set(task.id, index + 1);
        });

        return {
          ...previous,
          tasks: previous.tasks.map((task) =>
            orderMap.has(task.id)
              ? {
                  ...task,
                  order: orderMap.get(task.id) ?? task.order,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        };
      });
    },
    [patchData],
  );

  const bulkDeleteTasks = useCallback(
    (taskIds: string[]) => {
      const idSet = new Set(taskIds);
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.filter((task) => !idSet.has(task.id)),
      }));
    },
    [patchData],
  );

  const bulkMoveTasks = useCallback(
    (taskIds: string[], bucket: TaskBucket) => {
      if (bucket === "backlog") {
        return;
      }

      const idSet = new Set(taskIds);
      patchData((previous) => {
        const unaffected = previous.tasks.filter((task) => !idSet.has(task.id));
        let orderBase = unaffected.filter((task) => task.bucket === "daily").reduce((max, task) => Math.max(max, task.order), 0);

        const moved = previous.tasks
          .filter((task) => idSet.has(task.id))
          .map((task) => {
            orderBase += 1;
            return {
              ...task,
              bucket: "daily",
              status: "active",
              previousStatus: task.previousStatus ?? null,
              completed: false,
              completedAt: null,
              isBacklog: false,
              isAutoBacklog: false,
              backlogSince: null,
              dueDate: task.dueDate ?? todayIsoDate(),
              order: orderBase,
              updatedAt: new Date().toISOString(),
            };
          });

        return {
          ...previous,
          tasks: [...unaffected, ...moved],
        };
      });
    },
    [patchData],
  );

  const bulkCompleteTasks = useCallback(
    (taskIds: string[], completed: boolean) => {
      const idSet = new Set(taskIds);
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((task) =>
          idSet.has(task.id)
            ? (() => {
                const nowIso = new Date().toISOString();
                if (completed) {
                  const currentStatus = normalizeTaskLifecycleStatus(task);
                  const previousStatus =
                    currentStatus === "completed"
                      ? (task.previousStatus ?? "active")
                      : currentStatus === "backlog"
                        ? "backlog"
                        : currentStatus === "archived"
                          ? "archived"
                          : "active";

                  return {
                    ...task,
                    status: "completed",
                    previousStatus,
                    completed: true,
                    completedAt: nowIso,
                    updatedAt: nowIso,
                  };
                }

                const restoredStatus = restoreTaskStatusFromCompletion(task);
                const isBacklog = restoredStatus === "backlog";

                return {
                  ...task,
                  status: restoredStatus,
                  completed: false,
                  completedAt: null,
                  isBacklog,
                  isAutoBacklog: isBacklog ? task.isAutoBacklog === true : false,
                  backlogSince: isBacklog ? (task.backlogSince ?? Date.now()) : null,
                  bucket: isBacklog ? "backlog" : "daily",
                  updatedAt: nowIso,
                };
              })()
            : task,
        ),
      }));
    },
    [patchData],
  );

  const bulkSetTaskLifecycleStatus = useCallback(
    (taskIds: string[], status: Exclude<TaskLifecycleStatus, "completed">) => {
      const idSet = new Set(taskIds);
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((task) => {
          if (!idSet.has(task.id)) {
            return task;
          }

          const nowIso = new Date().toISOString();
          const isBacklog = status === "backlog";
          return {
            ...task,
            status,
            previousStatus: task.previousStatus ?? null,
            completed: false,
            completedAt: null,
            isBacklog,
            isAutoBacklog: isBacklog ? task.isAutoBacklog === true : false,
            backlogSince: isBacklog ? (task.backlogSince ?? Date.now()) : null,
            bucket: isBacklog ? "backlog" : "daily",
            updatedAt: nowIso,
          };
        }),
      }));
    },
    [patchData],
  );

  const runTaskBacklogAutomation = useCallback(() => {
    patchData((previous) => {
      const nextTasks = runBacklogSweep(previous.tasks);
      if (nextTasks === previous.tasks) {
        return previous;
      }

      return {
        ...previous,
        tasks: nextTasks,
      };
    });
  }, [patchData]);

  const updateSettings = useCallback(
    (updater: (previous: AppSettings) => AppSettings) => {
      patchData((previous) => ({
        ...previous,
        settings: ensureSettingsShape(updater(previous.settings)),
      }));
    },
    [patchData],
  );

  const setVacationMode = useCallback(
    (enabled: boolean): VacationModeMutationResult => {
      if (!activeProfile || !data) {
        return {
          ok: false,
          error: "No active profile selected.",
        };
      }

      if (isViewerMode) {
        logViewerWriteViolation("Vacation mode toggle blocked.");
        return {
          ok: false,
          error: "Viewer mode is read-only.",
        };
      }

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      let validationError: string | undefined;

      const writeResult = tryPatchData((previous) => {
        const current = ensureVacationModeShape(previous.vacationMode);

        if (enabled) {
          const cooldownUntilMs = parseIsoTimestamp(current.cooldownUntil);
          if (cooldownUntilMs !== null && nowMs < cooldownUntilMs) {
            validationError = `Vacation Mode is on cooldown until ${new Date(cooldownUntilMs).toLocaleString()}.`;
            return previous;
          }

          return {
            ...previous,
            vacationMode: {
              ...current,
              enabled: true,
              startedAt: nowIso,
              expiresAt: new Date(nowMs + VACATION_MAX_DURATION_DAYS * 86_400_000).toISOString(),
            },
          };
        }

        return {
          ...previous,
          vacationMode: {
            ...current,
            enabled: false,
            startedAt: null,
            expiresAt: null,
            cooldownUntil: new Date(nowMs + VACATION_COOLDOWN_DAYS * 86_400_000).toISOString(),
          },
        };
      });

      if (validationError) {
        return {
          ok: false,
          error: validationError,
        };
      }

      if (!writeResult.ok || !writeResult.value) {
        return {
          ok: false,
          error: "Unable to update Vacation Mode.",
        };
      }

      return {
        ok: true,
        state: ensureVacationModeShape(writeResult.value.vacationMode),
      };
    },
    [activeProfile, data, isViewerMode, logViewerWriteViolation, tryPatchData],
  );

  const createOrRefreshParentAccessCode = useCallback(
    async (action: "generate" | "refresh"): Promise<ParentAccessCodeResult> => {
      if (!activeProfile || !data) {
        return {
          ok: false,
          error: "No active profile selected.",
        };
      }

      if (isViewerMode) {
        logViewerWriteViolation("Parent OTP refresh blocked.");
        return {
          ok: false,
          error: "Viewer mode is read-only.",
        };
      }

      const clientId = getParentViewerClientId();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const otpExpiresAt = new Date(nowMs + PARENT_OTP_EXPIRY_MS).toISOString();

      let plainOtp: string;
      let otpHash: string;

      try {
        plainOtp = generateParentOtp(16);
        otpHash = await sha256Hex(normalizeParentOtpInput(plainOtp));
      } catch {
        return {
          ok: false,
          error: "Unable to generate a secure parent code in this browser.",
        };
      }

      const writeResult = profileDataStorage.trySetValue((previous) => {
        const parentViewer = ensureParentViewerShape(previous.parentViewer);

        return normalizeProfileData(
          {
            ...previous,
            parentViewer: {
              ...parentViewer,
              otpHash,
              otpCreatedAt: nowIso,
              otpExpiresAt,
              failedAttempts: 0,
              lockedUntil: null,
              auditLog: appendParentViewerAuditEvent(
                parentViewer.auditLog,
                buildParentViewerAuditEvent(
                  activeProfile.id,
                  clientId,
                  action,
                  true,
                  action === "generate" ? "Generated parent access code." : "Refreshed parent access code.",
                ),
              ),
            },
          },
          activeProfile.id,
        );
      });

      if (!writeResult.ok) {
        return {
          ok: false,
          error: "Unable to save parent access code.",
        };
      }

      clearParentRateLimit(activeProfile.id, clientId);
      clearParentViewerSession();
      setViewerSession(null);

      return {
        ok: true,
        code: normalizeParentOtpInput(plainOtp),
        displayCode: formatParentOtpForDisplay(plainOtp),
        expiresAt: otpExpiresAt,
      };
    },
    [activeProfile, data, isViewerMode, logViewerWriteViolation, normalizeProfileData, profileDataStorage],
  );

  const generateParentAccessCode = useCallback(
    async (): Promise<ParentAccessCodeResult> => createOrRefreshParentAccessCode("generate"),
    [createOrRefreshParentAccessCode],
  );

  const refreshParentAccessCode = useCallback(
    async (): Promise<ParentAccessCodeResult> => createOrRefreshParentAccessCode("refresh"),
    [createOrRefreshParentAccessCode],
  );

  const verifyParentAccessCode = useCallback(
    async (code: string): Promise<ParentAccessVerificationResult> => {
      if (!activeProfile || !data) {
        return {
          ok: false,
          error: "No active profile selected.",
        };
      }

      const clientId = getParentViewerClientId();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const normalizedInput = normalizeParentOtpInput(code);

      if (normalizedInput.length < 6) {
        return {
          ok: false,
          error: "Enter a valid parent access code.",
        };
      }

      const rateLimit = consumeParentRateLimitAttempt(activeProfile.id, clientId, nowMs);
      if (!rateLimit.allowed) {
        profileDataStorage.trySetValue((previous) => {
          const parentViewer = ensureParentViewerShape(previous.parentViewer);
          return normalizeProfileData(
            {
              ...previous,
              parentViewer: {
                ...parentViewer,
                auditLog: appendParentViewerAuditEvent(
                  parentViewer.auditLog,
                  buildParentViewerAuditEvent(
                    activeProfile.id,
                    clientId,
                    "verify_rate_limited",
                    false,
                    `Retry after ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`,
                  ),
                ),
              },
            },
            activeProfile.id,
          );
        });

        return {
          ok: false,
          error: "Too many attempts. Please try again shortly.",
          status: 429,
          retryAfterMs: rateLimit.retryAfterMs,
        };
      }

      const parentViewerState = ensureParentViewerShape(data.parentViewer);
      const lockedUntilMs = parseIsoTimestamp(parentViewerState.lockedUntil);

      if (lockedUntilMs !== null && nowMs < lockedUntilMs) {
        profileDataStorage.trySetValue((previous) => {
          const parentViewer = ensureParentViewerShape(previous.parentViewer);
          return normalizeProfileData(
            {
              ...previous,
              parentViewer: {
                ...parentViewer,
                auditLog: appendParentViewerAuditEvent(
                  parentViewer.auditLog,
                  buildParentViewerAuditEvent(
                    activeProfile.id,
                    clientId,
                    "verify_locked",
                    false,
                    `Locked until ${parentViewer.lockedUntil}.`,
                  ),
                ),
              },
            },
            activeProfile.id,
          );
        });

        return {
          ok: false,
          error: "Parent access is temporarily locked.",
          status: 423,
          lockedUntil: parentViewerState.lockedUntil,
        };
      }

      if (!parentViewerState.otpHash) {
        return {
          ok: false,
          error: "No parent access code has been generated yet.",
        };
      }

      const otpExpiresMs = parseIsoTimestamp(parentViewerState.otpExpiresAt);
      if (otpExpiresMs !== null && nowMs > otpExpiresMs) {
        profileDataStorage.trySetValue((previous) => {
          const parentViewer = ensureParentViewerShape(previous.parentViewer);
          return normalizeProfileData(
            {
              ...previous,
              parentViewer: {
                ...parentViewer,
                auditLog: appendParentViewerAuditEvent(
                  parentViewer.auditLog,
                  buildParentViewerAuditEvent(activeProfile.id, clientId, "verify_expired", false, "Code expired."),
                ),
              },
            },
            activeProfile.id,
          );
        });

        return {
          ok: false,
          error: "Parent access code expired. Ask the student to refresh it.",
        };
      }

      let candidateHash = "";
      try {
        candidateHash = await sha256Hex(normalizedInput);
      } catch {
        return {
          ok: false,
          error: "Secure verification is unavailable in this browser.",
        };
      }

      const isValid = constantTimeEqualHex(candidateHash, parentViewerState.otpHash);
      if (!isValid) {
        let lockUntil: string | null = null;

        const failureWrite = profileDataStorage.trySetValue((previous) => {
          const parentViewer = ensureParentViewerShape(previous.parentViewer);
          const failedAttempts = Math.max(0, parentViewer.failedAttempts) + 1;
          const lockoutReached = failedAttempts >= PARENT_FAILED_ATTEMPT_LIMIT;
          lockUntil = lockoutReached ? new Date(nowMs + PARENT_LOCKOUT_MS).toISOString() : null;

          let auditLog = appendParentViewerAuditEvent(
            parentViewer.auditLog,
            buildParentViewerAuditEvent(activeProfile.id, clientId, "verify_failure", false, "Invalid OTP."),
          );

          if (lockoutReached) {
            auditLog = appendParentViewerAuditEvent(
              auditLog,
              buildParentViewerAuditEvent(
                activeProfile.id,
                clientId,
                "lockout",
                false,
                `Locked until ${lockUntil}.`,
              ),
            );
          }

          return normalizeProfileData(
            {
              ...previous,
              parentViewer: {
                ...parentViewer,
                failedAttempts,
                lockedUntil: lockUntil,
                auditLog,
              },
            },
            activeProfile.id,
          );
        });

        if (!failureWrite.ok) {
          return {
            ok: false,
            error: "Unable to verify parent access code.",
          };
        }

        if (lockUntil) {
          return {
            ok: false,
            error: "Too many failed attempts. Parent access is locked for 15 minutes.",
            lockedUntil: lockUntil,
            status: 423,
          };
        }

        return {
          ok: false,
          error: "Invalid parent access code.",
        };
      }

      const successWrite = profileDataStorage.trySetValue((previous) => {
        const parentViewer = ensureParentViewerShape(previous.parentViewer);
        return normalizeProfileData(
          {
            ...previous,
            parentViewer: {
              ...parentViewer,
              failedAttempts: 0,
              lockedUntil: null,
              lastAccessAt: nowIso,
              auditLog: appendParentViewerAuditEvent(
                parentViewer.auditLog,
                buildParentViewerAuditEvent(activeProfile.id, clientId, "verify_success", true, "Viewer login."),
              ),
            },
          },
          activeProfile.id,
        );
      });

      if (!successWrite.ok || !successWrite.value) {
        return {
          ok: false,
          error: "Unable to create viewer session.",
        };
      }

      const finalizedParentViewer = ensureParentViewerShape(successWrite.value.parentViewer);
      if (!finalizedParentViewer.otpHash) {
        return {
          ok: false,
          error: "Parent access configuration is unavailable.",
        };
      }

      const expiresAt = finalizedParentViewer.otpExpiresAt ?? new Date(nowMs + PARENT_OTP_EXPIRY_MS).toISOString();
      const session: ParentViewerSession = {
        role: "viewer",
        profileId: activeProfile.id,
        otpHash: finalizedParentViewer.otpHash,
        authenticatedAt: nowIso,
        expiresAt,
      };

      writeParentViewerSession(session);
      clearParentRateLimit(activeProfile.id, clientId);
      setViewerSession(session);

      return {
        ok: true,
      };
    },
    [activeProfile, data, normalizeProfileData, profileDataStorage],
  );

  const exitViewerMode = useCallback(() => {
    clearParentViewerSession();
    setViewerSession(null);
  }, []);

  const setTheme = useCallback(
    (mode: AppSettings["theme"]) => {
      updateSettings((previous) => ({
        ...previous,
        theme: mode,
      }));
    },
    [updateSettings],
  );

  const setTimerMode = useCallback(
    (mode: TimerMode) => {
      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.filter((session) => session.isActive !== true),
        timer: {
          ...DEFAULT_TIMER_SNAPSHOT,
          mode,
          subjectId: previous.timer.subjectId,
          taskId: previous.timer.taskId,
        },
      }));
    },
    [patchData],
  );

  const selectTimerSubject = useCallback(
    (subjectId: string | null) => {
      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.map((session) =>
          session.isActive === true
            ? {
                ...session,
                subjectId,
              }
            : session,
        ),
        timer: {
          ...previous.timer,
          subjectId,
        },
      }));
    },
    [patchData],
  );
  const selectTimerTask = useCallback(
    (taskId: string | null) => {
      patchData((previous) => {
        const nowMs = Date.now();
        const selectedTask = taskId ? previous.tasks.find((task) => task.id === taskId) ?? null : null;
        const nextTaskId = selectedTask && isTimerTaskEligible(selectedTask, previous.timer.subjectId) ? selectedTask.id : null;
        const changingTask = previous.timer.taskId !== nextTaskId;
        let sessions = previous.sessions;
        let timer = previous.timer;

        if (changingTask && (previous.timer.isRunning || previous.timer.accumulatedMs > 0)) {
          const elapsed = timerElapsedMs(previous.timer, nowMs);
          const finalized = finalizeTaskSession(
            sessions,
            previous.timer.taskId,
            previous.timer.subjectId,
            previous.timer.mode,
            previous.timer.mode === "pomodoro" ? "focus" : "manual",
            elapsed,
            nowMs,
          );
          sessions = finalized.sessions;

          timer = {
            ...timer,
            accumulatedMs: 0,
            phaseAccumulatedMs: 0,
            startedAtMs: previous.timer.isRunning ? nowMs : null,
            phaseStartedAtMs: previous.timer.isRunning ? nowMs : null,
          };
        }

        if (nextTaskId && timer.isRunning) {
          sessions = upsertActiveTaskSession(
            sessions,
            nextTaskId,
            timer.subjectId,
            timer.mode,
            timer.mode === "pomodoro" ? "focus" : "manual",
            timerElapsedMs(timer, nowMs),
            nowMs,
          );
        }

        return {
          ...previous,
          sessions,
          timer: {
            ...timer,
            taskId: nextTaskId,
          },
        };
      });
    },
    [patchData],
  );

  const addTaskToActiveSession = useCallback(
    (taskId: string): boolean => {
      const normalizedTaskId = taskId.trim();
      if (!normalizedTaskId) {
        return false;
      }

      let didAdd = false;

      patchData((previous) => {
        const targetTask = previous.tasks.find((task) => task.id === normalizedTaskId);
        if (!targetTask || targetTask.completed || !canUseTimer(targetTask)) {
          return previous;
        }

        const activeIndex = previous.sessions.findIndex((session) => session.isActive === true);
        if (activeIndex < 0) {
          return previous;
        }

        const activeSession = previous.sessions[activeIndex];
        if (!activeSession) {
          return previous;
        }

        const nowMs = Date.now();
        const elapsedSeconds = clampSessionSeconds(Math.floor(timerElapsedMs(previous.timer, nowMs) / 1000));
        const allocationState = sessionAllocationState(activeSession, nowMs, previous.timer.taskId ?? normalizedTaskId);
        const taskIds = dedupeSessionTaskIds(activeSession, normalizedTaskId);
        const startTime =
          typeof activeSession.startTime === "number" && Number.isFinite(activeSession.startTime)
            ? activeSession.startTime
            : nowMs - elapsedSeconds * 1000;

        const updatedSession: StudySession = {
          ...activeSession,
          sessionId: activeSession.sessionId ?? activeSession.id,
          tabId: activeSession.tabId ?? TAB_ID,
          taskId: normalizedTaskId,
          taskIds,
          taskAllocations: allocationState.taskAllocations,
          activeTaskId: normalizedTaskId,
          activeTaskStartedAt: previous.timer.isRunning ? nowMs : null,
          subjectId: targetTask.subjectId ?? previous.timer.subjectId,
          startTime,
          startedAt: new Date(startTime).toISOString(),
          endedAt: new Date(startTime + elapsedSeconds * 1000).toISOString(),
          durationSeconds: elapsedSeconds,
          accumulatedTime: elapsedSeconds,
          durationMs: elapsedSeconds * 1000,
          status: previous.timer.isRunning ? "running" : "paused",
          lastStartTimestamp: previous.timer.isRunning ? nowMs : null,
          isActive: true,
        };

        didAdd = true;

        return {
          ...previous,
          sessions: previous.sessions.map((session, index) =>
            index === activeIndex ? updatedSession : session,
          ),
          timer: {
            ...previous.timer,
            taskId: normalizedTaskId,
            subjectId: targetTask.subjectId ?? previous.timer.subjectId,
          },
        };
      });

      return didAdd;
    },
    [patchData],
  );

  const startTimer = useCallback(() => {
    patchData((previous) => {
      const nowMs = Date.now();
      const elapsed = timerElapsedMs(previous.timer, nowMs);
      const timer = {
        ...previous.timer,
        isRunning: true,
        startedAtMs: nowMs,
        phaseStartedAtMs: nowMs,
        accumulatedMs: elapsed,
      };

      const sessions = upsertActiveTaskSession(
        previous.sessions,
        timer.taskId,
        timer.subjectId,
        timer.mode,
        timer.mode === "pomodoro" ? "focus" : "manual",
        elapsed,
        nowMs,
      );

      return {
        ...previous,
        sessions,
        timer,
      };
    });
  }, [patchData]);

  const pauseTimer = useCallback(() => {
    patchData((previous) => {
      if (!previous.timer.isRunning) {
        return previous;
      }

      const nowMs = Date.now();
      const elapsed = timerElapsedMs(previous.timer, nowMs);

      const sessions = pauseActiveTaskSession(
        previous.sessions,
        previous.timer.taskId,
        previous.timer.subjectId,
        previous.timer.mode,
        previous.timer.mode === "pomodoro" ? "focus" : "manual",
        elapsed,
        nowMs,
      );

      return {
        ...previous,
        sessions,
        timer: {
          ...previous.timer,
          isRunning: false,
          startedAtMs: null,
          accumulatedMs: elapsed,
          phaseStartedAtMs: null,
          phaseAccumulatedMs: timerPhaseElapsedMs(previous.timer, nowMs),
        },
      };
    });
  }, [patchData]);

  const resumeTimer = useCallback(() => {
    patchData((previous) => {
      if (previous.timer.isRunning) {
        return previous;
      }

      const nowMs = Date.now();
      const elapsed = timerElapsedMs(previous.timer, nowMs);
      if (elapsed <= 0) {
        return previous;
      }

      const timer = {
        ...previous.timer,
        isRunning: true,
        startedAtMs: nowMs,
        phaseStartedAtMs: nowMs,
        accumulatedMs: elapsed,
      };

      const sessions = upsertActiveTaskSession(
        previous.sessions,
        timer.taskId,
        timer.subjectId,
        timer.mode,
        timer.mode === "pomodoro" ? "focus" : "manual",
        elapsed,
        nowMs,
      );

      const hasRunningSession =
        timer.taskId === null ||
        sessions.some(
          (session) =>
            session.isActive === true &&
            session.taskId === timer.taskId &&
            session.status === "running",
        );

      if (!hasRunningSession) {
        return previous;
      }

      return {
        ...previous,
        sessions,
        timer,
      };
    });
  }, [patchData]);

  const resetTimer = useCallback(
    (force = false): boolean => {
      if (!data) {
        return false;
      }

      const elapsed = timerElapsedMs(data.timer);
      if (data.settings.timer.preventAccidentalReset && elapsed > 0 && !force) {
        return false;
      }

      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.filter((session) => session.isActive !== true),
        timer: {
          ...DEFAULT_TIMER_SNAPSHOT,
          mode: previous.timer.mode,
          subjectId: previous.timer.subjectId,
          taskId: previous.timer.taskId,
        },
      }));

      return true;
    },
    [data, patchData],
  );

  const stopTimer = useCallback(() => {
    if (!data) {
      return;
    }

    let reflection: PendingReflection | null = null;
    let shouldPlaySound = false;

    patchData((previous) => {
      const nowMs = Date.now();
      const elapsed = timerElapsedMs(previous.timer, nowMs);
      const modePhase = previous.timer.mode === "pomodoro" ? "focus" : "manual";

      let sessions = previous.sessions;
      if (elapsed > 0 && (previous.timer.mode === "stopwatch" || previous.timer.phase === "focus")) {
        const finalized = finalizeTaskSession(
          sessions,
          previous.timer.taskId,
          previous.timer.subjectId,
          previous.timer.mode,
          modePhase,
          elapsed,
          nowMs,
        );

        sessions = finalized.sessions;
        if (finalized.finalized) {
          if (!sessionHasReflection(finalized.finalized)) {
            reflection = {
              sessionId: finalized.finalized.id,
              subjectId: finalized.finalized.subjectId,
              durationMs: finalized.finalized.durationMs,
            };
          }
          shouldPlaySound = previous.settings.timer.soundEnabled;
        }
      }

      return {
        ...previous,
        sessions,
        timer: {
          ...DEFAULT_TIMER_SNAPSHOT,
          mode: previous.timer.mode,
          subjectId: previous.timer.subjectId,
          taskId: previous.timer.taskId,
        },
      };
    });

    if (reflection) {
      setPendingReflection(reflection);
    }

    if (shouldPlaySound) {
      playCompletionTone();
    }
  }, [data, patchData]);

  const completePomodoroPhaseIfDue = useCallback(() => {
    if (!data || data.timer.mode !== "pomodoro" || !data.timer.isRunning) {
      return;
    }

    let reflection: PendingReflection | null = null;
    let shouldPlaySound = false;

    patchData((previous) => {
      if (previous.timer.mode !== "pomodoro" || !previous.timer.isRunning) {
        return previous;
      }

      const nowMs = Date.now();
      const elapsedPhase = timerPhaseElapsedMs(previous.timer, nowMs);
      const requiredPhase = phaseDurationMs(previous.settings.timer, previous.timer.phase);

      if (elapsedPhase < requiredPhase) {
        return previous;
      }

      const next = nextPomodoroPhase(
        previous.timer.phase,
        previous.timer.cycleCount,
        previous.settings.timer.longBreakInterval,
      );

      let sessions = previous.sessions;
      if (next.justCompletedFocus) {
        const finalized = finalizeTaskSession(
          sessions,
          previous.timer.taskId,
          previous.timer.subjectId,
          "pomodoro",
          "focus",
          elapsedPhase,
          nowMs,
        );

        sessions = finalized.sessions;
        if (finalized.finalized && !sessionHasReflection(finalized.finalized)) {
          reflection = {
            sessionId: finalized.finalized.id,
            subjectId: finalized.finalized.subjectId,
            durationMs: finalized.finalized.durationMs,
          };
        }
      }

      shouldPlaySound = previous.settings.timer.soundEnabled;

      const autoStart = previous.settings.timer.autoStartNextPhase;
      if (autoStart && next.phase === "focus") {
        sessions = upsertActiveTaskSession(
          sessions,
          previous.timer.taskId,
          previous.timer.subjectId,
          "pomodoro",
          "focus",
          0,
          nowMs,
        );
      }

      return {
        ...previous,
        sessions,
        timer: {
          ...previous.timer,
          phase: next.phase,
          cycleCount: next.cycleCount,
          isRunning: autoStart,
          startedAtMs: autoStart ? nowMs : null,
          accumulatedMs: 0,
          phaseStartedAtMs: autoStart ? nowMs : null,
          phaseAccumulatedMs: 0,
        },
      };
    });

    if (reflection) {
      setPendingReflection(reflection);
    }

    if (shouldPlaySound) {
      playCompletionTone();
    }
  }, [data, patchData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      // Only run the check when there is actually a running Pomodoro session.
      // This avoids a constant 1s state-check cycle when using stopwatch mode
      // or when the timer is idle — saving CPU and preventing unnecessary re-renders.
      if (
        data?.timer.isRunning === true &&
        data?.timer.mode === "pomodoro"
      ) {
        completePomodoroPhaseIfDue();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completePomodoroPhaseIfDue, data?.timer.isRunning, data?.timer.mode]);

  const dismissPendingReflection = useCallback(() => {
    setPendingReflection(null);
  }, []);

  const saveSessionReflection = useCallback(
    (sessionId: string, rating: SessionRating | null, reflection: string) => {
      const reflectionComment = normalizeReflectionText(reflection);

      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          const nextRating = rating;
          const nextTimestamp = nextRating ? resolveSessionReflectionTimestamp(session, Date.now()) : null;

          if (
            session.reflectionRating === nextRating &&
            session.reflectionComment === reflectionComment &&
            session.reflectionTimestamp === nextTimestamp &&
            session.rating === nextRating &&
            session.reflection === reflectionComment
          ) {
            return session;
          }

          return {
            ...session,
            reflectionRating: nextRating,
            reflectionComment,
            reflectionTimestamp: nextTimestamp,
            rating: nextRating,
            reflection: reflectionComment,
          };
        }),
      }));

      setPendingReflection((previous) => (previous?.sessionId === sessionId ? null : previous));
    },
    [patchData],
  );

  const updateSessionDuration = useCallback(
    (sessionId: string, durationSeconds: number): boolean => {
      const normalizedDuration = clampSessionSeconds(durationSeconds);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || normalizedDuration > MAX_SESSION_SECONDS) {
        return false;
      }

      let didUpdate = false;

      patchData((previous) => {
        const index = previous.sessions.findIndex((session) => session.id === sessionId);
        if (index < 0) {
          return previous;
        }

        const target = previous.sessions[index];
        if (!target || target.isActive === true) {
          return previous;
        }

        const taskIds = dedupeSessionTaskIds(target, target.taskId);
        const preferredTaskId = target.taskId ?? taskIds[taskIds.length - 1] ?? null;
        const taskAllocations = rebalanceSessionTaskAllocations(
          resolveSessionTaskAllocations(target, normalizedDuration),
          taskIds,
          normalizedDuration,
          preferredTaskId,
        );

        didUpdate = true;
        const endTime = target.endTime ?? Date.parse(target.endedAt);
        const resolvedEndTime = Number.isFinite(endTime) ? endTime : Date.now();
        const resolvedStartTime = resolvedEndTime - normalizedDuration * 1000;

        const updated: StudySession = {
          ...target,
          sessionId: target.sessionId ?? target.id,
          tabId: target.tabId ?? TAB_ID,
          taskId: preferredTaskId,
          taskIds,
          taskAllocations,
          activeTaskId: null,
          activeTaskStartedAt: null,
          startTime: resolvedStartTime,
          endTime: resolvedEndTime,
          startedAt: new Date(resolvedStartTime).toISOString(),
          endedAt: new Date(resolvedEndTime).toISOString(),
          durationSeconds: normalizedDuration,
          accumulatedTime: normalizedDuration,
          durationMs: normalizedDuration * 1000,
          status: "completed",
          lastStartTimestamp: null,
          isActive: false,
        };

        return {
          ...previous,
          sessions: previous.sessions.map((session, sessionIndex) =>
            sessionIndex === index ? updated : session,
          ),
        };
      });

      return didUpdate;
    },
    [patchData],
  );

  const continueSession = useCallback(
    (sessionId: string): boolean => {
      let didContinue = false;

      patchData((previous) => {
        const activeSession = previous.sessions.find(
          (session) => session.isActive === true && (session.status === "running" || session.status === "paused"),
        );

        if (activeSession) {
          const resumedSeconds = resolveSessionSeconds(activeSession);
          const isRunning = activeSession.status === "running";
          const nowMs = Date.now();
          const runningStartMs = isRunning
            ? (typeof activeSession.lastStartTimestamp === "number" && Number.isFinite(activeSession.lastStartTimestamp)
                ? activeSession.lastStartTimestamp
                : nowMs)
            : null;

          const nextTimer: TimerSnapshot = {
            ...previous.timer,
            mode: activeSession.mode,
            phase: activeSession.mode === "pomodoro" ? "focus" : previous.timer.phase,
            isRunning,
            startedAtMs: runningStartMs,
            accumulatedMs: resumedSeconds * 1000,
            phaseStartedAtMs: runningStartMs,
            phaseAccumulatedMs:
              activeSession.mode === "pomodoro" ? resumedSeconds * 1000 : previous.timer.phaseAccumulatedMs,
            subjectId: activeSession.subjectId,
            taskId: activeSession.taskId,
          };

          const timerAlreadySynced =
            previous.timer.mode === nextTimer.mode &&
            previous.timer.phase === nextTimer.phase &&
            previous.timer.isRunning === nextTimer.isRunning &&
            previous.timer.startedAtMs === nextTimer.startedAtMs &&
            previous.timer.accumulatedMs === nextTimer.accumulatedMs &&
            previous.timer.phaseStartedAtMs === nextTimer.phaseStartedAtMs &&
            previous.timer.phaseAccumulatedMs === nextTimer.phaseAccumulatedMs &&
            previous.timer.subjectId === nextTimer.subjectId &&
            previous.timer.taskId === nextTimer.taskId;

          didContinue = true;

          if (timerAlreadySynced) {
            return previous;
          }

          return {
            ...previous,
            timer: nextTimer,
          };
        }

        const targetIndex = previous.sessions.findIndex((session) => session.id === sessionId);
        if (targetIndex < 0) {
          return previous;
        }

        const target = previous.sessions[targetIndex];
        if (!target || target.status === "running" || target.isActive === true) {
          return previous;
        }

        const nowMs = Date.now();
        let sessions = previous.sessions;

        const otherActiveSession = sessions.find((session) => session.isActive === true);
        if (otherActiveSession && otherActiveSession.id !== target.id) {
          const activeElapsedMs =
            otherActiveSession.status === "running"
              ? resolveRunningSessionElapsedSeconds(otherActiveSession, nowMs) * 1000
              : resolveSessionSeconds(otherActiveSession) * 1000;

          const finalizedActive = finalizeTaskSession(
            sessions,
            otherActiveSession.taskId,
            otherActiveSession.subjectId,
            otherActiveSession.mode,
            otherActiveSession.phase,
            activeElapsedMs,
            nowMs,
          );
          sessions = finalizedActive.sessions;
        }

        const refreshedIndex = sessions.findIndex((session) => session.id === sessionId);
        if (refreshedIndex < 0) {
          return previous;
        }

        const refreshedTarget = sessions[refreshedIndex];
        if (!refreshedTarget || refreshedTarget.status === "running" || refreshedTarget.isActive === true) {
          return previous;
        }

        const resumedSeconds = resolveSessionSeconds(refreshedTarget);

        const taskIds = dedupeSessionTaskIds(refreshedTarget, refreshedTarget.taskId);
        const preferredTaskId = refreshedTarget.taskId ?? taskIds[taskIds.length - 1] ?? null;
        const taskAllocations = rebalanceSessionTaskAllocations(
          resolveSessionTaskAllocations(refreshedTarget, resumedSeconds),
          taskIds,
          resumedSeconds,
          preferredTaskId,
        );

        const startTime =
          typeof refreshedTarget.startTime === "number" && Number.isFinite(refreshedTarget.startTime)
            ? refreshedTarget.startTime
            : nowMs - resumedSeconds * 1000;

        const resumedTask = preferredTaskId ? previous.tasks.find((task) => task.id === preferredTaskId) ?? null : null;
        const resumedSubjectId = resumedTask?.subjectId ?? refreshedTarget.subjectId;

        const resumed: StudySession = {
          ...refreshedTarget,
          sessionId: refreshedTarget.sessionId ?? refreshedTarget.id,
          tabId: refreshedTarget.tabId ?? TAB_ID,
          taskId: preferredTaskId,
          taskIds,
          taskAllocations,
          activeTaskId: preferredTaskId,
          activeTaskStartedAt: nowMs,
          startTime,
          startedAt: new Date(startTime).toISOString(),
          endTime: null,
          endedAt: new Date(startTime + resumedSeconds * 1000).toISOString(),
          durationSeconds: resumedSeconds,
          accumulatedTime: resumedSeconds,
          durationMs: resumedSeconds * 1000,
          subjectId: resumedSubjectId,
          status: "running",
          lastStartTimestamp: nowMs,
          isActive: true,
        };

        sessions = sessions.map((session, index) => (index === refreshedIndex ? resumed : session));

        const resumedMode = resumed.mode;
        const resumedPhase = resumedMode === "pomodoro" ? "focus" : previous.timer.phase;

        didContinue = true;
        return {
          ...previous,
          sessions,
          timer: {
            ...previous.timer,
            mode: resumedMode,
            phase: resumedPhase,
            isRunning: true,
            startedAtMs: nowMs,
            accumulatedMs: resumedSeconds * 1000,
            phaseStartedAtMs: nowMs,
            phaseAccumulatedMs: resumedMode === "pomodoro" ? resumedSeconds * 1000 : previous.timer.phaseAccumulatedMs,
            subjectId: resumed.subjectId,
            taskId: resumed.taskId,
          },
        };
      });

      return didContinue;
    },
    [patchData],
  );

  const continueSessionWithTask = useCallback(
    (sessionId: string, taskId: string): boolean => {
      const normalizedTaskId = taskId.trim();
      if (!normalizedTaskId) {
        return false;
      }

      let didContinue = false;

      patchData((previous) => {
        const targetTask = previous.tasks.find((task) => task.id === normalizedTaskId);
        if (!targetTask || targetTask.completed || !canUseTimer(targetTask)) {
          return previous;
        }

        const activeIndex = previous.sessions.findIndex(
          (session) => session.isActive === true && (session.status === "running" || session.status === "paused"),
        );

        if (activeIndex >= 0) {
          const activeSession = previous.sessions[activeIndex];
          if (!activeSession) {
            return previous;
          }

          const nowMs = Date.now();
          const isRunning = activeSession.status === "running";
          const elapsedSeconds = isRunning
            ? resolveRunningSessionElapsedSeconds(activeSession, nowMs)
            : resolveSessionSeconds(activeSession);
          const allocationState = sessionAllocationState(activeSession, nowMs, activeSession.taskId ?? normalizedTaskId);
          const taskIds = dedupeSessionTaskIds(activeSession, normalizedTaskId);
          const taskAllocations = rebalanceSessionTaskAllocations(
            allocationState.taskAllocations,
            taskIds,
            elapsedSeconds,
            normalizedTaskId,
          );
          const startTime =
            typeof activeSession.startTime === "number" && Number.isFinite(activeSession.startTime)
              ? activeSession.startTime
              : nowMs - elapsedSeconds * 1000;
          const runningStartMs = isRunning
            ? (typeof activeSession.lastStartTimestamp === "number" && Number.isFinite(activeSession.lastStartTimestamp)
                ? activeSession.lastStartTimestamp
                : nowMs)
            : null;

          const updatedActive: StudySession = {
            ...activeSession,
            sessionId: activeSession.sessionId ?? activeSession.id,
            tabId: activeSession.tabId ?? TAB_ID,
            taskId: normalizedTaskId,
            taskIds,
            taskAllocations,
            activeTaskId: normalizedTaskId,
            activeTaskStartedAt: isRunning ? nowMs : null,
            subjectId: targetTask.subjectId ?? activeSession.subjectId,
            startTime,
            startedAt: new Date(startTime).toISOString(),
            endedAt: new Date(startTime + elapsedSeconds * 1000).toISOString(),
            durationSeconds: elapsedSeconds,
            accumulatedTime: elapsedSeconds,
            durationMs: elapsedSeconds * 1000,
            status: isRunning ? "running" : "paused",
            lastStartTimestamp: runningStartMs,
            isActive: true,
          };

          didContinue = true;
          return {
            ...previous,
            sessions: previous.sessions.map((session, index) => (index === activeIndex ? updatedActive : session)),
            timer: {
              ...previous.timer,
              mode: updatedActive.mode,
              phase: updatedActive.mode === "pomodoro" ? "focus" : previous.timer.phase,
              isRunning,
              startedAtMs: runningStartMs,
              accumulatedMs: elapsedSeconds * 1000,
              phaseStartedAtMs: runningStartMs,
              phaseAccumulatedMs: updatedActive.mode === "pomodoro" ? elapsedSeconds * 1000 : previous.timer.phaseAccumulatedMs,
              subjectId: updatedActive.subjectId,
              taskId: updatedActive.taskId,
            },
          };
        }

        const targetIndex = previous.sessions.findIndex((session) => session.id === sessionId);
        if (targetIndex < 0) {
          return previous;
        }

        const target = previous.sessions[targetIndex];
        if (!target || target.status === "running" || target.isActive === true) {
          return previous;
        }

        const nowMs = Date.now();
        let sessions = previous.sessions;

        const otherActiveSession = sessions.find((session) => session.isActive === true);
        if (otherActiveSession && otherActiveSession.id !== target.id) {
          const activeElapsedMs =
            otherActiveSession.status === "running"
              ? resolveRunningSessionElapsedSeconds(otherActiveSession, nowMs) * 1000
              : resolveSessionSeconds(otherActiveSession) * 1000;

          const finalizedActive = finalizeTaskSession(
            sessions,
            otherActiveSession.taskId,
            otherActiveSession.subjectId,
            otherActiveSession.mode,
            otherActiveSession.phase,
            activeElapsedMs,
            nowMs,
          );
          sessions = finalizedActive.sessions;
        }

        const refreshedIndex = sessions.findIndex((session) => session.id === sessionId);
        if (refreshedIndex < 0) {
          return previous;
        }

        const refreshedTarget = sessions[refreshedIndex];
        if (!refreshedTarget || refreshedTarget.status === "running" || refreshedTarget.isActive === true) {
          return previous;
        }

        const resumedSeconds = resolveSessionSeconds(refreshedTarget);

        const taskIds = dedupeSessionTaskIds(refreshedTarget, normalizedTaskId);
        const taskAllocations = rebalanceSessionTaskAllocations(
          resolveSessionTaskAllocations(refreshedTarget, resumedSeconds),
          taskIds,
          resumedSeconds,
          normalizedTaskId,
        );

        const startTime =
          typeof refreshedTarget.startTime === "number" && Number.isFinite(refreshedTarget.startTime)
            ? refreshedTarget.startTime
            : nowMs - resumedSeconds * 1000;

        const resumed: StudySession = {
          ...refreshedTarget,
          sessionId: refreshedTarget.sessionId ?? refreshedTarget.id,
          tabId: refreshedTarget.tabId ?? TAB_ID,
          taskId: normalizedTaskId,
          taskIds,
          taskAllocations,
          activeTaskId: normalizedTaskId,
          activeTaskStartedAt: nowMs,
          startTime,
          startedAt: new Date(startTime).toISOString(),
          endTime: null,
          endedAt: new Date(startTime + resumedSeconds * 1000).toISOString(),
          durationSeconds: resumedSeconds,
          accumulatedTime: resumedSeconds,
          durationMs: resumedSeconds * 1000,
          subjectId: targetTask.subjectId ?? refreshedTarget.subjectId,
          status: "running",
          lastStartTimestamp: nowMs,
          isActive: true,
        };

        sessions = sessions.map((session, index) => (index === refreshedIndex ? resumed : session));

        const resumedMode = resumed.mode;
        const resumedPhase = resumedMode === "pomodoro" ? "focus" : previous.timer.phase;

        didContinue = true;
        return {
          ...previous,
          sessions,
          timer: {
            ...previous.timer,
            mode: resumedMode,
            phase: resumedPhase,
            isRunning: true,
            startedAtMs: nowMs,
            accumulatedMs: resumedSeconds * 1000,
            phaseStartedAtMs: nowMs,
            phaseAccumulatedMs: resumedMode === "pomodoro" ? resumedSeconds * 1000 : previous.timer.phaseAccumulatedMs,
            subjectId: resumed.subjectId,
            taskId: resumed.taskId,
          },
        };
      });

      return didContinue;
    },
    [patchData],
  );
  const deleteSession = useCallback(
    (sessionId: string) => {
      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.filter((session) => session.id !== sessionId),
      }));
      setPendingReflection((previous) => (previous?.sessionId === sessionId ? null : previous));
    },
    [patchData],
  );

  const addWorkoutSession = useCallback(
    (input: NewWorkoutSessionInput) => {
      const durationMs = Math.max(0, Math.round(input.durationMs));
      if (durationMs <= 0) {
        return;
      }

      patchData((previous) => {
        const endedAt =
          toIsoDateTime(input.endedAt) ?? new Date().toISOString();
        const startedAt =
          toIsoDateTime(input.startedAt) ?? new Date(Date.parse(endedAt) - durationMs).toISOString();
        const date = toIsoDate(input.date) ?? endedAt.slice(0, 10);

        const exercises = input.exercises
          .map((exercise) => {
            const name = exercise.name.trim();
            if (!name) {
              return null;
            }

            const muscles = exercise.muscles
              .map((muscle) => muscle.trim())
              .filter((muscle) => muscle.length > 0);

            return {
              name,
              muscles,
            } satisfies WorkoutExercise;
          })
          .filter((exercise): exercise is WorkoutExercise => exercise !== null);

        const session: WorkoutSession = {
          id: createId(),
          date,
          durationMs,
          startedAt,
          endedAt,
          exercises,
          createdAt: endedAt,
        };

        return {
          ...previous,
          workout: {
            ...previous.workout,
            enabled: true,
            sessions: [...previous.workout.sessions, session],
            markedDays: sortUniqueIsoDates([...previous.workout.markedDays, date]),
          },
        };
      });
    },
    [patchData],
  );

  const deleteWorkoutSession = useCallback(
    (sessionId: string) => {
      patchData((previous) => ({
        ...previous,
        workout: {
          ...previous.workout,
          sessions: previous.workout.sessions.filter((session) => session.id !== sessionId),
        },
      }));
    },
    [patchData],
  );

  const toggleWorkoutMarkedDay = useCallback(
    (dateIso: string) => {
      const normalized = toIsoDate(dateIso);
      if (!normalized) {
        return;
      }

      patchData((previous) => {
        const exists = previous.workout.markedDays.includes(normalized);
        const markedDays = exists
          ? previous.workout.markedDays.filter((day) => day !== normalized)
          : [...previous.workout.markedDays, normalized];

        return {
          ...previous,
          workout: {
            ...previous.workout,
            markedDays: sortUniqueIsoDates(markedDays),
          },
        };
      });
    },
    [patchData],
  );

  const updateWorkoutGoals = useCallback(
    (updater: (previous: GoalSettings) => GoalSettings) => {
      patchData((previous) => ({
        ...previous,
        workout: {
          ...previous.workout,
          goals: ensureGoalSettingsShape(updater(previous.workout.goals), previous.workout.goals),
        },
      }));
    },
    [patchData],
  );

  const tasksForSubject = useCallback(
    (subjectId: string): Task[] => {
      if (!data) {
        return [];
      }

    return data.tasks
      .filter(
        (task) =>
          task.subjectId === subjectId &&
          normalizeTaskLifecycleStatus(task) !== "archived",
      )
      .sort((a, b) => a.order - b.order);
    },
    [data],
  );

  const restoreProfileDataSnapshot = useCallback(
    (snapshot: UserData): boolean => {
      if (!activeProfile) {
        return false;
      }

      const restoreResult = profileDataStorage.trySetValue(normalizeProfileData(snapshot, activeProfile.id));
      return restoreResult.ok;
    },
    [activeProfile, normalizeProfileData, profileDataStorage],
  );

  const moveSubjectTask = useCallback(
    (
      taskId: string,
      destination: SubjectTaskMoveDestination,
      options?: SubjectTaskMoveOptions,
    ): SubjectTaskMoveResult => {
      if (!activeProfile || !data) {
        return {
          ok: false,
          error: "No active profile selected.",
        };
      }

      const normalizedTaskId = taskId.trim();
      if (!normalizedTaskId) {
        return {
          ok: false,
          error: "Task id is required.",
        };
      }

      const dailyTitleKeys = new Set(
        (options?.existingDailyTitleKeys ?? [])
          .map((title) => normalizeTaskTitleKey(title))
          .filter((title) => title.length > 0),
      );

      const dailyScheduledFor = options?.scheduledFor && isIsoDate(options.scheduledFor)
        ? options.scheduledFor
        : todayIsoDate();

      let validationError: string | undefined;
      let timerStopped = false;
      let dailyTaskDraft: SubjectTaskDailyDraft | undefined;

      const writeResult = tryPatchData((previous) => {
        const sourceTask = previous.tasks.find((task) => task.id === normalizedTaskId) ?? null;
        if (!sourceTask) {
          validationError = "Task not found.";
          return previous;
        }

        if (sourceTask.category !== "subject") {
          validationError = "Only subject tasks can be moved from this view.";
          return previous;
        }

        if (destination === "daily") {
          const sourceTitleKey = normalizeTaskTitleKey(sourceTask.title);
          if (sourceTitleKey.length > 0 && dailyTitleKeys.has(sourceTitleKey)) {
            validationError = `Task already exists in ${destinationLabel(destination)}.`;
            return previous;
          }
        } else {
          const targetType = destinationType(destination);
          const targetCategory = destinationCategory(destination);
          const sourceTitleKey = normalizeTaskTitleKey(sourceTask.title);

          const duplicate = previous.tasks.some((task) =>
            task.id !== sourceTask.id &&
            task.type === targetType &&
            task.category === targetCategory &&
            task.subjectId === sourceTask.subjectId &&
            normalizeTaskTitleKey(task.title) === sourceTitleKey,
          );

          if (duplicate) {
            validationError = `Task already exists in ${destinationLabel(destination)}.`;
            return previous;
          }
        }

        let nextSessions = previous.sessions;
        let nextTimer = previous.timer;

        if (previous.timer.taskId === sourceTask.id) {
          const nowMs = Date.now();
          const elapsedMs = timerElapsedMs(previous.timer, nowMs);

          if (previous.timer.isRunning || elapsedMs > 0) {
            const finalized = finalizeTaskSession(
              previous.sessions,
              previous.timer.taskId,
              previous.timer.subjectId,
              previous.timer.mode,
              previous.timer.mode === "pomodoro" ? "focus" : "manual",
              elapsedMs,
              nowMs,
            );
            nextSessions = finalized.sessions;
          }

          nextTimer = {
            ...DEFAULT_TIMER_SNAPSHOT,
            mode: previous.timer.mode,
            subjectId: previous.timer.subjectId,
            taskId: null,
          };
          timerStopped = true;
        }

        if (destination === "daily") {
          dailyTaskDraft = {
            title: sourceTask.title,
            priority: sourceTask.priority,
            scheduledFor: dailyScheduledFor,
          };

          return {
            ...previous,
            timer: nextTimer,
            sessions: detachTaskFromSessions(nextSessions, sourceTask.id),
            tasks: previous.tasks.filter((task) => task.id !== sourceTask.id),
          };
        }

        const todayIso = todayIsoDate();
        const targetType = destinationType(destination);
        const targetCategory = destinationCategory(destination);
        const dueDate = resolveDueDateForDestination(sourceTask.dueDate ?? sourceTask.scheduledFor, destination, todayIso);
        const deadline = Date.parse(`${dueDate}T23:59:59`);
        const nowIso = new Date().toISOString();

        return {
          ...previous,
          timer: nextTimer,
          sessions: nextSessions,
          tasks: previous.tasks.map((task) =>
            task.id === sourceTask.id
              ? {
                  ...task,
                  type: targetType,
                  category: targetCategory,
                  scheduledFor: dueDate,
                  dueDate,
                  deadline: Number.isFinite(deadline) ? deadline : null,
                  timeSpent:
                    typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
                      ? task.totalTimeSeconds
                      : task.totalTimeSpent,
                  updatedAt: nowIso,
                }
              : task,
          ),
        };
      });

      if (validationError) {
        return {
          ok: false,
          error: validationError,
        };
      }

      if (!writeResult.ok) {
        return {
          ok: false,
          error: "Unable to save task move. Please try again.",
        };
      }

      if (destination === "daily" && !dailyTaskDraft) {
        return {
          ok: false,
          error: "Unable to prepare Daily Task data.",
        };
      }

      return {
        ok: true,
        movedTaskId: normalizedTaskId,
        destination,
        timerStopped,
        dailyTaskDraft,
        rollbackSnapshot: destination === "daily" ? writeResult.previous : undefined,
      };
    },
    [activeProfile, data, normalizeProfileData, tryPatchData],
  );
  const exportCurrentProfileData = useCallback((): string | null => {
    if (!data || !activeProfile) {
      return null;
    }

    return JSON.stringify(
      {
        schemaVersion: APP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        profile: {
          id: activeProfile.id,
          name: activeProfile.name,
        },
        data,
      },
      null,
      2,
    );
  }, [activeProfile, data]);

  const exportLovableProfileData = useCallback((): string | null => {
    if (!data) {
      return null;
    }

    return buildLovableExport(data);
  }, [data]);

  const importCurrentProfileData = useCallback(
    (raw: string): boolean => {
      if (!activeProfile) {
        return false;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) {
          return false;
        }

        let candidate: UserData | null = null;

        if (isRecord(parsed.data)) {
          const parsedData = parsed.data as Record<string, unknown>;
          const modernCandidate = {
            ...parsedData,
            profileId: activeProfile.id,
            version: APP_SCHEMA_VERSION,
            settings: ensureSettingsShape(parsedData.settings),
            workout: ensureWorkoutShape(parsedData.workout),
            parentViewer: ensureParentViewerShape(parsedData.parentViewer),
            vacationMode: ensureVacationModeShape(parsedData.vacationMode),
            timer: ensureTimerShape(parsedData.timer),
          };

          if (isUserData(modernCandidate)) {
            candidate = modernCandidate;
          }
        }

        if (!candidate) {
          candidate = toLegacyUserData(parsed, activeProfile.id);
        }

        if (!candidate) {
          return false;
        }

        const normalizedCollections = normalizeStudyCollections(
          candidate.tasks,
          candidate.sessions,
          candidate.categories,
          candidate.activeCategoryId,
          Date.now(),
        );

        profileDataStorage.setValue({
          ...candidate,
          profileId: activeProfile.id,
          version: APP_SCHEMA_VERSION,
          categories: normalizedCollections.categories,
          activeCategoryId: normalizedCollections.activeCategoryId,
          tasks: normalizedCollections.tasks,
          sessions: normalizedCollections.sessions,
          updatedAt: new Date().toISOString(),
          settings: ensureSettingsShape(candidate.settings),
          timer: ensureTimerShape(candidate.timer),
          workout: ensureWorkoutShape(candidate.workout),
          parentViewer: ensureParentViewerShape(candidate.parentViewer),
          vacationMode: ensureVacationModeShape(candidate.vacationMode),
        });
        setPendingReflection(null);
        return true;
      } catch {
        return false;
      }
    },
    [activeProfile, profileDataStorage],
  );

  const resetCurrentProfileData = useCallback(() => {
    if (!activeProfile) {
      return;
    }

    profileDataStorage.setValue(EMPTY_USER_DATA(activeProfile.id, new Date().toISOString()));
    clearParentViewerSession();
    setViewerSession(null);
    setPendingReflection(null);
  }, [activeProfile, profileDataStorage]);

  const analytics = useMemo(() => (data ? computeAnalytics(data) : defaultAnalytics), [data]);

  const contextValue = useMemo<AppStoreContextValue>(
    () => ({
      isReady: true,
      profiles: profilesStorage.value.profiles,
      activeProfile,
      data,
      role,
      isViewerMode,
      analytics,
      parentViewer: data ? ensureParentViewerShape(data.parentViewer) : null,
      pendingReflection,
      createProfile,
      renameProfile,
      switchProfile,
      deleteProfile,
      addSubject,
      updateSubject,
      deleteSubject,
      addTaskCategory,
      renameTaskCategory,
      deleteTaskCategory,
      reorderTaskCategory,
      setActiveTaskCategory,
      addSubjectTask,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      reorderTask,
      bulkDeleteTasks,
      bulkMoveTasks,
      bulkCompleteTasks,
      bulkSetTaskLifecycleStatus,
      runTaskBacklogAutomation,
      updateSettings,
      setVacationMode,
      setTheme,
      generateParentAccessCode,
      refreshParentAccessCode,
      verifyParentAccessCode,
      exitViewerMode,
      logViewerWriteViolation,
      setTimerMode,
      selectTimerSubject,
      selectTimerTask,
      addTaskToActiveSession,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      stopTimer,
      completePomodoroPhaseIfDue,
      dismissPendingReflection,
      saveSessionReflection,
      updateSessionDuration,
      continueSession,
      continueSessionWithTask,
      deleteSession,
      addWorkoutSession,
      deleteWorkoutSession,
      toggleWorkoutMarkedDay,
      updateWorkoutGoals,
      tasksForSubject,
      moveSubjectTask,
      restoreProfileDataSnapshot,
      exportCurrentProfileData,
      exportLovableProfileData,
      importCurrentProfileData,
      resetCurrentProfileData,
    }),
    [
      activeProfile,
      addSubject,
      addSubjectTask,
      addTask,
      addTaskCategory,
      addTaskToActiveSession,
      addWorkoutSession,
      analytics,
      role,
      isViewerMode,
      bulkCompleteTasks,
      bulkDeleteTasks,
      bulkMoveTasks,
      bulkSetTaskLifecycleStatus,
      completePomodoroPhaseIfDue,
      createProfile,
      data,
      deleteProfile,
      continueSession,
      continueSessionWithTask,
      deleteSession,
      deleteSubject,
      deleteTask,
      deleteTaskCategory,
      deleteWorkoutSession,
      dismissPendingReflection,
      exportCurrentProfileData,
      exportLovableProfileData,
      importCurrentProfileData,
      pauseTimer,
      pendingReflection,
      profilesStorage.value.profiles,
      renameProfile,
      renameTaskCategory,
      reorderTaskCategory,
      reorderTask,
      resetCurrentProfileData,
      runTaskBacklogAutomation,
      setVacationMode,
      generateParentAccessCode,
      refreshParentAccessCode,
      verifyParentAccessCode,
      exitViewerMode,
      logViewerWriteViolation,
      resetTimer,
      resumeTimer,
      saveSessionReflection,
      selectTimerSubject,
      selectTimerTask,
      setActiveTaskCategory,
      setTheme,
      setTimerMode,
      startTimer,
      stopTimer,
      switchProfile,
      tasksForSubject,
      moveSubjectTask,
      restoreProfileDataSnapshot,
      toggleTask,
      toggleWorkoutMarkedDay,
      updateSessionDuration,
      updateSettings,
      updateSubject,
      updateTask,
      updateWorkoutGoals,
    ],
  );

  return <AppStoreContext.Provider value={contextValue}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreContextValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }

  return context;
}

export const getTimerElapsedMs = timerElapsedMs;
export const getTimerPhaseElapsedMs = timerPhaseElapsedMs;
export const getPhaseDurationMs = phaseDurationMs;













































