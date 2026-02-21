export type ThemeMode = "light" | "dark" | "system";

export type TimerMode = "stopwatch" | "pomodoro";

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type TaskBucket = "daily" | "backlog";

export type TaskPriority = "low" | "medium" | "high";

export type SessionRating = "great" | "good" | "okay" | "distracted";

export type StudySessionStatus = "running" | "paused" | "completed";

export interface UserProfile {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  subjectId: string | null;
  bucket: TaskBucket;
  priority: TaskPriority;
  estimatedMinutes: number | null;
  dueDate: string | null;
  deadline?: number | null;
  categoryId?: string;
  completed: boolean;
  completedAt: string | null;
  isBacklog?: boolean;
  backlogSince?: number | null;
  totalTimeSeconds?: number;
  sessionCount?: number;
  lastWorkedAt?: number | null;
  order: number;
  rollovers: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  sessionId?: string;
  subjectId: string | null;
  taskId: string | null;
  tabId?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  startTime?: number;
  endTime?: number | null;
  durationSeconds?: number;
  accumulatedTime?: number;
  status?: StudySessionStatus;
  lastStartTimestamp?: number | null;
  isActive?: boolean;
  mode: TimerMode;
  phase: "focus" | "manual";
  rating: SessionRating | null;
  reflection: string;
  createdAt: string;
}

export interface WorkoutExercise {
  name: string;
  muscles: string[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  exercises: WorkoutExercise[];
  createdAt: string;
}

export interface WorkoutData {
  enabled: boolean;
  markedDays: string[];
  sessions: WorkoutSession[];
  goals: GoalSettings;
}

export interface TimerSnapshot {
  mode: TimerMode;
  phase: PomodoroPhase;
  isRunning: boolean;
  startedAtMs: number | null;
  accumulatedMs: number;
  phaseStartedAtMs: number | null;
  phaseAccumulatedMs: number;
  cycleCount: number;
  subjectId: string | null;
  taskId: string | null;
}

export interface GoalSettings {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
}

export interface TimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartNextPhase: boolean;
  soundEnabled: boolean;
  preventAccidentalReset: boolean;
}

export interface AppSettings {
  goals: GoalSettings;
  timer: TimerSettings;
  theme: ThemeMode;
}

export interface UserData {
  version: number;
  profileId: string;
  subjects: Subject[];
  categories?: TaskCategory[];
  activeCategoryId?: string | null;
  tasks: Task[];
  sessions: StudySession[];
  workout: WorkoutData;
  settings: AppSettings;
  timer: TimerSnapshot;
  lastRolloverDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilesState {
  version: number;
  activeProfileId: string | null;
  profiles: UserProfile[];
}

export interface PendingReflection {
  sessionId: string;
  subjectId: string | null;
  durationMs: number;
}

export interface AppAnalytics {
  todayStudyMs: number;
  productivityPercent: number;
  streakDays: number;
  bestDayLabel: string;
  bestDayMinutes: number;
  weeklyTotalMs: number;
  previousWeekTotalMs: number;
  monthlyTotalMs: number;
  previousMonthTotalMs: number;
}