import { StudySession, Subject, Task, UserData } from "@/types/models";

export const sortSubjectsByName = (subjects: Subject[]): Subject[] =>
  [...subjects].sort((a, b) => a.name.localeCompare(b.name));

export const sortTasksByOrder = (tasks: Task[]): Task[] => [...tasks].sort((a, b) => a.order - b.order);

export const sortSessionsNewestFirst = (sessions: StudySession[]): StudySession[] =>
  [...sessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());

export const tasksByBucket = (data: UserData, bucket: Task["bucket"]): Task[] =>
  sortTasksByOrder(data.tasks.filter((task) => task.bucket === bucket));

export const isTaskOverdue = (task: Task, todayIso: string): boolean =>
  !task.completed && task.dueDate !== null && task.dueDate < todayIso;

export const subjectName = (subjects: Subject[], subjectId: string | null): string =>
  subjectId === null ? "Unassigned" : subjects.find((subject) => subject.id === subjectId)?.name ?? "Unknown";

export const subjectColor = (subjects: Subject[], subjectId: string | null): string =>
  subjectId === null ? "#64748b" : subjects.find((subject) => subject.id === subjectId)?.color ?? "#64748b";
