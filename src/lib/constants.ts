import {
  AppSettings,
  GoalSettings,
  ParentViewerState,
  PomodoroPhase,
  TaskCategory,
  TaskType,
  TimerSnapshot,
  UserData,
  VacationModeState,
  WorkoutData,
} from "@/types/models";

export const APP_SCHEMA_VERSION = 6;
export const PROFILES_SCHEMA_VERSION = 1;

export const DAILY_TASKS_SCHEMA_VERSION = 1;
export const CHECKBOX_SOUND_SCHEMA_VERSION = 1;

export const SHORT_TERM_TASK_DAYS_THRESHOLD = 21;

export const PARENT_OTP_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const PARENT_LOCKOUT_MS = 15 * 60 * 1000;
export const PARENT_FAILED_ATTEMPT_LIMIT = 5;
export const PARENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const PARENT_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const VACATION_MAX_DURATION_DAYS = 7;
export const VACATION_COOLDOWN_DAYS = 3;

export const STORAGE_KEYS = {
  profiles: "study-dashboard:profiles",
  profileData: (profileId: string) => `study-dashboard:data:${profileId}`,
  dailyTasks: (profileId: string) => `study-dashboard:daily-tasks:${profileId}`,
  dailyTaskHistory: (profileId: string) => `study-dashboard:daily-task-history:${profileId}`,
  dailyTaskStats: (profileId: string) => `study-dashboard:daily-task-stats:${profileId}`,
  shortTermTasks: (profileId: string) => `study-dashboard:short-term-tasks:${profileId}`,
  longTermTasks: (profileId: string) => `study-dashboard:long-term-tasks:${profileId}`,
  checkboxSounds: (profileId: string) => `study-dashboard:checkbox-sounds:${profileId}`,
  selectedSound: (profileId: string) => `study-dashboard:selected-sound:${profileId}`,
  parentViewerSession: "study-dashboard:parent-viewer-session",
  parentViewerClientId: "study-dashboard:parent-viewer-client-id",
  parentViewerRateLimit: (profileId: string, clientId: string) => `study-dashboard:parent-rate:${profileId}:${clientId}`,
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

export const SYSTEM_TASK_CATEGORY_IDS = {
  incomplete: "incomplete_system",
  completed: "completed_system",
} as const;

export const isSystemTaskCategoryId = (categoryId: string | null | undefined): boolean =>
  categoryId === SYSTEM_TASK_CATEGORY_IDS.incomplete || categoryId === SYSTEM_TASK_CATEGORY_IDS.completed;

export const DEFAULT_TASK_CATEGORY_NAMES = ["Assignments", "Revision"] as const;

export const createSystemTaskCategories = (createdAt = Date.now()): TaskCategory[] => [
  {
    id: SYSTEM_TASK_CATEGORY_IDS.incomplete,
    name: "Incomplete",
    createdAt,
  },
  {
    id: SYSTEM_TASK_CATEGORY_IDS.completed,
    name: "Completed",
    createdAt,
  },
];

export const createDefaultTaskCategories = (createdAt = Date.now()): TaskCategory[] => [
  ...createSystemTaskCategories(createdAt),
  ...DEFAULT_TASK_CATEGORY_NAMES.map((name, index) => ({
    id: `category-${index + 1}`,
    name,
    createdAt,
  })),
];

export const customTaskCategories = (categories: TaskCategory[] | undefined): TaskCategory[] =>
  (categories ?? []).filter((category) => !isSystemTaskCategoryId(category.id));

export const firstCustomTaskCategoryId = (categories: TaskCategory[] | undefined): string | null =>
  customTaskCategories(categories)[0]?.id ?? null;

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

export const DEFAULT_PARENT_VIEWER: ParentViewerState = {
  otpHash: null,
  otpCreatedAt: null,
  otpExpiresAt: null,
  lastAccessAt: null,
  failedAttempts: 0,
  lockedUntil: null,
  auditLog: [],
};

export const DEFAULT_VACATION_MODE: VacationModeState = {
  enabled: false,
  startedAt: null,
  expiresAt: null,
  cooldownUntil: null,
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

export const EMPTY_USER_DATA = (profileId: string, nowIso: string): UserData => {
  const categories = createDefaultTaskCategories(Date.now());

  return {
    version: APP_SCHEMA_VERSION,
    profileId,
    subjects: [],
    categories,
    activeCategoryId: SYSTEM_TASK_CATEGORY_IDS.incomplete,
    tasks: [],
    sessions: [],
    workout: {
      ...DEFAULT_WORKOUT_DATA,
      markedDays: [],
      sessions: [],
      goals: { ...DEFAULT_WORKOUT_GOALS },
    },
    parentViewer: {
      ...DEFAULT_PARENT_VIEWER,
      auditLog: [],
    },
    vacationMode: {
      ...DEFAULT_VACATION_MODE,
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
  };
};

export const DEFAULT_TIMED_TASK_TYPE = TaskType.SHORT_TERM;
