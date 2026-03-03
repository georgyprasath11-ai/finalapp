import { StudySession, Task, UserData } from "@/types/models";
import { startOfMonth, startOfWeek, toLocalIsoDate } from "@/utils/date";
import { formatDateLabel } from "@/utils/format";

export type AnalyticsRangePreset = "week" | "month" | "last30" | "custom";

export interface AnalyticsRangeInput {
  preset: AnalyticsRangePreset;
  customStart?: string;
  customEnd?: string;
  now?: Date;
}

export interface AnalyticsRange {
  preset: AnalyticsRangePreset;
  startIso: string;
  endIso: string;
}

export interface ChartDatum {
  name: string;
  value: number;
}

export interface AnalyticsDataset {
  filteredSessions: StudySession[];
  monthlyTopics: ChartDatum[];
  weeklyTopics: ChartDatum[];
  subjectStudyTime: Array<{ subject: string; minutes: number }>;
  dailyStudyTrend: Array<{ date: string; label: string; minutes: number }>;
  sessionLengthDistribution: ChartDatum[];
  completionBySubject: Array<{ subject: string; rate: number; completed: number; total: number }>;
  weeklyConsistency: Array<{ week: string; label: string; studyDays: number }>;
  productivityScoreDistribution: ChartDatum[];
  productivityTrend: Array<{ date: string; label: string; score: number }>;
  productivityBySubject: Array<{ subject: string; score: number }>;
  productiveVsUnproductiveTime: ChartDatum[];
  productivityVsSessionLength: Array<{ bucket: string; score: number }>;
  weeklyProductivityConsistency: Array<{ week: string; label: string; score: number }>;
  reflectionSummary: {
    reflectedSessions: number;
    missingReflections: number;
    productiveShare: number;
    averageScore: number;
  };
}

const parseIsoDateInput = (value: string | undefined, fallback: string): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return value;
};

const localIsoFromDateTime = (value: string): string => toLocalIsoDate(new Date(value));

const sessionScore = (session: StudySession): number | null => {
  const rating = session.reflectionRating ?? session.rating;
  if (rating === "productive") {
    return 100;
  }

  if (rating === "average") {
    return 60;
  }

  if (rating === "distracted") {
    return 20;
  }

  return null;
};

const isSessionProductive = (session: StudySession): boolean => (session.reflectionRating ?? session.rating) === "productive";

const safeSessionMinutes = (session: StudySession): number => {
  const durationMs = Number.isFinite(session.durationMs) ? session.durationMs : 0;
  return Math.max(0, Math.round(durationMs / 60000));
};

const roundToTenth = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(1));
};

const addDays = (iso: string, delta: number): string => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return toLocalIsoDate(date);
};

const enumerateDays = (startIso: string, endIso: string): string[] => {
  const days: string[] = [];
  let cursor = startIso;

  while (cursor <= endIso) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
};

const weekStartIso = (isoDate: string): string => {
  const base = new Date(`${isoDate}T00:00:00`);
  const weekStart = startOfWeek(base);
  return toLocalIsoDate(weekStart);
};

const monthKey = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const aggregatePie = (entries: Iterable<[string, number]>): ChartDatum[] =>
  Array.from(entries)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

const topicLabelForSession = (
  session: StudySession,
  tasksById: Map<string, Task>,
  subjectsById: Map<string, string>,
): string => {
  if (session.taskId) {
    const task = tasksById.get(session.taskId);
    if (task?.title.trim()) {
      return task.title.trim();
    }
  }

  const fallbackTaskId = (session.taskIds ?? []).find((taskId) => tasksById.has(taskId));
  if (fallbackTaskId) {
    const task = tasksById.get(fallbackTaskId);
    if (task?.title.trim()) {
      return task.title.trim();
    }
  }

  if (session.subjectId && subjectsById.has(session.subjectId)) {
    return subjectsById.get(session.subjectId) ?? "Unassigned";
  }

  return "Unassigned";
};

const inRange = (isoDate: string, range: AnalyticsRange): boolean => isoDate >= range.startIso && isoDate <= range.endIso;

const completionTasksInRange = (tasks: Task[], range: AnalyticsRange): Task[] =>
  tasks.filter((task) => {
    const createdIso = localIsoFromDateTime(task.createdAt);
    const completedIso = task.completedAt ? localIsoFromDateTime(task.completedAt) : null;

    return inRange(createdIso, range) || (completedIso !== null && inRange(completedIso, range));
  });

const bucketBySessionLength = (minutes: number): "<30 min" | "30-60 min" | "1-2 hr" | "2+ hr" => {
  if (minutes < 30) {
    return "<30 min";
  }

  if (minutes < 60) {
    return "30-60 min";
  }

  if (minutes < 120) {
    return "1-2 hr";
  }

  return "2+ hr";
};

const mapToSortedArray = (map: Map<string, { total: number; count: number }>): Array<{ name: string; score: number }> =>
  Array.from(map.entries())
    .map(([name, payload]) => ({
      name,
      score: payload.count > 0 ? roundToTenth(payload.total / payload.count) : 0,
    }))
    .sort((a, b) => b.score - a.score);

export const resolveAnalyticsRange = ({ preset, customStart, customEnd, now = new Date() }: AnalyticsRangeInput): AnalyticsRange => {
  const todayIso = toLocalIsoDate(now);

  if (preset === "week") {
    return {
      preset,
      startIso: toLocalIsoDate(startOfWeek(now)),
      endIso: todayIso,
    };
  }

  if (preset === "month") {
    return {
      preset,
      startIso: toLocalIsoDate(startOfMonth(now)),
      endIso: todayIso,
    };
  }

  if (preset === "last30") {
    return {
      preset,
      startIso: addDays(todayIso, -29),
      endIso: todayIso,
    };
  }

  const parsedStart = parseIsoDateInput(customStart, addDays(todayIso, -29));
  const parsedEnd = parseIsoDateInput(customEnd, todayIso);

  return parsedStart <= parsedEnd
    ? { preset, startIso: parsedStart, endIso: parsedEnd }
    : { preset, startIso: parsedEnd, endIso: parsedStart };
};

export const buildAnalyticsDataset = (data: UserData, range: AnalyticsRange): AnalyticsDataset => {
  const subjectsById = new Map(data.subjects.map((subject) => [subject.id, subject.name]));
  const tasksById = new Map(data.tasks.map((task) => [task.id, task]));

  const filteredSessions = data.sessions
    .filter((session) => session.isActive !== true)
    .filter((session) => inRange(localIsoFromDateTime(session.endedAt), range));

  const referenceDate = range.endIso;
  const referenceMonth = monthKey(referenceDate);
  const referenceWeek = weekStartIso(referenceDate);

  const monthlyTopicMap = new Map<string, number>();
  const weeklyTopicMap = new Map<string, number>();
  const subjectTimeMap = new Map<string, number>();
  const dayMinutesMap = new Map<string, number>();
  const sessionLengthMap = new Map<string, number>([
    ["<30 min", 0],
    ["30-60 min", 0],
    ["1-2 hr", 0],
    ["2+ hr", 0],
  ]);

  filteredSessions.forEach((session) => {
    const endIso = localIsoFromDateTime(session.endedAt);
    const topic = topicLabelForSession(session, tasksById, subjectsById);
    const subject = session.subjectId ? (subjectsById.get(session.subjectId) ?? "Unassigned") : "Unassigned";
    const minutes = safeSessionMinutes(session);

    subjectTimeMap.set(subject, (subjectTimeMap.get(subject) ?? 0) + minutes);
    dayMinutesMap.set(endIso, (dayMinutesMap.get(endIso) ?? 0) + minutes);

    const lengthBucket = bucketBySessionLength(minutes);
    sessionLengthMap.set(lengthBucket, (sessionLengthMap.get(lengthBucket) ?? 0) + 1);

    if (monthKey(endIso) === referenceMonth) {
      monthlyTopicMap.set(topic, (monthlyTopicMap.get(topic) ?? 0) + minutes);
    }

    if (weekStartIso(endIso) === referenceWeek) {
      weeklyTopicMap.set(topic, (weeklyTopicMap.get(topic) ?? 0) + minutes);
    }
  });

  const completionMap = new Map<string, { completed: number; total: number }>();
  completionTasksInRange(data.tasks, range).forEach((task) => {
    const subjectName = task.subjectId ? (subjectsById.get(task.subjectId) ?? "Unassigned") : "Unassigned";
    const current = completionMap.get(subjectName) ?? { completed: 0, total: 0 };
    current.total += 1;
    if (task.completed) {
      current.completed += 1;
    }
    completionMap.set(subjectName, current);
  });

  const weekStudyDayMap = new Map<string, Set<string>>();
  dayMinutesMap.forEach((minutes, isoDate) => {
    if (minutes <= 0) {
      return;
    }

    const key = weekStartIso(isoDate);
    const set = weekStudyDayMap.get(key) ?? new Set<string>();
    set.add(isoDate);
    weekStudyDayMap.set(key, set);
  });

  const reflectedSessions = filteredSessions.filter((session) => sessionScore(session) !== null);

  const productivityDistribution = new Map<string, number>([
    ["Productive", 0],
    ["Not productive", 0],
  ]);
  const productivityTrendMap = new Map<string, { total: number; count: number }>();
  const productivitySubjectMap = new Map<string, { total: number; count: number }>();
  const productivityLengthMap = new Map<string, { total: number; count: number }>([
    ["<30 min", { total: 0, count: 0 }],
    ["30-60 min", { total: 0, count: 0 }],
    ["1-2 hr", { total: 0, count: 0 }],
    ["2+ hr", { total: 0, count: 0 }],
  ]);
  const productivityWeekMap = new Map<string, { total: number; count: number }>();

  let productiveMinutes = 0;
  let unproductiveMinutes = 0;
  let productiveCount = 0;
  let scoreTotal = 0;

  reflectedSessions.forEach((session) => {
    const score = sessionScore(session);
    if (score === null) {
      return;
    }

    const endIso = localIsoFromDateTime(session.endedAt);
    const subject = session.subjectId ? (subjectsById.get(session.subjectId) ?? "Unassigned") : "Unassigned";
    const minutes = safeSessionMinutes(session);
    const productive = isSessionProductive(session);

    scoreTotal += score;
    if (productive) {
      productiveCount += 1;
      productiveMinutes += minutes;
      productivityDistribution.set("Productive", (productivityDistribution.get("Productive") ?? 0) + 1);
    } else {
      unproductiveMinutes += minutes;
      productivityDistribution.set("Not productive", (productivityDistribution.get("Not productive") ?? 0) + 1);
    }

    const trend = productivityTrendMap.get(endIso) ?? { total: 0, count: 0 };
    trend.total += score;
    trend.count += 1;
    productivityTrendMap.set(endIso, trend);

    const bySubject = productivitySubjectMap.get(subject) ?? { total: 0, count: 0 };
    bySubject.total += score;
    bySubject.count += 1;
    productivitySubjectMap.set(subject, bySubject);

    const lengthKey = bucketBySessionLength(minutes);
    const byLength = productivityLengthMap.get(lengthKey) ?? { total: 0, count: 0 };
    byLength.total += score;
    byLength.count += 1;
    productivityLengthMap.set(lengthKey, byLength);

    const weekKey = weekStartIso(endIso);
    const byWeek = productivityWeekMap.get(weekKey) ?? { total: 0, count: 0 };
    byWeek.total += score;
    byWeek.count += 1;
    productivityWeekMap.set(weekKey, byWeek);
  });

  const allDays = enumerateDays(range.startIso, range.endIso);

  return {
    filteredSessions,
    monthlyTopics: aggregatePie(monthlyTopicMap.entries()),
    weeklyTopics: aggregatePie(weeklyTopicMap.entries()),
    subjectStudyTime: Array.from(subjectTimeMap.entries())
      .map(([subject, minutes]) => ({ subject, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
    dailyStudyTrend: allDays.map((iso) => ({
      date: iso,
      label: formatDateLabel(iso),
      minutes: dayMinutesMap.get(iso) ?? 0,
    })),
    sessionLengthDistribution: aggregatePie(sessionLengthMap.entries()),
    completionBySubject: Array.from(completionMap.entries())
      .map(([subject, stats]) => ({
        subject,
        completed: stats.completed,
        total: stats.total,
        rate: stats.total > 0 ? roundToTenth((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate),
    weeklyConsistency: Array.from(weekStudyDayMap.entries())
      .map(([week, set]) => ({
        week,
        label: formatDateLabel(week),
        studyDays: set.size,
      }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    productivityScoreDistribution: aggregatePie(productivityDistribution.entries()),
    productivityTrend: Array.from(productivityTrendMap.entries())
      .map(([date, payload]) => ({
        date,
        label: formatDateLabel(date),
        score: payload.count > 0 ? roundToTenth(payload.total / payload.count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    productivityBySubject: mapToSortedArray(productivitySubjectMap).map((entry) => ({
      subject: entry.name,
      score: entry.score,
    })),
    productiveVsUnproductiveTime: [
      { name: "Productive", value: productiveMinutes },
      { name: "Unproductive", value: unproductiveMinutes },
    ],
    productivityVsSessionLength: mapToSortedArray(productivityLengthMap).map((entry) => ({
      bucket: entry.name,
      score: entry.score,
    })),
    weeklyProductivityConsistency: mapToSortedArray(productivityWeekMap)
      .map((entry) => ({
        week: entry.name,
        label: formatDateLabel(entry.name),
        score: entry.score,
      }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    reflectionSummary: {
      reflectedSessions: reflectedSessions.length,
      missingReflections: Math.max(0, filteredSessions.length - reflectedSessions.length),
      productiveShare: reflectedSessions.length > 0 ? roundToTenth((productiveCount / reflectedSessions.length) * 100) : 0,
      averageScore: reflectedSessions.length > 0 ? roundToTenth(scoreTotal / reflectedSessions.length) : 0,
    },
  };
};
