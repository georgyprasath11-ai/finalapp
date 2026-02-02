export interface Task {
  id: string;
  title: string;
  subject: string;
  description: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  scheduledDate?: string; // ISO date string (YYYY-MM-DD)
  plannedTime?: number; // in minutes
  notes?: string;
  isBacklog?: boolean; // true if task is in backlog
  originalDate?: string; // original scheduled date before becoming backlog
}

export interface StudySession {
  id: string;
  taskId?: string;
  subject: string;
  duration: number; // in seconds
  date: string; // ISO date string
  startTime: string;
  endTime: string;
}

export interface TimerState {
  isRunning: boolean;
  elapsedTime: number; // in seconds
  currentSubject: string;
  currentTaskId?: string;
  startTimestamp?: number; // when the timer was started (for calculating elapsed time on reload)
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalTime: number; // in seconds
  sessionCount: number;
  subjectBreakdown: Record<string, number>;
}

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Geography',
  'Computer Science',
  'Economics',
  'Art',
  'Music',
  'Other'
] as const;

export type Subject = typeof SUBJECTS[number];
