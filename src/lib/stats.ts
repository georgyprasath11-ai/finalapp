import { StudySession, MonthlyStats } from '@/types/study';

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatTimeShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
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
      monthlyMap.set(monthKey, {
        month: monthKey,
        totalTime: 0,
        sessionCount: 0,
        subjectBreakdown: {},
      });
    }

    const stats = monthlyMap.get(monthKey)!;
    stats.totalTime += session.duration;
    stats.sessionCount += 1;
    stats.subjectBreakdown[session.subject] = 
      (stats.subjectBreakdown[session.subject] || 0) + session.duration;
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

export function getTodayStats(sessions: StudySession[]) {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.date === today);
  
  return {
    totalTime: todaySessions.reduce((sum, s) => sum + s.duration, 0),
    sessionCount: todaySessions.length,
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

  return {
    currentMonth: currentTotal,
    lastMonth: lastTotal,
    difference,
    percentChange,
    isIncrease: difference >= 0,
  };
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
