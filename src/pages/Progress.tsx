import { useState } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Pencil, Check } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useStudyGoals } from '@/hooks/useStudyGoals';
import {
  formatGoalProgress, getWeeklyStudyTime, getMonthlyStudyTime, getYearlyStudyTime,
  getWeeklyProductivityScore, getLastWeekProductivityScore, getMonthlyProductivityScore,
  getProductivityTrendInsight, getWeeklyProductivityTrend,
} from '@/lib/stats';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ProgressPage = () => {
  const { isRunning, sessions } = useStudyTimer();
  const { goals, updateGoals } = useStudyGoals();
  const [editing, setEditing] = useState(false);
  const [editWeekly, setEditWeekly] = useState(goals.weeklyHours.toString());
  const [editMonthly, setEditMonthly] = useState(goals.monthlyHours.toString());
  const [editYearly, setEditYearly] = useState(goals.yearlyHours.toString());

  const weeklyTime = getWeeklyStudyTime(sessions);
  const monthlyTime = getMonthlyStudyTime(sessions);
  const yearlyTime = getYearlyStudyTime(sessions);

  const weeklyPercent = goals.weeklyHours > 0 ? Math.min(100, Math.round((weeklyTime / (goals.weeklyHours * 3600)) * 100)) : 0;
  const monthlyPercent = goals.monthlyHours > 0 ? Math.min(100, Math.round((monthlyTime / (goals.monthlyHours * 3600)) * 100)) : 0;
  const yearlyPercent = goals.yearlyHours > 0 ? Math.min(100, Math.round((yearlyTime / (goals.yearlyHours * 3600)) * 100)) : 0;

  const weekScore = getWeeklyProductivityScore(sessions);
  const lastWeekScore = getLastWeekProductivityScore(sessions);
  const monthScore = getMonthlyProductivityScore(sessions);
  const insight = getProductivityTrendInsight(weekScore, lastWeekScore);
  const trendData = getWeeklyProductivityTrend(sessions);

  const handleSaveGoals = () => {
    updateGoals({
      weeklyHours: Math.max(1, parseInt(editWeekly) || 20),
      monthlyHours: Math.max(1, parseInt(editMonthly) || 80),
      yearlyHours: Math.max(1, parseInt(editYearly) || 900),
    });
    setEditing(false);
  };

  const progressBars = [
    { label: 'Weekly Progress', time: weeklyTime, goal: goals.weeklyHours, percent: weeklyPercent },
    { label: 'Monthly Progress', time: monthlyTime, goal: goals.monthlyHours, percent: monthlyPercent },
    { label: 'Yearly Progress', time: yearlyTime, goal: goals.yearlyHours, percent: yearlyPercent },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              Progress
            </h1>
            <p className="text-muted-foreground">Track your goals and productivity trends</p>
          </div>

          {/* Goal Setting */}
          <div className="stat-card mb-6">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg">Study Goals</h3>
                {editing ? (
                  <Button size="sm" onClick={handleSaveGoals} className="gradient-primary border-0">
                    <Check className="w-4 h-4 mr-1" /> Save
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditWeekly(goals.weeklyHours.toString());
                    setEditMonthly(goals.monthlyHours.toString());
                    setEditYearly(goals.yearlyHours.toString());
                    setEditing(true);
                  }}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit Goals
                  </Button>
                )}
              </div>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Weekly (hours)</label>
                    <Input type="number" value={editWeekly} onChange={(e) => setEditWeekly(e.target.value)} min="1" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Monthly (hours)</label>
                    <Input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} min="1" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Yearly (hours)</label>
                    <Input type="number" value={editYearly} onChange={(e) => setEditYearly(e.target.value)} min="1" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: 'Weekly', value: goals.weeklyHours },
                    { label: 'Monthly', value: goals.monthlyHours },
                    { label: 'Yearly', value: goals.yearlyHours },
                  ].map((g) => (
                    <div key={g.label} className="p-3 rounded-lg bg-secondary/50 border text-center">
                      <p className="text-sm text-muted-foreground">{g.label} Goal</p>
                      <p className="font-display text-xl font-bold">{g.value}h</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Progress Bars */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {progressBars.map((p) => (
              <div key={p.label} className="stat-card">
                <div className="relative z-10">
                  <h4 className="font-medium text-sm mb-3">{p.label}</h4>
                  <Progress value={p.percent} className="h-3 mb-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{formatGoalProgress(p.time, p.goal)}</span>
                    <span className="font-semibold">{p.percent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Productivity Trends */}
          <div className="stat-card mb-6">
            <div className="relative z-10">
              <h3 className="font-display font-semibold text-lg mb-4">Productivity Trends</h3>

              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="p-3 rounded-lg bg-secondary/50 border text-center">
                  <p className="text-sm text-muted-foreground">This Week Avg</p>
                  <p className="font-display text-xl font-bold">{weekScore > 0 ? weekScore.toFixed(1) : '—'}<span className="text-sm text-muted-foreground">/3</span></p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border text-center">
                  <p className="text-sm text-muted-foreground">Last Week Avg</p>
                  <p className="font-display text-xl font-bold">{lastWeekScore > 0 ? lastWeekScore.toFixed(1) : '—'}<span className="text-sm text-muted-foreground">/3</span></p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border text-center">
                  <p className="text-sm text-muted-foreground">This Month Avg</p>
                  <p className="font-display text-xl font-bold">{monthScore > 0 ? monthScore.toFixed(1) : '—'}<span className="text-sm text-muted-foreground">/3</span></p>
                </div>
              </div>

              {/* Insight */}
              <div className={cn(
                'p-4 rounded-xl border flex items-center gap-3 mb-6',
                insight.type === 'up' && 'bg-success/10 border-success/30',
                insight.type === 'down' && 'bg-destructive/10 border-destructive/30',
                insight.type === 'stable' && 'bg-secondary/50 border-border',
              )}>
                {insight.type === 'up' && <TrendingUp className="w-5 h-5 text-success flex-shrink-0" />}
                {insight.type === 'down' && <TrendingDown className="w-5 h-5 text-destructive flex-shrink-0" />}
                {insight.type === 'stable' && <Minus className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                <p className="text-sm font-medium">{insight.message}</p>
              </div>

              {/* Trend Chart */}
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 3]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                      formatter={(value: number) => [value.toFixed(2), 'Score']}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;
