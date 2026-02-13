export interface TaskCategory {
  id: string;
  name: string;
}

export const DEFAULT_CATEGORIES: TaskCategory[] = [
  { id: 'tuition', name: 'Tuition' },
  { id: 'school', name: 'School' },
  { id: 'work', name: 'Work' },
  { id: 'assignment', name: 'Assignment' },
];

export interface CustomSubject {
  id: string;
  name: string;
  color: string; // HSL color string like "158 64% 40%"
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  category: string; // tab/category name
  description: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  scheduledDate?: string;
  plannedTime?: number;
  notes?: string;
  isBacklog?: boolean;
  originalDate?: string;
  accumulatedTime: number; // total tracked time in seconds
}

export interface StudySession {
  id: string;
  taskId?: string;
  subject: string;
  category?: string;
  duration: number;
  date: string;
  startTime: string;
  endTime: string;
}

export interface TimerState {
  isRunning: boolean;
  elapsedTime: number;
  currentSubject: string;
  currentTaskId?: string;
  currentCategory?: string;
  startTimestamp?: number;
}

export interface MonthlyStats {
  month: string;
  totalTime: number;
  sessionCount: number;
  subjectBreakdown: Record<string, number>;
}

export const DEFAULT_SUBJECTS: CustomSubject[] = [
  { id: 'math', name: 'Mathematics', color: '220 70% 55%' },
  { id: 'physics', name: 'Physics', color: '200 70% 50%' },
  { id: 'chemistry', name: 'Chemistry', color: '280 60% 55%' },
  { id: 'biology', name: 'Biology', color: '142 72% 45%' },
  { id: 'english', name: 'English', color: '38 92% 55%' },
  { id: 'history', name: 'History', color: '330 70% 55%' },
  { id: 'geography', name: 'Geography', color: '170 60% 45%' },
  { id: 'cs', name: 'Computer Science', color: '258 60% 55%' },
  { id: 'economics', name: 'Economics', color: '15 80% 55%' },
  { id: 'art', name: 'Art', color: '300 60% 55%' },
  { id: 'music', name: 'Music', color: '340 65% 55%' },
  { id: 'other', name: 'Other', color: '160 10% 50%' },
];

export type Subject = string;
