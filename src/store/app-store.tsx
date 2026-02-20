import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { computeAnalytics } from "@/lib/analytics";
import {
  APP_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  DEFAULT_TIMER_SNAPSHOT,
  EMPTY_USER_DATA,
  PROFILES_SCHEMA_VERSION,
  STORAGE_KEYS,
} from "@/lib/constants";
import { browserStorageAdapter } from "@/lib/storage";
import {
  AppAnalytics,
  AppSettings,
  PendingReflection,
  PomodoroPhase,
  ProfilesState,
  SessionRating,
  StudySession,
  Subject,
  Task,
  TaskBucket,
  TaskPriority,
  TimerMode,
  TimerSnapshot,
  UserData,
  UserProfile,
} from "@/types/models";
import { LocalStorageMigrationMap } from "@/types/storage";
import { todayIsoDate } from "@/utils/date";
import { createId } from "@/utils/id";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
    isRecord(value.settings) &&
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
        settings: {
          goals: { dailyMinutes: 180, weeklyMinutes: 900, monthlyMinutes: 3600 },
          timer: {
            focusMinutes: 25,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
            longBreakInterval: 4,
            autoStartNextPhase: false,
            soundEnabled: false,
            preventAccidentalReset: true,
          },
          theme: "system",
        },
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
      settings: isRecord(legacy.settings)
        ? legacy.settings
        : {
            goals: { dailyMinutes: 180, weeklyMinutes: 900, monthlyMinutes: 3600 },
            timer: {
              focusMinutes: 25,
              shortBreakMinutes: 5,
              longBreakMinutes: 15,
              longBreakInterval: 4,
              autoStartNextPhase: false,
              soundEnabled: false,
              preventAccidentalReset: true,
            },
            theme: "system",
          },
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
      version: APP_SCHEMA_VERSION,
      lastRolloverDate:
        typeof legacy.lastRolloverDate === "string" || legacy.lastRolloverDate === null
          ? legacy.lastRolloverDate
          : null,
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
    "study-sessions" in parsed || "study-tasks" in parsed || "study-subjects" in parsed;

  if (!looksLikeLegacy) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const legacySubjects = parseLegacyField<unknown[]>(parsed["study-subjects"], []);
  const legacyTasks = parseLegacyField<unknown[]>(parsed["study-tasks"], []);
  const legacySessions = parseLegacyField<unknown[]>(parsed["study-sessions"], []);
  const legacyGoals = parseLegacyField<Record<string, unknown>>(parsed["study-goals"], {});
  const legacyTimer = parseLegacyField<Record<string, unknown>>(parsed["study-timer-state"], {});
  const legacySettings = parseLegacyField<Record<string, unknown>>(parsed["app-settings"], {});
  const legacyLastRollover = parseLegacyField<unknown>(parsed["study-last-auto-move"], null);

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

  const weeklyHours = asFiniteNumber(legacyGoals.weeklyHours);
  const monthlyHours = asFiniteNumber(legacyGoals.monthlyHours);
  const weeklyMinutes =
    weeklyHours !== null && weeklyHours > 0
      ? Math.round(weeklyHours * 60)
      : DEFAULT_SETTINGS.goals.weeklyMinutes;
  const monthlyMinutes =
    monthlyHours !== null && monthlyHours > 0
      ? Math.round(monthlyHours * 60)
      : DEFAULT_SETTINGS.goals.monthlyMinutes;
  const dailyMinutes = Math.max(1, Math.round(weeklyMinutes / 7));

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
  ].filter((value) => Number.isFinite(value));

  const createdAt =
    createdCandidates.length > 0 ? new Date(Math.min(...createdCandidates)).toISOString() : nowIso;

  return {
    version: APP_SCHEMA_VERSION,
    profileId,
    subjects,
    tasks,
    sessions,
    settings: {
      ...DEFAULT_SETTINGS,
      goals: {
        dailyMinutes,
        weeklyMinutes,
        monthlyMinutes,
      },
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
  estimatedMinutes?: number | null;
  dueDate?: string | null;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  subjectId?: string | null;
  priority?: TaskPriority;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
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
  deleteSession: (sessionId: string) => void;
  tasksForSubject: (subjectId: string) => Task[];
  exportCurrentProfileData: () => string | null;
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
        return {
          ...next,
          version: APP_SCHEMA_VERSION,
          profileId: activeProfile.id,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [activeProfile, profileDataStorage],
  );

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

      const rolloverTasks = previous.tasks.map((task) => {
        if (task.bucket !== "daily" || task.completed || task.dueDate === null || task.dueDate >= today) {
          return task;
        }

        return {
          ...task,
          dueDate: today,
          rollovers: task.rollovers + 1,
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...previous,
        tasks: rolloverTasks,
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

  const addTask = useCallback(
    (input: NewTaskInput) => {
      const trimmed = input.title.trim();
      if (!trimmed) {
        return;
      }

      patchData((previous) => {
        const now = new Date().toISOString();
        const sameBucket = previous.tasks.filter((task) => task.bucket === input.bucket);
        const maxOrder = sameBucket.reduce((max, task) => Math.max(max, task.order), 0);

        const dueDate =
          input.bucket === "daily"
            ? (input.dueDate ?? todayIsoDate())
            : (input.dueDate ?? null);

        const task: Task = {
          id: createId(),
          title: trimmed,
          description: input.description?.trim() ?? "",
          subjectId: input.subjectId ?? null,
          bucket: input.bucket,
          priority: input.priority,
          estimatedMinutes: input.estimatedMinutes ?? null,
          dueDate,
          completed: false,
          completedAt: null,
          order: maxOrder + 1,
          rollovers: 0,
          createdAt: now,
          updatedAt: now,
        };

        return {
          ...previous,
          tasks: [...previous.tasks, task],
        };
      });
    },
    [patchData],
  );

  const updateTask = useCallback(
    (taskId: string, input: UpdateTaskInput) => {
      patchData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title: input.title?.trim() ?? task.title,
                description: input.description?.trim() ?? task.description,
                subjectId: input.subjectId === undefined ? task.subjectId : input.subjectId,
                priority: input.priority ?? task.priority,
                estimatedMinutes:
                  input.estimatedMinutes === undefined ? task.estimatedMinutes : input.estimatedMinutes,
                dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate,
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      }));
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
      const idSet = new Set(taskIds);
      patchData((previous) => {
        const unaffected = previous.tasks.filter((task) => !idSet.has(task.id));
        let orderBase = unaffected.filter((task) => task.bucket === bucket).reduce((max, task) => Math.max(max, task.order), 0);

        const moved = previous.tasks
          .filter((task) => idSet.has(task.id))
          .map((task) => {
            orderBase += 1;
            return {
              ...task,
              bucket,
              order: orderBase,
              dueDate: bucket === "daily" ? (task.dueDate ?? todayIsoDate()) : task.dueDate,
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
        settings: updater(previous.settings),
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
      patchData((previous) => ({
        ...previous,
        timer: {
          ...previous.timer,
          taskId,
        },
      }));
    },
    [patchData],
  );

  const startTimer = useCallback(() => {
    patchData((previous) => ({
      ...previous,
      timer: {
        ...previous.timer,
        isRunning: true,
        startedAtMs: Date.now(),
        phaseStartedAtMs: Date.now(),
      },
    }));
  }, [patchData]);

  const pauseTimer = useCallback(() => {
    patchData((previous) => {
      if (!previous.timer.isRunning) {
        return previous;
      }

      const nowMs = Date.now();
      return {
        ...previous,
        timer: {
          ...previous.timer,
          isRunning: false,
          startedAtMs: null,
          accumulatedMs: timerElapsedMs(previous.timer, nowMs),
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

      return {
        ...previous,
        timer: {
          ...previous.timer,
          isRunning: true,
          startedAtMs: Date.now(),
          phaseStartedAtMs: Date.now(),
        },
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
      if (elapsed <= 0) {
        return {
          ...previous,
          timer: {
            ...DEFAULT_TIMER_SNAPSHOT,
            mode: previous.timer.mode,
            subjectId: previous.timer.subjectId,
            taskId: previous.timer.taskId,
          },
        };
      }

      const isStudySession = previous.timer.mode === "stopwatch" || previous.timer.phase === "focus";
      let sessions = previous.sessions;

      if (isStudySession) {
        const startedAt = new Date(nowMs - elapsed).toISOString();
        const endedAt = new Date(nowMs).toISOString();
        const session: StudySession = {
          id: createId(),
          subjectId: previous.timer.subjectId,
          taskId: previous.timer.taskId,
          startedAt,
          endedAt,
          durationMs: elapsed,
          mode: previous.timer.mode,
          phase: previous.timer.mode === "pomodoro" ? "focus" : "manual",
          rating: null,
          reflection: "",
          createdAt: endedAt,
        };

        sessions = [...sessions, session];
        reflection = {
          sessionId: session.id,
          subjectId: session.subjectId,
          durationMs: session.durationMs,
        };

        shouldPlaySound = previous.settings.timer.soundEnabled;
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
        const endedAt = new Date(nowMs).toISOString();
        const startedAt = new Date(nowMs - elapsedPhase).toISOString();
        const session: StudySession = {
          id: createId(),
          subjectId: previous.timer.subjectId,
          taskId: previous.timer.taskId,
          startedAt,
          endedAt,
          durationMs: elapsedPhase,
          mode: "pomodoro",
          phase: "focus",
          rating: null,
          reflection: "",
          createdAt: endedAt,
        };

        sessions = [...sessions, session];
        reflection = {
          sessionId: session.id,
          subjectId: session.subjectId,
          durationMs: session.durationMs,
        };
      }

      shouldPlaySound = previous.settings.timer.soundEnabled;

      const autoStart = previous.settings.timer.autoStartNextPhase;

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
          const modernCandidate = {
            ...parsed.data,
            profileId: activeProfile.id,
            version: APP_SCHEMA_VERSION,
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

        profileDataStorage.setValue({
          ...candidate,
          profileId: activeProfile.id,
          version: APP_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          timer: ensureTimerShape(candidate.timer),
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
      deleteSession,
      tasksForSubject,
      exportCurrentProfileData,
      importCurrentProfileData,
      resetCurrentProfileData,
    }),
    [
      activeProfile,
      addSubject,
      addTask,
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
      dismissPendingReflection,
      exportCurrentProfileData,
      importCurrentProfileData,
      pauseTimer,
      pendingReflection,
      profilesStorage.value.profiles,
      renameProfile,
      reorderTask,
      resetCurrentProfileData,
      resetTimer,
      resumeTimer,
      saveSessionReflection,
      selectTimerSubject,
      selectTimerTask,
      setTheme,
      setTimerMode,
      startTimer,
      stopTimer,
      switchProfile,
      tasksForSubject,
      toggleTask,
      updateSettings,
      updateSubject,
      updateTask,
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
