import { Clock, BookOpen, Target, TrendingUp } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { StudyTimer } from '@/components/StudyTimer';
import { StatCard } from '@/components/StatCard';
import { MonthlyChart } from '@/components/MonthlyChart';
import { SubjectChart } from '@/components/SubjectChart';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTasks } from '@/hooks/useTasks';
import { formatTimeShort, getTodayStats, getWeekStats, getMonthComparison, getLast6MonthsData, getSubjectStats } from '@/lib/stats';

const Index = () => {
  const {
    displayTime,
    isRunning,
    currentSubject,
    sessions,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
  } = useStudyTimer();

  const { activeTasks, completedTasks } = useTasks();

  const todayStats = getTodayStats(sessions);
  const weekStats = getWeekStats(sessions);
  const monthComparison = getMonthComparison(sessions);
  const last6Months = getLast6MonthsData(sessions);
  const subjectStats = getSubjectStats(sessions);

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Track your study progress and stay focused</p>
          </div>

          {/* Timer and Stats Grid */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <StudyTimer
              displayTime={displayTime}
              isRunning={isRunning}
              currentSubject={currentSubject}
              onStart={startTimer}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onStop={stopTimer}
            />

            <StatCard
              title="Today"
              value={formatTimeShort(todayStats.totalTime) || '0m'}
              subtitle={`${todayStats.sessionCount} sessions`}
              icon={Clock}
            />

            <StatCard
              title="This Week"
              value={formatTimeShort(weekStats.totalTime) || '0m'}
              subtitle={`${weekStats.sessionCount} sessions`}
              icon={BookOpen}
            />
          </div>

          {/* Monthly Comparison */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <StatCard
              title="This Month"
              value={formatTimeShort(monthComparison.currentMonth) || '0m'}
              subtitle="vs last month"
              icon={Target}
              trend={
                monthComparison.lastMonth > 0 || monthComparison.currentMonth > 0
                  ? { value: monthComparison.percentChange, isPositive: monthComparison.isIncrease }
                  : undefined
              }
            />

            <StatCard
              title="Active Tasks"
              value={activeTasks.length.toString()}
              subtitle={`${completedTasks.length} completed`}
              icon={TrendingUp}
            />

            <div className="stat-card md:col-span-1">
              <div className="relative z-10">
                <h3 className="font-display font-semibold mb-2">Monthly Change</h3>
                <div className="flex items-baseline gap-2">
                  <span className={`font-display text-2xl font-bold ${monthComparison.isIncrease ? 'text-success' : 'text-destructive'}`}>
                    {monthComparison.isIncrease ? '+' : ''}{formatTimeShort(Math.abs(monthComparison.difference)) || '0m'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {monthComparison.isIncrease ? 'more' : 'less'} than last month
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2">
            <MonthlyChart data={last6Months} />
            <SubjectChart data={subjectStats} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;