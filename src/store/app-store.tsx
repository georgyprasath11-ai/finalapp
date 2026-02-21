import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { computeAnalytics } from "@/lib/analytics";
import { buildLovableExport } from "@/lib/lovable-export";
import {
  APP_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  DEFAULT_STUDY_GOALS,
  DEFAULT_WORKOUT_GOALS,
  DEFAULT_WORKOUT_DATA,
  DEFAULT_TIMER_SNAPSHOT,
  EMPTY_USER_DATA,
  createDefaultTaskCategories,
  PROFILES_SCHEMA_VERSION,
  STORAGE_KEYS,
} from "@/lib/constants";
import { browserStorageAdapter } from "@/lib/storage";
import {
  AppAnalytics,
  AppSettings,
  GoalSettings,
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
  TimerMode,
  TimerSnapshot,
  UserData,
  UserProfile,
  WorkoutData,
  WorkoutExercise,
  WorkoutSession,
} from "@/types/models";
import { LocalStorageMigrationMap } from "@/types/storage";
import { buildActiveSession, clampSessionSeconds, MAX_SESSION_SECONDS, normalizeStudyCollections, resolveBrowserTabId } from "@/lib/study-intelligence";
import { todayIsoDate } from "@/utils/date";
import { createId } from "@/utils/id";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

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
      version: APP_SCHEMA_VERSION,
      categories: normalizedCollections.categories,
      activeCategoryId: normalizedCollections.activeCategoryId,
      tasks: normalizedCollections.tasks,
      sessions: normalizedCollections.sessions,
      workout: ensureWorkoutShape(legacy.workout),
      settings: ensureSettingsShape(legacy.settings),
      timer: ensureTimerShape(legacy.timer),
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

  const normalized = value.toLowerCase();
  if (normalized === "great" || normalized === "good" || normalized === "okay" || normalized === "distracted") {
    return normalized;
  }

  if (normalized === "productive") {
    return "great";
  }

  if (normalized === "average" || normalized === "ok") {
    return "okay";
  }

  return null;
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
    const order = bucket === "daily" ? ++dailyOrder : ++backlogOrder;

    tasks.push({
      id,
      title,
      description: descriptionParts.join("\n\n"),
      subjectId: upsertSubject(asTrimmedString(item.subject)),
      bucket,
      priority,
      estimatedMinutes: plannedMinutes !== null ? Math.max(0, Math.round(plannedMinutes)) : null,
      dueDate,
      completed,
      completedAt,
      order,
      rollovers: originalDate && dueDate ? dayDifference(originalDate, dueDate) : 0,
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

    sessions.push({
      id,
      subjectId: upsertSubject(asTrimmedString(item.subject)),
      taskId: asTrimmedString(item.taskId),
      startedAt,
      endedAt,
      durationMs,
      mode: "stopwatch",
      phase: "manual",
      rating: mapLegacySessionRating(asTrimmedString(item.rating)),
      reflection: asTrimmedString(item.note) ?? "",
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

interface FinalizeSessionResult {
  sessions: StudySession[];
  finalized: StudySession | null;
}

const resolveTimerSessionPhase = (mode: TimerMode, phase: "focus" | "manual"): "focus" | "manual" =>
  mode === "pomodoro" ? "focus" : phase;

const TAB_ID = resolveBrowserTabId();

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
  const activeIndex = sessions.findIndex((session) => session.isActive === true && session.taskId === taskId);

  if (activeIndex >= 0) {
    const current = sessions[activeIndex];
    if (!current) {
      return sessions;
    }

    const startTime =
      typeof current.startTime === "number" && Number.isFinite(current.startTime)
        ? current.startTime
        : nowMs - elapsedSeconds * 1000;

    const updated: StudySession = {
      ...current,
      sessionId: current.sessionId ?? current.id,
      tabId: current.tabId ?? TAB_ID,
      taskId,
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
  const activeIndex = sessions.findIndex((session) => session.isActive === true && session.taskId === taskId);

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

  const startTime =
    typeof current.startTime === "number" && Number.isFinite(current.startTime)
      ? current.startTime
      : nowMs - elapsedSeconds * 1000;

  const paused: StudySession = {
    ...current,
    sessionId: current.sessionId ?? current.id,
    tabId: current.tabId ?? TAB_ID,
    taskId,
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
  if (!taskId) {
    return { sessions, finalized: null };
  }

  const sessionPhase = resolveTimerSessionPhase(mode, phase);
  const activeIndex = sessions.findIndex((session) => session.isActive === true && session.taskId === taskId);
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

    const startTime =
      typeof existing.startTime === "number" && Number.isFinite(existing.startTime)
        ? existing.startTime
        : nowMs - durationSeconds * 1000;

    const finalized: StudySession = {
      ...existing,
      sessionId: existing.sessionId ?? existing.id,
      tabId: existing.tabId ?? TAB_ID,
      taskId,
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

  const startTime = nowMs - durationSeconds * 1000;
  const id = createId();
  const finalized: StudySession = {
    id,
    sessionId: id,
    subjectId,
    taskId,
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

interface UpdateTaskInput {
  title?: string;
  description?: string;
  subjectId?: string | null;
  priority?: TaskPriority;
  categoryId?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
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
  analytics: AppAnalytics;
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
  deleteTaskCategory: (categoryId: string) => void;
  setActiveTaskCategory: (categoryId: string) => void;
  addTask: (input: NewTaskInput) => void;
  updateTask: (taskId: string, input: UpdateTaskInput) => void;
  deleteTask: (taskId: string) => void;
  toggleTask: (taskId: string, completed: boolean) => void;
  reorderTask: (sourceTaskId: string, targetTaskId: string) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  bulkMoveTasks: (taskIds: string[], bucket: TaskBucket) => void;
  bulkCompleteTasks: (taskIds: string[], completed: boolean) => void;
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  setTheme: (mode: AppSettings["theme"]) => void;
  setTimerMode: (mode: TimerMode) => void;
  selectTimerSubject: (subjectId: string | null) => void;
  selectTimerTask: (taskId: string | null) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: (force?: boolean) => boolean;
  stopTimer: () => void;
  completePomodoroPhaseIfDue: () => void;
  dismissPendingReflection: () => void;
  saveSessionReflection: (sessionId: string, rating: SessionRating | null, reflection: string) => void;
  updateSessionDuration: (sessionId: string, durationSeconds: number) => boolean;
  deleteSession: (sessionId: string) => void;
  addWorkoutSession: (input: NewWorkoutSessionInput) => void;
  deleteWorkoutSession: (sessionId: string) => void;
  toggleWorkoutMarkedDay: (dateIso: string) => void;
  updateWorkoutGoals: (updater: (previous: GoalSettings) => GoalSettings) => void;
  tasksForSubject: (subjectId: string) => Task[];
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

  const patchData = useCallback(
    (updater: (previous: UserData) => UserData) => {
      if (!activeProfile) {
        return;
      }

      profileDataStorage.setValue((previous) => {
        const next = updater(previous);
        const normalizedCollections = normalizeStudyCollections(
          next.tasks,
          next.sessions,
          next.categories,
          next.activeCategoryId,
          Date.now(),
        );

        return {
          ...next,
          categories: normalizedCollections.categories,
          activeCategoryId: normalizedCollections.activeCategoryId,
          tasks: normalizedCollections.tasks,
          sessions: normalizedCollections.sessions,
          version: APP_SCHEMA_VERSION,
          profileId: activeProfile.id,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [activeProfile, profileDataStorage],
  );

  useEffect(() => {
    if (!data || !activeProfile) {
      return;
    }

    const needsNormalization =
      !Array.isArray(data.categories) ||
      data.categories.length === 0 ||
      data.activeCategoryId === undefined ||
      data.tasks.some(
        (task) =>
          task.categoryId === undefined ||
          task.totalTimeSeconds === undefined ||
          task.sessionCount === undefined ||
          task.isBacklog === undefined,
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
    if (!data || !activeProfile || !data.timer.taskId) {
      return;
    }

    const elapsed = timerElapsedMs(data.timer);
    const expectedStatus: "running" | "paused" | null =
      data.timer.isRunning ? "running" : elapsed > 0 ? "paused" : null;

    if (!expectedStatus) {
      return;
    }

    const activeSession = data.sessions.find(
      (session) => session.isActive === true && session.taskId === data.timer.taskId,
    );

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

  const deleteTaskCategory = useCallback(
    (categoryId: string) => {
      patchData((previous) => {
        const existing = previous.categories ?? createDefaultTaskCategories(Date.now());
        if (existing.length <= 1) {
          return previous;
        }

        const remaining = existing.filter((category) => category.id !== categoryId);
        const fallbackCategoryId = remaining[0]?.id ?? existing[0]?.id ?? null;

        return {
          ...previous,
          categories: remaining,
          activeCategoryId:
            previous.activeCategoryId === categoryId ? fallbackCategoryId : (previous.activeCategoryId ?? fallbackCategoryId),
          tasks: previous.tasks.map((task) =>
            task.categoryId === categoryId
              ? {
                  ...task,
                  categoryId: fallbackCategoryId ?? task.categoryId,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        };
      });
    },
    [patchData],
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

  const addTask = useCallback(
    (input: NewTaskInput) => {
      const trimmed = input.title.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => {
        const now = new Date().toISOString();
        const categories = previous.categories ?? createDefaultTaskCategories(Date.now());
        const activeCategoryId = previous.activeCategoryId ?? categories[0]?.id ?? null;

        const selectedCategoryId =
          input.categoryId && categories.some((category) => category.id === input.categoryId)
            ? input.categoryId
            : activeCategoryId;

        const dueDate = input.dueDate ?? todayIsoDate();
        const deadline = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null;

        const sameBucket = previous.tasks.filter((task) => (task.isBacklog === true ? "backlog" : "daily") === "daily");
        const maxOrder = sameBucket.reduce((max, task) => Math.max(max, task.order), 0);

        const task: Task = {
          id: createId(),
          title: trimmed,
          description: input.description?.trim() ?? "",
          subjectId: input.subjectId ?? null,
          bucket: "daily",
          priority: input.priority,
          estimatedMinutes: input.estimatedMinutes ?? null,
          dueDate,
          deadline: Number.isFinite(deadline) ? deadline : null,
          categoryId: selectedCategoryId ?? categories[0]?.id,
          completed: false,
          completedAt: null,
          isBacklog: false,
          backlogSince: null,
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
          activeCategoryId: activeCategoryId ?? task.categoryId ?? null,
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

            const dueDate = input.dueDate === undefined ? task.dueDate : input.dueDate;
            const deadline = dueDate ? Date.parse(`${dueDate}T23:59:59`) : null;
            const categoryId =
              input.categoryId === undefined
                ? task.categoryId
                : categories.some((category) => category.id === input.categoryId)
                  ? input.categoryId
                  : (task.categoryId ?? previous.activeCategoryId ?? categories[0]?.id);

            return {
              ...task,
              title: input.title?.trim() ?? task.title,
              description: input.description?.trim() ?? task.description,
              subjectId: input.subjectId === undefined ? task.subjectId : input.subjectId,
              priority: input.priority ?? task.priority,
              categoryId,
              estimatedMinutes:
                input.estimatedMinutes === undefined ? task.estimatedMinutes : input.estimatedMinutes,
              dueDate,
              deadline: Number.isFinite(deadline) ? deadline : null,
              updatedAt: new Date().toISOString(),
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
            ? {
                ...task,
                completed,
                completedAt: completed ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      }));
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
              isBacklog: false,
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
            ? {
                ...task,
                completed,
                completedAt: completed ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      }));
    },
    [patchData],
  );

  const updateSettings = useCallback(
    (updater: (previous: AppSettings) => AppSettings) => {
      patchData((previous) => ({
        ...previous,
        settings: ensureSettingsShape(updater(previous.settings)),
      }));
    },
    [patchData],
  );

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
        sessions: previous.sessions.filter(
          (session) => !(session.isActive === true && session.taskId === previous.timer.taskId),
        ),
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
          session.isActive === true && session.taskId === previous.timer.taskId
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
        const changingTask = previous.timer.taskId !== taskId;
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

        if (taskId && timer.isRunning) {
          sessions = upsertActiveTaskSession(
            sessions,
            taskId,
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
            taskId,
          },
        };
      });
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
        sessions: previous.sessions.filter(
          (session) => !(session.isActive === true && session.taskId === previous.timer.taskId),
        ),
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
          reflection = {
            sessionId: finalized.finalized.id,
            subjectId: finalized.finalized.subjectId,
            durationMs: finalized.finalized.durationMs,
          };
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
        if (finalized.finalized) {
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
      completePomodoroPhaseIfDue();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completePomodoroPhaseIfDue]);

  const dismissPendingReflection = useCallback(() => {
    setPendingReflection(null);
  }, []);

  const saveSessionReflection = useCallback(
    (sessionId: string, rating: SessionRating | null, reflection: string) => {
      patchData((previous) => ({
        ...previous,
        sessions: previous.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                rating,
                reflection: reflection.trim(),
              }
            : session,
        ),
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

        didUpdate = true;
        const endTime = target.endTime ?? Date.parse(target.endedAt);
        const resolvedEndTime = Number.isFinite(endTime) ? endTime : Date.now();
        const resolvedStartTime = resolvedEndTime - normalizedDuration * 1000;

        const updated: StudySession = {
          ...target,
          sessionId: target.sessionId ?? target.id,
          tabId: target.tabId ?? TAB_ID,
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
        .filter((task) => task.subjectId === subjectId)
        .sort((a, b) => a.order - b.order);
    },
    [data],
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
    setPendingReflection(null);
  }, [activeProfile, profileDataStorage]);

  const analytics = useMemo(() => (data ? computeAnalytics(data) : defaultAnalytics), [data]);

    const contextValue = useMemo<AppStoreContextValue>(
    () => ({
      isReady: true,
      profiles: profilesStorage.value.profiles,
      activeProfile,
      data,
      analytics,
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
      setActiveTaskCategory,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      reorderTask,
      bulkDeleteTasks,
      bulkMoveTasks,
      bulkCompleteTasks,
      updateSettings,
      setTheme,
      setTimerMode,
      selectTimerSubject,
      selectTimerTask,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      stopTimer,
      completePomodoroPhaseIfDue,
      dismissPendingReflection,
      saveSessionReflection,
      updateSessionDuration,
      deleteSession,
      addWorkoutSession,
      deleteWorkoutSession,
      toggleWorkoutMarkedDay,
      updateWorkoutGoals,
      tasksForSubject,
      exportCurrentProfileData,
      exportLovableProfileData,
      importCurrentProfileData,
      resetCurrentProfileData,
    }),
    [
      activeProfile,
      addSubject,
      addTask,
      addTaskCategory,
      addWorkoutSession,
      analytics,
      bulkCompleteTasks,
      bulkDeleteTasks,
      bulkMoveTasks,
      completePomodoroPhaseIfDue,
      createProfile,
      data,
      deleteProfile,
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
      reorderTask,
      resetCurrentProfileData,
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
