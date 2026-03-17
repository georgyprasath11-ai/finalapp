import { SessionRating, StudySession, Task, UserData } from "@/types/models";
import { endOfMonth, startOfMonth, startOfWeek, toLocalIsoDate } from "@/utils/date";
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
  // existing fields — DO NOT REMOVE ANY
  filteredSessions: StudySession[];
  monthlyTopics: ChartDatum[];
  weeklyTopics: ChartDatum[];
  subjectStudyTime: Array<{ subject: string; minutes: number }>;
  dailyStudyTrend: Array<{ date: string; label: string; minutes: number }>;
  sessionLengthDistribution: ChartDatum[];
  completionBySubject: Array<{ subject: string; rate: number; completed: number; total: number }>;
  weeklyConsistency: Array<{ week: string; label: string; studyDays: number }>;
  productivityScoreDistribution: ChartDatum[];
  productivityTrend: Array<{ date: string; label: string; points: number }>;
  productivityBySubject: Array<{ subject: string; points: number }>;
  productiveVsUnproductiveTime: ChartDatum[];
  productivityVsSessionLength: Array<{ bucket: string; points: number }>;
  weeklyProductivityConsistency: Array<{ week: string; label: string; points: number }>;
  reflectionSummary: {
    reflectedSessions: number;
    missingReflections: number;
    productiveShare: number;
    totalPoints: number;
    averagePoints: number;
  };
  // NEW FIELDS
  cumulativeStudyMinutes: Array<{ date: string; label: string; cumulative: number; daily: number }>;
  hourOfDayDistribution: Array<{ hour: string; sessions: number; minutes: number }>;
  dayOfWeekDistribution: Array<{ day: string; sessions: number; minutes: number }>;
  sessionCountByDay: Array<{ date: string; label: string; count: number }>;
  studyStreakHistory: Array<{ date: string; label: string; studied: number }>;
  taskCompletionTimeline: Array<{ date: string; label: string; completed: number; created: number }>;
  subjectSessionCount: Array<{ subject: string; count: number }>;
  avgSessionDurationBySubject: Array<{ subject: string; avgMinutes: number }>;
  rollingAvgStudyTime: Array<{ date: string; label: string; rollingAvg: number; daily: number }>;
  totalStudyMinutes: number;
  totalSessions: number;
  avgDailyMinutes: number;
  longestSessionMinutes: number;
  mostStudiedSubject: string;
  studyDaysCount: number;
}

const parseIsoDateInput = (value: string | undefined, fallback: string): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return value;
};

const localIsoFromDateTime = (value: string): string => toLocalIsoDate(new Date(value));

const sessionRating = (session: StudySession): SessionRating | null => session.reflectionRating ?? session.rating;

const sessionPoints = (session: StudySession): number | null => {
  const rating = sessionRating(session);
  if (rating === "productive") {
    return 5;
  }

  if (rating === "average") {
    return 3;
  }

  if (rating === "distracted") {
    return 1;
  }

  return null;
};

const isSessionProductive = (session: StudySession): boolean => sessionRating(session) === "productive";

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

const mapToSortedArray = (map: Map<string, { total: number; count: number }>): Array<{ name: string; value: number }> =>
  Array.from(map.entries())
    .map(([name, payload]) => ({
      name,
      value: payload.count > 0 ? roundToTenth(payload.total / payload.count) : 0,
    }))
    .sort((a, b) => b.value - a.value);

export const resolveAnalyticsRange = ({
  preset,
  customStart,
  customEnd,
  now = new Date(),
}: AnalyticsRangeInput): AnalyticsRange => {
  const todayIso = toLocalIsoDate(now);

  if (preset === "week") {
    const weekStart = toLocalIsoDate(startOfWeek(now));
    const weekEnd = addDays(weekStart, 6);
    return {
      preset,
      startIso: weekStart,
      endIso: weekEnd,
    };
  }

  if (preset === "month") {
    const monthStart = toLocalIsoDate(startOfMonth(now));
    const monthEnd = toLocalIsoDate(endOfMonth(now));
    return {
      preset,
      startIso: monthStart,
      endIso: monthEnd,
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

  const reflectedSessions = filteredSessions.filter((session) => sessionPoints(session) !== null);

  const productivityDistribution = new Map<string, number>([
    ["5 pts (Productive)", 0],
    ["3 pts (Average)", 0],
    ["1 pt (Distracted)", 0],
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
  let pointsTotal = 0;

  reflectedSessions.forEach((session) => {
    const points = sessionPoints(session);
    if (points === null) {
      return;
    }

    const endIso = localIsoFromDateTime(session.endedAt);
    const subject = session.subjectId ? (subjectsById.get(session.subjectId) ?? "Unassigned") : "Unassigned";
    const minutes = safeSessionMinutes(session);
    const productive = isSessionProductive(session);
    const rating = sessionRating(session);

    pointsTotal += points;
    if (productive) {
      productiveCount += 1;
      productiveMinutes += minutes;
      productivityDistribution.set("5 pts (Productive)", (productivityDistribution.get("5 pts (Productive)") ?? 0) + 1);
    } else if (rating === "average") {
      unproductiveMinutes += minutes;
      productivityDistribution.set("3 pts (Average)", (productivityDistribution.get("3 pts (Average)") ?? 0) + 1);
    } else {
      unproductiveMinutes += minutes;
      productivityDistribution.set("1 pt (Distracted)", (productivityDistribution.get("1 pt (Distracted)") ?? 0) + 1);
    }

    const trend = productivityTrendMap.get(endIso) ?? { total: 0, count: 0 };
    trend.total += points;
    trend.count += 1;
    productivityTrendMap.set(endIso, trend);

    const bySubject = productivitySubjectMap.get(subject) ?? { total: 0, count: 0 };
    bySubject.total += points;
    bySubject.count += 1;
    productivitySubjectMap.set(subject, bySubject);

    const lengthKey = bucketBySessionLength(minutes);
    const byLength = productivityLengthMap.get(lengthKey) ?? { total: 0, count: 0 };
    byLength.total += points;
    byLength.count += 1;
    productivityLengthMap.set(lengthKey, byLength);

    const weekKey = weekStartIso(endIso);
    const byWeek = productivityWeekMap.get(weekKey) ?? { total: 0, count: 0 };
    byWeek.total += points;
    byWeek.count += 1;
    productivityWeekMap.set(weekKey, byWeek);
  });

  // ── NEW COMPUTATIONS (add these before the return) ──────────────────────

  // Cumulative study minutes over the range
  const allDays = enumerateDays(range.startIso, range.endIso);
  let runningTotal = 0;
  const cumulativeStudyMinutes = allDays.map((iso) => {
    const daily = dayMinutesMap.get(iso) ?? 0;
    runningTotal += daily;
    return { date: iso, label: formatDateLabel(iso), cumulative: runningTotal, daily };
  });

  // Hour-of-day distribution (0–23)
  const hourMap = new Map<number, { sessions: number; minutes: number }>();
  for (let h = 0; h < 24; h++) hourMap.set(h, { sessions: 0, minutes: 0 });
  filteredSessions.forEach((session) => {
    const hour = new Date(session.startedAt).getHours();
    const entry = hourMap.get(hour) ?? { sessions: 0, minutes: 0 };
    entry.sessions += 1;
    entry.minutes += safeSessionMinutes(session);
    hourMap.set(hour, entry);
  });
  const hourOfDayDistribution = Array.from(hourMap.entries()).map(([h, v]) => ({
    hour: `${h.toString().padStart(2, "0")}:00`,
    sessions: v.sessions,
    minutes: v.minutes,
  }));

  // Day-of-week distribution
  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap = new Map<number, { sessions: number; minutes: number }>();
  for (let d = 0; d < 7; d++) dowMap.set(d, { sessions: 0, minutes: 0 });
  filteredSessions.forEach((session) => {
    const dow = new Date(session.endedAt).getDay();
    const entry = dowMap.get(dow) ?? { sessions: 0, minutes: 0 };
    entry.sessions += 1;
    entry.minutes += safeSessionMinutes(session);
    dowMap.set(dow, entry);
  });
  const dayOfWeekDistribution = Array.from(dowMap.entries()).map(([d, v]) => ({
    day: DOW_LABELS[d],
    sessions: v.sessions,
    minutes: v.minutes,
  }));

  // Session count per day
  const sessionCountByDayMap = new Map<string, number>();
  filteredSessions.forEach((session) => {
    const iso = localIsoFromDateTime(session.endedAt);
    sessionCountByDayMap.set(iso, (sessionCountByDayMap.get(iso) ?? 0) + 1);
  });
  const sessionCountByDay = allDays.map((iso) => ({
    date: iso,
    label: formatDateLabel(iso),
    count: sessionCountByDayMap.get(iso) ?? 0,
  }));

  // Study streak history (1 = studied that day, 0 = did not)
  const studyStreakHistory = allDays.map((iso) => ({
    date: iso,
    label: formatDateLabel(iso),
    studied: (dayMinutesMap.get(iso) ?? 0) > 0 ? 1 : 0,
  }));

  // Task completion timeline
  const taskCreatedMap = new Map<string, number>();
  const taskCompletedMap = new Map<string, number>();
  data.tasks.forEach((task) => {
    const createdIso = localIsoFromDateTime(task.createdAt);
    if (createdIso >= range.startIso && createdIso <= range.endIso) {
      taskCreatedMap.set(createdIso, (taskCreatedMap.get(createdIso) ?? 0) + 1);
    }
    if (task.completedAt) {
      const completedIso = localIsoFromDateTime(task.completedAt);
      if (completedIso >= range.startIso && completedIso <= range.endIso) {
        taskCompletedMap.set(completedIso, (taskCompletedMap.get(completedIso) ?? 0) + 1);
      }
    }
  });
  const taskCompletionTimeline = allDays.map((iso) => ({
    date: iso,
    label: formatDateLabel(iso),
    completed: taskCompletedMap.get(iso) ?? 0,
    created: taskCreatedMap.get(iso) ?? 0,
  }));

  // Session count by subject
  const subjectSessionCountMap = new Map<string, number>();
  filteredSessions.forEach((session) => {
    const subject = session.subjectId ? (subjectsById.get(session.subjectId) ?? "Unassigned") : "Unassigned";
    subjectSessionCountMap.set(subject, (subjectSessionCountMap.get(subject) ?? 0) + 1);
  });
  const subjectSessionCount = Array.from(subjectSessionCountMap.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);

  // Average session duration by subject
  const subjectDurationMap = new Map<string, { total: number; count: number }>();
  filteredSessions.forEach((session) => {
    const subject = session.subjectId ? (subjectsById.get(session.subjectId) ?? "Unassigned") : "Unassigned";
    const entry = subjectDurationMap.get(subject) ?? { total: 0, count: 0 };
    entry.total += safeSessionMinutes(session);
    entry.count += 1;
    subjectDurationMap.set(subject, entry);
  });
  const avgSessionDurationBySubject = Array.from(subjectDurationMap.entries())
    .map(([subject, v]) => ({ subject, avgMinutes: v.count > 0 ? roundToTenth(v.total / v.count) : 0 }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes);

  // 7-day rolling average of study time
  const rollingAvgStudyTime = allDays.map((iso, idx) => {
    const windowDays = allDays.slice(Math.max(0, idx - 6), idx + 1);
    const windowMinutes = windowDays.reduce((sum, d) => sum + (dayMinutesMap.get(d) ?? 0), 0);
    const rollingAvg = roundToTenth(windowMinutes / windowDays.length);
    return { date: iso, label: formatDateLabel(iso), rollingAvg, daily: dayMinutesMap.get(iso) ?? 0 };
  });

  // Summary stats
  const totalStudyMinutes = Array.from(dayMinutesMap.values()).reduce((a, b) => a + b, 0);
  const totalSessions = filteredSessions.length;
  const studyDaysCount = Array.from(dayMinutesMap.values()).filter((m) => m > 0).length;
  const avgDailyMinutes = studyDaysCount > 0 ? roundToTenth(totalStudyMinutes / studyDaysCount) : 0;
  const longestSessionMinutes = filteredSessions.reduce((max, s) => Math.max(max, safeSessionMinutes(s)), 0);
  const mostStudiedSubject = Array.from(subjectTimeMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

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
      .map(([week, set]) => ({ week, label: formatDateLabel(week), studyDays: set.size }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    productivityScoreDistribution: aggregatePie(productivityDistribution.entries()),
    productivityTrend: Array.from(productivityTrendMap.entries())
      .map(([date, payload]) => ({
        date,
        label: formatDateLabel(date),
        points: payload.count > 0 ? roundToTenth(payload.total / payload.count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    productivityBySubject: mapToSortedArray(productivitySubjectMap).map((entry) => ({
      subject: entry.name,
      points: entry.value,
    })),
    productiveVsUnproductiveTime: [
      { name: "Productive", value: productiveMinutes },
      { name: "Unproductive", value: unproductiveMinutes },
    ],
    productivityVsSessionLength: mapToSortedArray(productivityLengthMap).map((entry) => ({
      bucket: entry.name,
      points: entry.value,
    })),
    weeklyProductivityConsistency: mapToSortedArray(productivityWeekMap)
      .map((entry) => ({ week: entry.name, label: formatDateLabel(entry.name), points: entry.value }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    reflectionSummary: {
      reflectedSessions: reflectedSessions.length,
      missingReflections: Math.max(0, filteredSessions.length - reflectedSessions.length),
      productiveShare:
        reflectedSessions.length > 0 ? roundToTenth((productiveCount / reflectedSessions.length) * 100) : 0,
      totalPoints: pointsTotal,
      averagePoints: reflectedSessions.length > 0 ? roundToTenth(pointsTotal / reflectedSessions.length) : 0,
    },
    cumulativeStudyMinutes,
    hourOfDayDistribution,
    dayOfWeekDistribution,
    sessionCountByDay,
    studyStreakHistory,
    taskCompletionTimeline,
    subjectSessionCount,
    avgSessionDurationBySubject,
    rollingAvgStudyTime,
    totalStudyMinutes,
    totalSessions,
    avgDailyMinutes,
    longestSessionMinutes,
    mostStudiedSubject,
    studyDaysCount,
  };
};
