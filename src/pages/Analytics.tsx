import { useState } from 'react';
import { BarChart3, Clock, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { MonthlyChart } from '@/components/MonthlyChart';
import { SubjectChart } from '@/components/SubjectChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTasks } from '@/hooks/useTasks';
import { useCategories } from '@/hooks/useCategories';
import { formatTimeShort, formatTime, getSubjectStats, getAvailableMonths, getMonthName, getLast6MonthsData, getMonthComparison, getCategoryStats, getTaskTimeStats } from '@/lib/stats';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const CHART_COLORS = [
  'hsl(158 64% 40%)', 'hsl(38 92% 55%)', 'hsl(200 70% 50%)',
  'hsl(280 60% 55%)', 'hsl(330 70% 55%)', 'hsl(142 72% 45%)',
  'hsl(15 80% 55%)', 'hsl(258 60% 55%)',
];

const AnalyticsPage = () => {
  const { isRunning, sessions } = useStudyTimer();
  const { tasks } = useTasks();
  const { categoryNames } = useCategories();
  const availableMonths = getAvailableMonths(sessions);
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '');

  const subjectStats = getSubjectStats(sessions, selectedMonth);
  const allTimeSubjectStats = getSubjectStats(sessions);
  const last6Months = getLast6MonthsData(sessions);
  const monthComparison = getMonthComparison(sessions);
  const categoryStats = getCategoryStats(sessions);
  const taskTimeStats = getTaskTimeStats(sessions);

  const totalMonthTime = subjectStats.reduce((sum, s) => sum + s.totalTime, 0);
  const totalSessions = subjectStats.reduce((sum, s) => sum + s.sessionCount, 0);
  const overallAverage = totalSessions > 0 ? Math.round(totalMonthTime / totalSessions) : 0;

  // Map task IDs to names for display
  const taskNameMap = new Map(tasks.map((t) => [t.id, t.title]));

  // Category total time from tasks (accumulated)
  const categoryTaskTotals = categoryNames.map((cat) => ({
    category: cat,
    totalTime: tasks.filter((t) => t.category === cat).reduce((s, t) => s + (t.accumulatedTime || 0), 0),
  })).filter((c) => c.totalTime > 0);

  // Prepare category chart data from sessions
  const categoryChartData = categoryStats.map((c) => ({
    name: c.category,
    hours: parseFloat((c.totalTime / 3600).toFixed(1)),
    seconds: c.totalTime,
  }));

  // Prepare task chart data (top 10)
  const taskChartData = taskTimeStats.slice(0, 10).map((t) => ({
    name: taskNameMap.get(t.taskId) || 'Unknown Task',
    hours: parseFloat((t.totalTime / 3600).toFixed(1)),
    seconds: t.totalTime,
  }));

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2">Analytics</h1>
              <p className="text-muted-foreground">Detailed insights into your study patterns</p>
            </div>

            {availableMonths.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>{getMonthName(month)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-display font-semibold text-xl mb-2">No study data yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start using the study timer to track your sessions. Your analytics will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Monthly Comparison Banner */}
              <div className="stat-card mb-6">
                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg">Monthly Comparison</h3>
                    <p className="text-muted-foreground text-sm">Current month vs previous month</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Last Month</p>
                      <p className="font-display text-xl font-bold">{formatTimeShort(monthComparison.lastMonth) || '0m'}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${monthComparison.isIncrease ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {monthComparison.isIncrease ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="font-medium">{monthComparison.percentChange}%</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">This Month</p>
                      <p className="font-display text-xl font-bold">{formatTimeShort(monthComparison.currentMonth) || '0m'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Month Overview Stats */}
              {selectedMonth && (
                <div className="grid gap-4 md:gap-6 md:grid-cols-3 mb-6">
                  <div className="stat-card">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Total Time</span>
                      </div>
                      <p className="font-display text-2xl font-bold">{formatTimeShort(totalMonthTime) || '0m'}</p>
                      <p className="text-sm text-muted-foreground">{getMonthName(selectedMonth)}</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Sessions</span>
                      </div>
                      <p className="font-display text-2xl font-bold">{totalSessions}</p>
                      <p className="text-sm text-muted-foreground">study sessions</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Avg. Session</span>
                      </div>
                      <p className="font-display text-2xl font-bold">{formatTimeShort(overallAverage) || '0m'}</p>
                      <p className="text-sm text-muted-foreground">per session</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 mb-6">
                <MonthlyChart data={last6Months} />
                <SubjectChart data={selectedMonth ? subjectStats : allTimeSubjectStats} />
              </div>

              {/* NEW: Time by Tab & Time by Task Charts */}
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 mb-6">
                {/* Time by Tab Chart */}
                <div className="stat-card">
                  <div className="relative z-10">
                    <h3 className="font-display font-semibold mb-4">Time by Tab</h3>
                    {categoryChartData.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">No session data with tabs yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={categoryChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                            formatter={(value: number, name: string, props: any) => [formatTimeShort(props.payload.seconds), 'Time']}
                          />
                          <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                            {categoryChartData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Time by Task Chart */}
                <div className="stat-card">
                  <div className="relative z-10">
                    <h3 className="font-display font-semibold mb-4">Time by Task (Top 10)</h3>
                    {taskChartData.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">No task-linked sessions yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={taskChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Hours', position: 'insideBottom', offset: -5, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                            formatter={(value: number, name: string, props: any) => [formatTimeShort(props.payload.seconds), 'Time']}
                          />
                          <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                            {taskChartData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Total Time from Tasks */}
              {categoryTaskTotals.length > 0 && (
                <div className="stat-card mb-6">
                  <div className="relative z-10">
                    <h3 className="font-display font-semibold mb-4">Total Accumulated Time by Tab</h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      {categoryTaskTotals.map((ct) => (
                        <div key={ct.category} className="p-3 rounded-lg bg-secondary/50 border">
                          <p className="text-sm text-muted-foreground">{ct.category}</p>
                          <p className="font-display text-xl font-bold font-mono text-primary">{formatTime(ct.totalTime)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Subject Breakdown Table */}
              {subjectStats.length > 0 && (
                <div className="stat-card">
                  <div className="relative z-10">
                    <h3 className="font-display font-semibold mb-4">Subject Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total Time</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Sessions</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg. per Session</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectStats.map((stat) => (
                            <tr key={stat.subject} className="border-b border-border/50 last:border-0">
                              <td className="py-3 px-4 font-medium">{stat.subject}</td>
                              <td className="py-3 px-4 text-right">{formatTimeShort(stat.totalTime)}</td>
                              <td className="py-3 px-4 text-right">{stat.sessionCount}</td>
                              <td className="py-3 px-4 text-right text-muted-foreground">{formatTimeShort(stat.averageTime)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;
