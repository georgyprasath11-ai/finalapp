export type ThemeMode = "light" | "dark" | "system";

export type TimerMode = "stopwatch" | "pomodoro";

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type TaskBucket = "daily" | "backlog";

export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "incomplete" | "completed";

export enum TaskType {
  DAILY = "daily",
  SHORT_TERM = "short_term",
  LONG_TERM = "long_term",
}

export type SessionRating = "productive" | "average" | "distracted";

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

export interface BaseTask {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  createdAt: string;
  scheduledFor: string;
  type: TaskType;
}

export interface DailyTask extends BaseTask {
  type: TaskType.DAILY;
  rolloverCount: number;
  isRolledOver: boolean;
  completedAt: string | null;
  updatedAt: string;
}

export interface TimedTask extends BaseTask {
  type: TaskType.SHORT_TERM | TaskType.LONG_TERM;
  description: string;
  subjectId: string | null;
  bucket: TaskBucket;
  estimatedMinutes: number | null;
  dueDate: string | null;
  deadline?: number | null;
  categoryId?: string;
  status: TaskStatus;
  completed: boolean;
  completedAt: string | null;
  isBacklog?: boolean;
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
