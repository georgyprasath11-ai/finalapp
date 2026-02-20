import { MAX_PRODUCTIVE_MINUTES_PER_DAY } from "@/lib/constants";
import { AppAnalytics, StudySession, Subject, UserData } from "@/types/models";
import { formatDateLabel } from "@/utils/format";

const pad = (value: number): string => value.toString().padStart(2, "0");

const localIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toLocalIsoFromDateTime = (isoDateTime: string): string => localIsoDate(new Date(isoDateTime));

const startOfWeek = (base = new Date()): Date => {
  const date = new Date(base);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (base = new Date()): Date => {
  const date = new Date(base);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const sumDuration = (sessions: StudySession[]): number => sessions.reduce((sum, session) => sum + session.durationMs, 0);

export const sumTodayStudyMs = (sessions: StudySession[]): number => {
  const today = localIsoDate(new Date());
  return sessions
    .filter((session) => toLocalIsoFromDateTime(session.endedAt) === today)
    .reduce((sum, session) => sum + session.durationMs, 0);
};

export const productivityPercent = (todayStudyMs: number): number => {
  const totalMinutes = todayStudyMs / 60000;
  const ratio = (totalMinutes / MAX_PRODUCTIVE_MINUTES_PER_DAY) * 100;
  return Math.min(100, Math.max(0, ratio));
};

export interface DailyConsistencyPoint {
  date: string;
  label: string;
  minutes: number;
  movingAverageMinutes: number;
}

export const consistencySeries = (sessions: StudySession[], days = 14): DailyConsistencyPoint[] => {
  const today = new Date();
  const dayMap = new Map<string, number>();

  sessions.forEach((session) => {
    const key = toLocalIsoFromDateTime(session.endedAt);
    dayMap.set(key, (dayMap.get(key) ?? 0) + session.durationMs);
  });

  const points: DailyConsistencyPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const key = localIsoDate(day);
    const minutes = Math.round((dayMap.get(key) ?? 0) / 60000);
    points.push({
      date: key,
      label: formatDateLabel(key),
      minutes,
      movingAverageMinutes: 0,
    });
  }

  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 6), index + 1);
    const average = window.reduce((sum, item) => sum + item.minutes, 0) / window.length;
    return {
      ...point,
      movingAverageMinutes: Number(average.toFixed(1)),
    };
  });
};

export interface SubjectDistributionPoint {
  subjectId: string;
  subject: string;
  minutes: number;
  color: string;
}

export const subjectDistribution = (
  sessions: StudySession[],
  subjects: Subject[],
): SubjectDistributionPoint[] => {
  const map = new Map<string, number>();
  sessions.forEach((session) => {
    const key = session.subjectId ?? "unassigned";
    map.set(key, (map.get(key) ?? 0) + session.durationMs);
  });

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  return Array.from(map.entries())
    .map(([subjectId, ms]) => {
      const subject = subjectById.get(subjectId);
      return {
        subjectId,
        subject: subject?.name ?? "Unassigned",
        minutes: Math.round(ms / 60000),
        color: subject?.color ?? "#64748b",
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
};

export interface MonthlyPoint {
  month: string;
  label: string;
  minutes: number;
}

export const monthlySeries = (sessions: StudySession[], months = 6): MonthlyPoint[] => {
  const now = new Date();
  const map = new Map<string, number>();

  sessions.forEach((session) => {
    const end = new Date(session.endedAt);
    const key = `${end.getFullYear()}-${pad(end.getMonth() + 1)}`;
    map.set(key, (map.get(key) ?? 0) + session.durationMs);
  });

  const points: MonthlyPoint[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const monthDate = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -index);
    const key = `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1)}`;
    const label = monthDate.toLocaleDateString([], { month: "short" });

    points.push({
      month: key,
      label,
      minutes: Math.round((map.get(key) ?? 0) / 60000),
    });
  }

  return points;
};

const dateTotalMap = (sessions: StudySession[]): Map<string, number> => {
  const map = new Map<string, number>();
  sessions.forEach((session) => {
    const date = toLocalIsoFromDateTime(session.endedAt);
    map.set(date, (map.get(date) ?? 0) + session.durationMs);
  });
  return map;
};

const streakDays = (sessions: StudySession[]): number => {
  const map = dateTotalMap(sessions);
  let streak = 0;
  let pointer = new Date();

  while (true) {
    const key = localIsoDate(pointer);
    if ((map.get(key) ?? 0) <= 0) {
      break;
    }
    streak += 1;
    pointer = addDays(pointer, -1);
  }

  return streak;
};

const bestDay = (sessions: StudySession[]): { label: string; minutes: number } => {
  const map = dateTotalMap(sessions);
  let bestDate = "";
  let bestValue = 0;

  map.forEach((value, date) => {
    if (value > bestValue) {
      bestValue = value;
      bestDate = date;
    }
  });

  if (!bestDate) {
    return { label: "No study day yet", minutes: 0 };
  }

  return {
    label: formatDateLabel(bestDate),
    minutes: Math.round(bestValue / 60000),
  };
};

const between = (sessions: StudySession[], start: Date, endExclusive: Date): StudySession[] =>
  sessions.filter((session) => {
    const ts = new Date(session.endedAt).getTime();
    return ts >= start.getTime() && ts < endExclusive.getTime();
  });

export const computeAnalytics = (data: UserData): AppAnalytics => {
  const todayStudyMs = sumTodayStudyMs(data.sessions);
  const weeklyStart = startOfWeek(new Date());
  const previousWeeklyStart = addDays(weeklyStart, -7);
  const monthlyStart = startOfMonth(new Date());
  const previousMonthlyStart = addMonths(monthlyStart, -1);

  const weeklyTotalMs = sumDuration(between(data.sessions, weeklyStart, addDays(weeklyStart, 7)));
  const previousWeekTotalMs = sumDuration(between(data.sessions, previousWeeklyStart, weeklyStart));
  const monthlyTotalMs = sumDuration(
    between(data.sessions, monthlyStart, addMonths(monthlyStart, 1)),
  );
  const previousMonthTotalMs = sumDuration(
    between(data.sessions, previousMonthlyStart, monthlyStart),
  );

  const best = bestDay(data.sessions);

  return {
    todayStudyMs,
    productivityPercent: productivityPercent(todayStudyMs),
    streakDays: streakDays(data.sessions),
    bestDayLabel: best.label,
    bestDayMinutes: best.minutes,
    weeklyTotalMs,
    previousWeekTotalMs,
    monthlyTotalMs,
    previousMonthTotalMs,
  };
};
