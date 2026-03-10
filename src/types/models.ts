export type ThemeMode = "light" | "dark" | "system";

export type TimerMode = "stopwatch" | "pomodoro";

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type TaskBucket = "daily" | "backlog";

export type TaskPriority = "low" | "medium" | "high";

export type LegacyTaskStatus = "incomplete" | "completed";

export type TaskLifecycleStatus = "active" | "backlog" | "completed" | "archived";

export type TaskStatus = TaskLifecycleStatus | LegacyTaskStatus;

export enum TaskType {
  DAILY = "daily",
  SHORT_TERM = "short_term",
  LONG_TERM = "long_term",
}

export type TaskMigrationCategory = "subject" | "shortTerm" | "longTerm" | "daily";

export type SessionRating = "productive" | "average" | "distracted";

export type StudySessionStatus = "running" | "paused" | "completed";

export type AppRole = "student" | "viewer";

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

export interface TaskSessionSnapshot {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export interface BaseTask {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  createdAt: string;
  scheduledFor: string;
  type: TaskType;
  category: TaskMigrationCategory;
  timeSpent: number;
  sessions?: TaskSessionSnapshot[];
}

export interface DailyTask extends BaseTask {
  type: TaskType.DAILY;
  category: "daily";
  rolloverCount: number;
  isRolledOver: boolean;
  completedAt: string | null;
  updatedAt: string;
}

export interface TimedTask extends BaseTask {
  type: TaskType.SHORT_TERM | TaskType.LONG_TERM;
  category: "subject" | "shortTerm" | "longTerm";
  description: string;
  subjectId: string | null;
  bucket: TaskBucket;
  estimatedMinutes: number | null;
  dueDate: string | null;
  deadline?: number | null;
  categoryId?: string;
  status?: TaskStatus;
  previousStatus?: Exclude<TaskLifecycleStatus, "completed"> | null;
  completed: boolean;
  completedAt: string | null;
  isBacklog?: boolean;
  isAutoBacklog?: boolean;
  backlogSince?: number | null;
  totalTimeSpent: number;
  lastSessionStartedAt?: string;
  isTimerRunning?: boolean;
  totalTimeSeconds?: number;
  sessionCount?: number;
  lastWorkedAt?: number | null;
  order: number;
  rollovers: number;
  createdAt: string;
  updatedAt: string;
}

export type Task = TimedTask;

export type AnyTask = DailyTask | TimedTask;

export const canUseTimer = (task: AnyTask): task is TimedTask =>
  task.type === TaskType.SHORT_TERM || task.type === TaskType.LONG_TERM;

export const getDailyTasks = (tasks: AnyTask[]): DailyTask[] =>
  tasks.filter((task): task is DailyTask => task.type === TaskType.DAILY);

export const getTimedTasks = (tasks: AnyTask[]): TimedTask[] =>
  tasks.filter(canUseTimer);

export interface WeeklyReview {
  id: string;
  weekStartIso: string;
  reflection: string;
  savedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  completions: string[];
  createdAt: string;
  archivedAt: string | null;
}

export interface NewFeaturesExportBundle {
  exportVersion: 1;
  exportedAt: string;
  habits: Habit[];
  weeklyReviews: WeeklyReview[];
}

export interface StudySession {
  id: string;
  sessionId?: string;
  subjectId: string | null;
  taskId: string | null;
  taskIds?: string[];
  taskAllocations?: Record<string, number>;
  activeTaskId?: string | null;
  activeTaskStartedAt?: number | null;
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
  reflectionRating: SessionRating | null;
  reflectionComment: string;
  reflectionTimestamp: number | null;
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

export interface ParentViewerAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  clientId: string;
  action:
    | "generate"
    | "refresh"
    | "verify_success"
    | "verify_failure"
    | "verify_rate_limited"
    | "verify_locked"
    | "verify_expired"
    | "lockout"
    | "viewer_write_blocked";
  success: boolean;
  details?: string;
}

export interface ParentViewerState {
  otpHash: string | null;
  otpCreatedAt: string | null;
  otpExpiresAt: string | null;
  lastAccessAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  auditLog: ParentViewerAuditEvent[];
}

export interface VacationModeState {
  enabled: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  cooldownUntil?: string | null;
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
  parentViewer: ParentViewerState;
  vacationMode: VacationModeState;
  settings: AppSettings;
  timer: TimerSnapshot;
  lastRolloverDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CheckboxSoundSource = "bundled" | "uploaded";

export interface CheckboxSound {
  id: string;
  name: string;
  source: CheckboxSoundSource;
  url: string;
  createdAt: string;
}

export interface CheckboxSoundState {
  version: number;
  sounds: CheckboxSound[];
  selectedSound: string | null;
}

export interface DailyTaskDayStats {
  total: number;
  completed: number;
  rollover: number;
  byPriority: Record<TaskPriority, number>;
}

export interface DailyTaskHistoryTaskRecord {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  scheduledFor: string;
  priority: TaskPriority;
  rolloverCount: number;
  isRolledOver: boolean;
  timeSpent: number;
}

export interface DailyTaskHistoryStatistics {
  completedTasks: number;
  incompleteTasks: number;
  totalTimeSpent: number;
  completionRate: number;
  streakDays: number;
}

export interface DailyTaskHistoryAnalyticsSnapshot {
  dailyCompletionRate: number;
  weeklyCompletionRate: number;
  monthlyCompletionRate: number;
  yearlyCompletionRate: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DailyTaskHistoryDay {
  date: string;
  tasks: DailyTaskHistoryTaskRecord[];
  statistics: DailyTaskHistoryStatistics;
  analytics: DailyTaskHistoryAnalyticsSnapshot;
  updatedAt: string;
}

export interface DailyTaskHistoryDataset {
  version: number;
  days: Record<string, DailyTaskHistoryDay>;
  updatedAt: string | null;
}

export interface DailyTasksState {
  version: number;
  tasks: DailyTask[];
  statsByDate: Record<string, DailyTaskDayStats>;
  lastRolloverDate: string | null;
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



