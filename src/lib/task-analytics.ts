import { SessionRating, StudySession, Task, UserData } from "@/types/models";
import { endOfMonth, startOfMonth, startOfWeek, toLocalIsoDate } from "@/utils/date";
import { formatDateLabel } from "@/utils/format";

export type AnalyticsRangePreset = "week" | "month" | "last30" | "last90" | "last365" | "all" | "custom";

export interface AnalyticsRangeInput {
  preset: AnalyticsRangePreset;
  customStart?: string;
  customEnd?: string;
  now?: Date;
  /**
   * Required when preset === "all".
   * The resolver will scan this array to find the earliest session's endedAt
   * date and use that as the range start, so "All Time" always covers 100%
   * of the user's stored data regardless of how far back it goes.
   * If the array is empty or not provided, falls back to last 365 days.
   */
  allSessionEndDates?: string[];
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

  // ── NEW: Reflection & Hours fields ─────────────────────────────────────
  /** Per-day: total hours studied and whether a reflection was recorded */
  hoursWithReflectionTimeline: Array<{
    date: string;
    label: string;
    hours: number; // total study hours for that day (0-decimal rounded)
    hasReflection: boolean; // true if ANY session that day has a reflection rating
    reflectionCount: number; // number of sessions with reflections that day
  }>;

  /** Per-session: duration in minutes vs reflection rating (productive/average/distracted/none) */
  sessionDurationVsReflection: Array<{
    sessionId: string;
    minutes: number;
    rating: string; // "productive" | "average" | "distracted" | "none"
    subject: string;
    label: string; // formatted date label
  }>;

  /** Reflection completion rate per day — how many sessions that day had a reflection */
  dailyReflectionRate: Array<{
    date: string;
    label: string;
    rate: number; // 0–100%, rounded to 1 decimal
    reflected: number; // sessions with reflection
    total: number; // total sessions
  }>;

  /** Cumulative hours studied (running total across the range) */
  cumulativeHours: Array<{
    date: string;
    label: string;
    hours: number; // cumulative total up to and including this date
    dailyHours: number; // just this day's hours
  }>;

  /** Average study hours by day of week across the entire range */
  avgHoursByDayOfWeek: Array<{
    day: string; // "Mon", "Tue", etc.
    avgHours: number; // rounded to 2 decimals
    totalHours: number; // sum for all occurrences of that weekday in range
    occurrences: number; // how many times that weekday appeared in range
  }>;

  /** Per-subject: total hours studied AND reflection count side by side */
  subjectHoursAndReflections: Array<{
    subject: string;
    hours: number; // rounded to 2 decimals
    reflections: number; // number of reflected sessions for that subject
    reflectionRate: number; // reflections / total sessions * 100
  }>;

  /** Reflection comment word count distribution (shows how much effort users put in) */
  reflectionWordCountDistribution: Array<{
    bucket: string; // "No comment" | "1–10 words" | "11–30 words" | "30+ words"
    count: number;
  }>;

  /** Hours studied per week in the range (for weekly progress view) */
  weeklyHours: Array<{
    week: string; // ISO date of Monday
    label: string; // "Mar 10" style
    hours: number; // rounded to 2 decimals
  }>;
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
  allSessionEndDates,
}: AnalyticsRangeInput): AnalyticsRange => {
  const todayIso = toLocalIsoDate(now);

  if (preset === "week") {
    const weekStart = toLocalIsoDate(startOfWeek(now));
    const weekEnd = addDays(weekStart, 6);
    return { preset, startIso: weekStart, endIso: weekEnd };
  }

  if (preset === "month") {
    const monthStart = toLocalIsoDate(startOfMonth(now));
    const monthEnd = toLocalIsoDate(endOfMonth(now));
    return { preset, startIso: monthStart, endIso: monthEnd };
  }

  if (preset === "last30") {
    return { preset, startIso: addDays(todayIso, -29), endIso: todayIso };
  }

  if (preset === "last90") {
    return { preset, startIso: addDays(todayIso, -89), endIso: todayIso };
  }

  if (preset === "last365") {
    return { preset, startIso: addDays(todayIso, -364), endIso: todayIso };
  }

  if (preset === "all") {
    // Find the earliest session date from the provided dates array.
    // This ensures "All Time" always covers 100% of the user's stored data.
    let earliestIso = addDays(todayIso, -364); // sensible fallback if no sessions
    if (allSessionEndDates && allSessionEndDates.length > 0) {
      const validDates = allSessionEndDates
        .map((d) => toLocalIsoDate(new Date(d)))
        .filter((d) => /^\\d{4}-\\d{2}-\\d{2}$/.test(d))
        .sort((a, b) => a.localeCompare(b));
      if (validDates.length > 0 && validDates[0]) {
        earliestIso = validDates[0];
      }
    }
    return { preset, startIso: earliestIso, endIso: todayIso };
  }

  // custom
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

  // ── NEW: Reflection & Hours computations ─────────────────────────────────

  // Helper: count words in a reflection comment
  const wordCount = (text: string): number => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  // hoursWithReflectionTimeline — per day
  const sessionsByDay = new Map<string, StudySession[]>();
  filteredSessions.forEach((session) => {
    const dayIso = localIsoFromDateTime(session.endedAt);
    const arr = sessionsByDay.get(dayIso) ?? [];
    arr.push(session);
    sessionsByDay.set(dayIso, arr);
  });

  const hoursWithReflectionTimeline = allDays.map((iso) => {
    const daySessions = sessionsByDay.get(iso) ?? [];
    const totalMs = daySessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
    const hours = roundToTenth(totalMs / 3_600_000);
    const reflectedSessions = daySessions.filter((s) => sessionPoints(s) !== null);
    return {
      date: iso,
      label: formatDateLabel(iso),
      hours,
      hasReflection: reflectedSessions.length > 0,
      reflectionCount: reflectedSessions.length,
    };
  });

  // sessionDurationVsReflection — scatter-style data
  const sessionDurationVsReflection = filteredSessions.map((session) => {
    const rating = sessionRating(session);
    const subject = session.subjectId
      ? (subjectsById.get(session.subjectId) ?? "Unassigned")
      : "Unassigned";
    return {
      sessionId: session.id,
      minutes: safeSessionMinutes(session),
      rating: rating ?? "none",
      subject,
      label: formatDateLabel(localIsoFromDateTime(session.endedAt)),
    };
  });

  // dailyReflectionRate
  const dailyReflectionRate = allDays.map((iso) => {
    const daySessions = sessionsByDay.get(iso) ?? [];
    const total = daySessions.length;
    const reflected = daySessions.filter((s) => sessionPoints(s) !== null).length;
    const rate = total > 0 ? roundToTenth((reflected / total) * 100) : 0;
    return { date: iso, label: formatDateLabel(iso), rate, reflected, total };
  });

  // cumulativeHours
  let runningHoursTotal = 0;
  const cumulativeHours = allDays.map((iso) => {
    const daySessions = sessionsByDay.get(iso) ?? [];
    const dailyMs = daySessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
    const dailyHours = roundToTenth(dailyMs / 3_600_000);
    runningHoursTotal = roundToTenth(runningHoursTotal + dailyHours);
    return {
      date: iso,
      label: formatDateLabel(iso),
      hours: runningHoursTotal,
      dailyHours,
    };
  });

  // avgHoursByDayOfWeek
  const DOW_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowHoursMap = new Map<number, { total: number; occurrences: number }>();
  for (let d = 0; d < 7; d++) dowHoursMap.set(d, { total: 0, occurrences: 0 });
  allDays.forEach((iso) => {
    const dow = new Date(`${iso}T00:00:00`).getDay();
    const daySessions = sessionsByDay.get(iso) ?? [];
    const dailyMs = daySessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
    const dailyHours = dailyMs / 3_600_000;
    const entry = dowHoursMap.get(dow)!;
    entry.total = roundToTenth(entry.total + dailyHours);
    entry.occurrences += 1;
  });
  const avgHoursByDayOfWeek = Array.from(dowHoursMap.entries()).map(([d, v]) => ({
    day: DOW_LABELS_SHORT[d],
    avgHours: v.occurrences > 0 ? roundToTenth(v.total / v.occurrences) : 0,
    totalHours: v.total,
    occurrences: v.occurrences,
  }));

  // subjectHoursAndReflections
  const subjectHoursMap = new Map<string, { ms: number; total: number; reflected: number }>();
  filteredSessions.forEach((session) => {
    const subject = session.subjectId
      ? (subjectsById.get(session.subjectId) ?? "Unassigned")
      : "Unassigned";
    const entry = subjectHoursMap.get(subject) ?? { ms: 0, total: 0, reflected: 0 };
    entry.ms += session.durationMs ?? 0;
    entry.total += 1;
    if (sessionPoints(session) !== null) entry.reflected += 1;
    subjectHoursMap.set(subject, entry);
  });
  const subjectHoursAndReflections = Array.from(subjectHoursMap.entries())
    .map(([subject, v]) => ({
      subject,
      hours: roundToTenth(v.ms / 3_600_000),
      reflections: v.reflected,
      reflectionRate: v.total > 0 ? roundToTenth((v.reflected / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  // reflectionWordCountDistribution
  const wordBuckets = new Map<string, number>([
    ["No comment", 0],
    ["1–10 words", 0],
    ["11–30 words", 0],
    ["30+ words", 0],
  ]);
  filteredSessions.forEach((session) => {
    if (sessionPoints(session) === null) return; // only sessions WITH reflections
    const comment = (session.reflectionComment ?? session.reflection ?? "").trim();
    const wc = wordCount(comment);
    if (wc === 0) wordBuckets.set("No comment", (wordBuckets.get("No comment") ?? 0) + 1);
    else if (wc <= 10) wordBuckets.set("1–10 words", (wordBuckets.get("1–10 words") ?? 0) + 1);
    else if (wc <= 30) wordBuckets.set("11–30 words", (wordBuckets.get("11–30 words") ?? 0) + 1);
    else wordBuckets.set("30+ words", (wordBuckets.get("30+ words") ?? 0) + 1);
  });
  const reflectionWordCountDistribution = Array.from(wordBuckets.entries()).map(
    ([bucket, count]) => ({ bucket, count }),
  );

  // weeklyHours
  const weekHoursMap = new Map<string, number>();
  filteredSessions.forEach((session) => {
    const endIso = localIsoFromDateTime(session.endedAt);
    const wk = weekStartIso(endIso);
    weekHoursMap.set(
      wk,
      roundToTenth((weekHoursMap.get(wk) ?? 0) + (session.durationMs ?? 0) / 3_600_000),
    );
  });
  const weeklyHours = Array.from(weekHoursMap.entries())
    .map(([week, hours]) => ({ week, label: formatDateLabel(week), hours: roundToTenth(hours) }))
    .sort((a, b) => a.week.localeCompare(b.week));

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
    hoursWithReflectionTimeline,
    sessionDurationVsReflection,
    dailyReflectionRate,
    cumulativeHours,
    avgHoursByDayOfWeek,
    subjectHoursAndReflections,
    reflectionWordCountDistribution,
    weeklyHours,
  };
};
