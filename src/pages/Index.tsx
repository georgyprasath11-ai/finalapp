import { Clock, BookOpen, Target, TrendingUp } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { StudyTimer } from '@/components/StudyTimer';
import { StatCard } from '@/components/StatCard';
import { ProductivityChart } from '@/components/ProductivityChart';
import { ComparisonBox } from '@/components/ComparisonBox';
import { MonthlyChart } from '@/components/MonthlyChart';
import { SubjectChart } from '@/components/SubjectChart';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubjects } from '@/hooks/useSubjects';
import { useTasks } from '@/hooks/useTasks';
import { formatTimeShort, getTodayStats, getWeekStats, getMonthComparison, getLast6MonthsData, getSubjectStats, getProductivity, getStudyComparison } from '@/lib/stats';

const Index = () => {
  const {
    displayTime, isRunning, currentSubject, sessions,
    startTimer, pauseTimer, resumeTimer, stopTimer, cancelTimer,
  } = useStudyTimer();
  const { subjectNames } = useSubjects();
  const { activeTasks, completedTasks } = useTasks();

  const todayStats = getTodayStats(sessions);
  const weekStats = getWeekStats(sessions);
  const monthComparison = getMonthComparison(sessions);
  const last6Months = getLast6MonthsData(sessions);
  const subjectStats = getSubjectStats(sessions);
  const productivity = getProductivity(todayStats.totalTime);
  const comparison = getStudyComparison(sessions);

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Track your study progress and stay focused</p>
          </div>

          {/* Timer + Productivity + Comparison */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <StudyTimer
              displayTime={displayTime}
              isRunning={isRunning}
              currentSubject={currentSubject}
              subjectNames={subjectNames}
              onStart={startTimer}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onStop={stopTimer}
              onCancel={cancelTimer}
            />
            <ProductivityChart
              totalSeconds={todayStats.totalTime}
              percent={productivity.percent}
              color={productivity.color}
              label={productivity.label}
            />
            <ComparisonBox
              vsYesterday={comparison.vsYesterday}
              vsWeekAvg={comparison.vsWeekAvg}
              vsMonthAvg={comparison.vsMonthAvg}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Today" value={formatTimeShort(todayStats.totalTime) || '0m'} subtitle={`${todayStats.sessionCount} sessions`} icon={Clock} />
            <StatCard title="This Week" value={formatTimeShort(weekStats.totalTime) || '0m'} subtitle={`${weekStats.sessionCount} sessions`} icon={BookOpen} />
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
            <StatCard title="Active Tasks" value={activeTasks.length.toString()} subtitle={`${completedTasks.length} completed`} icon={TrendingUp} />
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
