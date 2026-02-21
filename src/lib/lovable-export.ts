import { SessionRating, UserData } from "@/types/models";
import { toLocalIsoDate } from "@/lib/goals";

const legacyColorValue = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("hsl(") && trimmed.endsWith(")")) {
    return trimmed.slice(4, -1).trim();
  }
  return trimmed;
};

const toLegacyRating = (rating: SessionRating | null): string | undefined => {
  if (rating === null) {
    return undefined;
  }

  if (rating === "distracted") {
    return "distracted";
  }

  if (rating === "average") {
    return "average";
  }

  return "productive";
};

const categoryForBucket = (bucket: "daily" | "backlog"): string =>
  bucket === "daily" ? "School" : "Backlog";

export const buildLovableExport = (data: UserData): string => {
  const subjectById = new Map(data.subjects.map((subject) => [subject.id, subject]));
  const taskById = new Map(data.tasks.map((task) => [task.id, task]));
  const subjectName = (subjectId: string | null): string =>
    subjectId === null ? "Other" : subjectById.get(subjectId)?.name ?? "Other";

  const taskAccumulatedSeconds = new Map<string, number>();
  data.sessions.forEach((session) => {
    if (!session.taskId) {
      return;
    }
    const seconds = Math.max(0, Math.round(session.durationMs / 1000));
    taskAccumulatedSeconds.set(session.taskId, (taskAccumulatedSeconds.get(session.taskId) ?? 0) + seconds);
  });

  const legacySessions = data.sessions.map((session) => {
    const linkedTask = session.taskId ? taskById.get(session.taskId) : undefined;
    const category = linkedTask ? categoryForBucket(linkedTask.bucket) : "School";

    return {
      id: session.id,
      taskId: session.taskId ?? undefined,
      subject: subjectName(session.subjectId),
      category,
      duration: Math.max(0, Math.round(session.durationMs / 1000)),
      date: toLocalIsoDate(new Date(session.endedAt)),
      startTime: session.startedAt,
      endTime: session.endedAt,
      rating: toLegacyRating(session.rating),
      note: session.reflection.trim() || undefined,
    };
  });

  const legacyTasks = data.tasks.map((task) => ({
    title: task.title,
    subject: subjectName(task.subjectId),
    description: task.description,
    scheduledDate: task.dueDate ?? toLocalIsoDate(new Date()),
    plannedTime: task.estimatedMinutes ?? 0,
    id: task.id,
    createdAt: task.createdAt,
    completed: task.completed,
    isBacklog: task.bucket === "backlog",
    originalDate: task.dueDate ?? undefined,
    category: categoryForBucket(task.bucket),
    accumulatedTime: taskAccumulatedSeconds.get(task.id) ?? 0,
    completedAt: task.completedAt ?? undefined,
  }));

  const legacyWorkoutSessions = data.workout.sessions.map((session) => ({
    id: session.id,
    date: session.date,
    duration: Math.max(0, Math.round(session.durationMs / 1000)),
    startTime: session.startedAt,
    endTime: session.endedAt,
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      muscles: exercise.muscles,
    })),
  }));

  const timerSubjectName = subjectName(data.timer.subjectId);
  const timerTask = data.timer.taskId ? taskById.get(data.timer.taskId) : undefined;
  const nowMs = Date.now();
  const elapsedMs =
    data.timer.isRunning && data.timer.startedAtMs !== null
      ? data.timer.accumulatedMs + Math.max(0, nowMs - data.timer.startedAtMs)
      : data.timer.accumulatedMs;

  const payload = {
    "study-sessions": JSON.stringify(legacySessions),
    "study-goals": JSON.stringify({
      dailyHours: data.settings.goals.dailyHours,
      weeklyHours: data.settings.goals.weeklyHours,
      monthlyHours: data.settings.goals.monthlyHours,
      yearlyHours: Number((data.settings.goals.monthlyHours * 12).toFixed(2)),
    }),
    "study-categories": JSON.stringify([
      { id: "school", name: "School" },
      { id: "backlog", name: "Backlog" },
    ]),
    "study-subjects": JSON.stringify(
      data.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        color: legacyColorValue(subject.color),
      })),
    ),
    "study-timer-state": JSON.stringify({
      isRunning: data.timer.isRunning,
      elapsedTime: Math.max(0, Math.round(elapsedMs / 1000)),
      currentSubject: timerSubjectName,
      currentTaskId: data.timer.taskId,
      currentCategory: timerTask ? categoryForBucket(timerTask.bucket) : "School",
    }),
    "app-settings": JSON.stringify({
      workoutEnabled: data.workout.enabled,
      theme: data.settings.theme,
    }),
    "workout-marked-days": JSON.stringify(data.workout.markedDays),
    "study-last-auto-move": JSON.stringify(data.lastRolloverDate ?? null),
    "study-tasks": JSON.stringify(legacyTasks),
    "workout-sessions": JSON.stringify(legacyWorkoutSessions),
    "workout-goals": JSON.stringify({
      dailyHours: data.workout.goals.dailyHours,
      weeklyHours: data.workout.goals.weeklyHours,
      monthlyHours: data.workout.goals.monthlyHours,
    }),
  };

  return JSON.stringify(payload, null, 2);
};