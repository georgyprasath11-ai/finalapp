import { StudySession, MonthlyStats, SessionRating } from '@/types/study';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';

const MAX_DAILY_SECONDS = 15 * 3600; // 15 hours

/**
 * Display format: "2h 3m 5s", "3m 5s", "45s", "1h 5s"
 * No leading zeros, always show seconds.
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function formatTimeShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export function formatGoalProgress(currentSeconds: number, goalHours: number): string {
  const currentHours = Math.round(currentSeconds / 3600);
  return `${currentHours}h / ${goalHours}h`;
}

export function getMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function calculateMonthlyStats(sessions: StudySession[]): MonthlyStats[] {
  const monthlyMap = new Map<string, MonthlyStats>();
  sessions.forEach((session) => {
    const monthKey = getMonthKey(session.date);
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { month: monthKey, totalTime: 0, sessionCount: 0, subjectBreakdown: {} });
    }
    const stats = monthlyMap.get(monthKey)!;
    stats.totalTime += session.duration;
    stats.sessionCount += 1;
    stats.subjectBreakdown[session.subject] = (stats.subjectBreakdown[session.subject] || 0) + session.duration;
  });
  return Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));
}

export function getSubjectStats(sessions: StudySession[], monthKey?: string) {
  const filteredSessions = monthKey
    ? sessions.filter((s) => getMonthKey(s.date) === monthKey)
    : sessions;
  const subjectMap = new Map<string, { totalTime: number; sessionCount: number }>();
  filteredSessions.forEach((session) => {
    if (!subjectMap.has(session.subject)) {
      subjectMap.set(session.subject, { totalTime: 0, sessionCount: 0 });
    }
    const stats = subjectMap.get(session.subject)!;
    stats.totalTime += session.duration;
    stats.sessionCount += 1;
  });
  return Array.from(subjectMap.entries()).map(([subject, stats]) => ({
    subject,
    totalTime: stats.totalTime,
    sessionCount: stats.sessionCount,
    averageTime: stats.sessionCount > 0 ? Math.round(stats.totalTime / stats.sessionCount) : 0,
  })).sort((a, b) => b.totalTime - a.totalTime);
}

export function getCategoryStats(sessions: StudySession[]) {
  const catMap = new Map<string, number>();
  sessions.forEach((s) => {
    const cat = s.category || 'Uncategorized';
    catMap.set(cat, (catMap.get(cat) || 0) + s.duration);
  });
  return Array.from(catMap.entries())
    .map(([category, totalTime]) => ({ category, totalTime }))
    .sort((a, b) => b.totalTime - a.totalTime);
}

export function getTaskTimeStats(sessions: StudySession[]) {
  const taskMap = new Map<string, { taskId: string; totalTime: number; subject: string; category: string }>();
  sessions.forEach((s) => {
    if (!s.taskId) return;
    if (!taskMap.has(s.taskId)) {
      taskMap.set(s.taskId, { taskId: s.taskId, totalTime: 0, subject: s.subject, category: s.category || '' });
    }
    taskMap.get(s.taskId)!.totalTime += s.duration;
  });
  return Array.from(taskMap.values()).sort((a, b) => b.totalTime - a.totalTime);
}

export function getTodayStats(sessions: StudySession[]) {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.date === today);
  return {
    totalTime: todaySessions.reduce((sum, s) => sum + s.duration, 0),
    sessionCount: todaySessions.length,
  };
}

export function getDateStats(sessions: StudySession[], dateStr: string) {
  const dateSessions = sessions.filter((s) => s.date === dateStr);
  return {
    totalTime: dateSessions.reduce((sum, s) => sum + s.duration, 0),
    sessionCount: dateSessions.length,
  };
}

export function getWeekStats(sessions: StudySession[]) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekAgo);
  return {
    totalTime: weekSessions.reduce((sum, s) => sum + s.duration, 0),
    sessionCount: weekSessions.length,
  };
}

export function getProductivity(totalSeconds: number): { percent: number; color: string; label: string } {
  const percent = Math.min(100, Math.round((totalSeconds / MAX_DAILY_SECONDS) * 100));
  if (percent >= 75) return { percent, color: 'hsl(142 72% 45%)', label: 'Excellent' };
  if (percent >= 40) return { percent, color: 'hsl(38 92% 55%)', label: 'Good' };
  return { percent, color: 'hsl(0 72% 55%)', label: 'Needs Improvement' };
}

export function getStudyComparison(sessions: StudySession[]) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  const todayTotal = getDateStats(sessions, today).totalTime;
  const yesterdayTotal = getDateStats(sessions, yesterday).totalTime;

  let weekTotal = 0;
  let weekDays = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
    const dayTotal = getDateStats(sessions, d).totalTime;
    weekTotal += dayTotal;
    weekDays++;
  }
  const weekAvg = weekDays > 0 ? Math.round(weekTotal / weekDays) : 0;

  const monthKey = getMonthKey(now);
  const monthSessions = sessions.filter((s) => getMonthKey(s.date) === monthKey && s.date !== today);
  const uniqueDays = new Set(monthSessions.map((s) => s.date)).size;
  const monthTotal = monthSessions.reduce((sum, s) => sum + s.duration, 0);
  const monthAvg = uniqueDays > 0 ? Math.round(monthTotal / uniqueDays) : 0;

  return {
    todayTotal,
    vsYesterday: todayTotal - yesterdayTotal,
    vsWeekAvg: todayTotal - weekAvg,
    vsMonthAvg: todayTotal - monthAvg,
  };
}

export function getMonthComparison(sessions: StudySession[]) {
  const now = new Date();
  const currentMonth = getMonthKey(now);
  const lastMonth = getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1));
  const currentMonthSessions = sessions.filter((s) => getMonthKey(s.date) === currentMonth);
  const lastMonthSessions = sessions.filter((s) => getMonthKey(s.date) === lastMonth);
  const currentTotal = currentMonthSessions.reduce((sum, s) => sum + s.duration, 0);
  const lastTotal = lastMonthSessions.reduce((sum, s) => sum + s.duration, 0);
  const difference = currentTotal - lastTotal;
  const percentChange = lastTotal > 0 ? Math.round((difference / lastTotal) * 100) : currentTotal > 0 ? 100 : 0;
  return { currentMonth: currentTotal, lastMonth: lastTotal, difference, percentChange, isIncrease: difference >= 0 };
}

export function getLast6MonthsData(sessions: StudySession[]) {
  const months: { month: string; name: string; totalTime: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = getMonthKey(date);
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const monthSessions = sessions.filter((s) => getMonthKey(s.date) === monthKey);
    const totalTime = monthSessions.reduce((sum, s) => sum + s.duration, 0);
    months.push({ month: monthKey, name: monthName, totalTime });
  }
  return months;
}

export function getAvailableMonths(sessions: StudySession[]): string[] {
  const months = new Set<string>();
  sessions.forEach((s) => months.add(getMonthKey(s.date)));
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

// ---- Progress page helpers ----

export function getWeeklyStudyTime(sessions: StudySession[]): number {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  return sessions
    .filter((s) => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    })
    .reduce((sum, s) => sum + s.duration, 0);
}

export function getMonthlyStudyTime(sessions: StudySession[]): number {
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  return sessions
    .filter((s) => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: mStart, end: mEnd });
    })
    .reduce((sum, s) => sum + s.duration, 0);
}

export function getYearlyStudyTime(sessions: StudySession[]): number {
  const now = new Date();
  const yStart = startOfYear(now);
  const yEnd = endOfYear(now);
  return sessions
    .filter((s) => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: yStart, end: yEnd });
    })
    .reduce((sum, s) => sum + s.duration, 0);
}

// ---- Productivity Trends helpers ----

const RATING_VALUES: Record<SessionRating, number> = {
  productive: 3,
  average: 2,
  distracted: 1,
};

export function getWeeklyProductivityScore(sessions: StudySession[]): number {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const rated = sessions.filter((s) => {
    if (!s.rating) return false;
    const d = parseISO(s.date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });
  if (rated.length === 0) return 0;
  return rated.reduce((sum, s) => sum + RATING_VALUES[s.rating!], 0) / rated.length;
}

export function getLastWeekProductivityScore(sessions: StudySession[]): number {
  const now = new Date();
  const lastWeekEnd = new Date(startOfWeek(now, { weekStartsOn: 1 }).getTime() - 1);
  const lastWeekStart = startOfWeek(lastWeekEnd, { weekStartsOn: 1 });
  const rated = sessions.filter((s) => {
    if (!s.rating) return false;
    const d = parseISO(s.date);
    return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
  });
  if (rated.length === 0) return 0;
  return rated.reduce((sum, s) => sum + RATING_VALUES[s.rating!], 0) / rated.length;
}

export function getMonthlyProductivityScore(sessions: StudySession[]): number {
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const rated = sessions.filter((s) => {
    if (!s.rating) return false;
    const d = parseISO(s.date);
    return isWithinInterval(d, { start: mStart, end: mEnd });
  });
  if (rated.length === 0) return 0;
  return rated.reduce((sum, s) => sum + RATING_VALUES[s.rating!], 0) / rated.length;
}

export function getProductivityTrendInsight(currentWeekScore: number, lastWeekScore: number): { message: string; type: 'up' | 'down' | 'stable' } {
  if (lastWeekScore === 0 && currentWeekScore === 0) {
    return { message: 'Start rating your sessions to see productivity trends.', type: 'stable' };
  }
  if (lastWeekScore === 0) {
    return { message: 'Keep rating sessions to track your progress over time.', type: 'stable' };
  }
  const change = ((currentWeekScore - lastWeekScore) / lastWeekScore) * 100;
  if (change > 3) {
    return { message: `Your focus improved by ${Math.round(change)}% this week 📈`, type: 'up' };
  }
  if (change < -3) {
    return { message: `Focus dropped by ${Math.abs(Math.round(change))}% compared to last week.`, type: 'down' };
  }
  return { message: 'Your focus level remained stable this week.', type: 'stable' };
}

// Weekly productivity data for trend chart (last 8 weeks)
export function getWeeklyProductivityTrend(sessions: StudySession[]): { week: string; score: number }[] {
  const results: { week: string; score: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - i * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const rated = sessions.filter((s) => {
      if (!s.rating) return false;
      const d = parseISO(s.date);
      return d >= weekStart && d <= weekEnd;
    });
    const score = rated.length > 0
      ? rated.reduce((sum, s) => sum + RATING_VALUES[s.rating!], 0) / rated.length
      : 0;
    const label = `W${8 - i}`;
    results.push({ week: label, score: parseFloat(score.toFixed(2)) });
  }
  return results;
}

// Backlog priority helpers
export function getBacklogPriority(originalDate: string): { level: 'low' | 'medium' | 'high'; color: string; label: string } {
  const now = new Date();
  const orig = parseISO(originalDate);
  const days = Math.floor((now.getTime() - orig.getTime()) / 86400000);
  if (days >= 5) return { level: 'high', color: '0 72% 40%', label: 'High' };
  if (days >= 3) return { level: 'medium', color: '0 60% 55%', label: 'Medium' };
  return { level: 'low', color: '0 50% 70%', label: 'Low' };
}

// Subject stats filtered by time range
export function getSubjectStatsByRange(sessions: StudySession[], range: 'daily' | 'weekly' | 'monthly') {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (range === 'daily') {
    const today = now.toISOString().split('T')[0];
    return getSubjectStats(sessions.filter((s) => s.date === today));
  } else if (range === 'weekly') {
    start = startOfWeek(now, { weekStartsOn: 1 });
    end = endOfWeek(now, { weekStartsOn: 1 });
  } else {
    start = startOfMonth(now);
    end = endOfMonth(now);
  }
  const filtered = sessions.filter((s) => {
    const d = parseISO(s.date);
    return isWithinInterval(d, { start, end });
  });
  return getSubjectStats(filtered);
}

// Last 7 days study data for consistency chart
export function getLast7DaysData(sessions: StudySession[]): { day: string; label: string; totalTime: number }[] {
  const results: { day: string; label: string; totalTime: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const totalTime = sessions.filter((s) => s.date === dateStr).reduce((sum, s) => sum + s.duration, 0);
    results.push({ day: dateStr, label, totalTime });
  }
  return results;
}
