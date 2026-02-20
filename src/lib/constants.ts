import { AppSettings, GoalSettings, PomodoroPhase, TimerSnapshot, UserData, WorkoutData } from "@/types/models";

export const APP_SCHEMA_VERSION = 4;
export const PROFILES_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  profiles: "study-dashboard:profiles",
  profileData: (profileId: string) => `study-dashboard:data:${profileId}`,
} as const;

export const MAX_PRODUCTIVE_MINUTES_PER_DAY = 15 * 60;

export const DEFAULT_STUDY_GOALS: GoalSettings = {
  dailyHours: 3,
  weeklyHours: 15,
  monthlyHours: 60,
};

export const DEFAULT_WORKOUT_GOALS: GoalSettings = {
  dailyHours: 1,
  weeklyHours: 5,
  monthlyHours: 20,
};

export const DEFAULT_SETTINGS: AppSettings = {
  goals: DEFAULT_STUDY_GOALS,
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
};

export const DEFAULT_TIMER_SNAPSHOT: TimerSnapshot = {
  mode: "stopwatch",
  phase: "focus",
  isRunning: false,
  startedAtMs: null,
  accumulatedMs: 0,
  phaseStartedAtMs: null,
  phaseAccumulatedMs: 0,
  cycleCount: 0,
  subjectId: null,
  taskId: null,
};

export const DEFAULT_WORKOUT_DATA: WorkoutData = {
  enabled: false,
  markedDays: [],
  sessions: [],
  goals: DEFAULT_WORKOUT_GOALS,
};

export const PHASE_ORDER: PomodoroPhase[] = ["focus", "shortBreak", "longBreak"];

export const SUBJECT_COLOR_OPTIONS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#7c3aed",
  "#0891b2",
  "#0f766e",
  "#ea580c",
  "#334155",
  "#db2777",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export const EMPTY_USER_DATA = (profileId: string, nowIso: string): UserData => ({
  version: APP_SCHEMA_VERSION,
  profileId,
  subjects: [],
  tasks: [],
  sessions: [],
  workout: {
    ...DEFAULT_WORKOUT_DATA,
    markedDays: [],
    sessions: [],
    goals: { ...DEFAULT_WORKOUT_GOALS },
  },
  settings: {
    ...DEFAULT_SETTINGS,
    goals: { ...DEFAULT_STUDY_GOALS },
    timer: { ...DEFAULT_SETTINGS.timer },
  },
  timer: DEFAULT_TIMER_SNAPSHOT,
  lastRolloverDate: null,
  createdAt: nowIso,
  updatedAt: nowIso,
});
