import { Clock, BookOpen, Target, TrendingUp, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { StudyTimer } from '@/components/StudyTimer';
import { StatCard } from '@/components/StatCard';
import { ProductivityChart } from '@/components/ProductivityChart';
import { ComparisonBox } from '@/components/ComparisonBox';
import { MonthlyChart } from '@/components/MonthlyChart';
import { SubjectChart } from '@/components/SubjectChart';
import { TodayTasks } from '@/components/TodayTasks';
import { SubjectTimeWheel } from '@/components/SubjectTimeWheel';
import { ConsistencyChart } from '@/components/ConsistencyChart';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubjects } from '@/hooks/useSubjects';
import { useTasks } from '@/hooks/useTasks';
import { useCategories } from '@/hooks/useCategories';
import { formatTimeShort, getTodayStats, getWeekStats, getMonthComparison, getLast6MonthsData, getSubjectStats, getProductivity, getStudyComparison, getBacklogPriority, getSubjectStatsByRange, getLast7DaysData } from '@/lib/stats';

const Index = () => {
  const {
    displayTime, isRunning, currentSubject, currentCategory, currentTaskId, sessions,
    startTimer, pauseTimer, resumeTimer, stopTimer, cancelTimer, saveSession, preloadTime,
  } = useStudyTimer();
  const { subjectNames } = useSubjects();
  const { categoryNames } = useCategories();
  const { tasks, activeTasks, completedTasks, backlogTasks, addTimeToTask, completeTask, uncompleteTask } = useTasks();

  const todayStats = getTodayStats(sessions);
  const weekStats = getWeekStats(sessions);
  const monthComparison = getMonthComparison(sessions);
  const last6Months = getLast6MonthsData(sessions);
  const subjectStats = getSubjectStats(sessions);
  const productivity = getProductivity(todayStats.totalTime);
  const comparison = getStudyComparison(sessions);

  const dailySubjectStats = getSubjectStatsByRange(sessions, 'daily');
  const weeklySubjectStats = getSubjectStatsByRange(sessions, 'weekly');
  const monthlySubjectStats = getSubjectStatsByRange(sessions, 'monthly');
  const last7Days = getLast7DaysData(sessions);

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
              currentCategory={currentCategory}
              currentTaskId={currentTaskId}
              subjectNames={subjectNames}
              categoryNames={categoryNames}
              tasks={tasks.filter((t) => !t.completed && !t.isBacklog)}
              onStart={startTimer}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onStop={stopTimer}
              onCancel={cancelTimer}
              onTimeLogged={addTimeToTask}
              onSaveSession={saveSession}
              onPreloadTime={preloadTime}
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

          {/* Today's Tasks */}
          <div className="mb-6">
            <TodayTasks tasks={tasks} onComplete={completeTask} onUncomplete={uncompleteTask} />
          </div>

          {/* Backlog Summary */}
          {backlogTasks.length > 0 && (
            <Link to="/backlog" className="block mb-6">
              <div className="stat-card hover:shadow-md transition-shadow cursor-pointer border-destructive/30">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-destructive" />
                      <h3 className="font-display font-semibold">Backlog</h3>
                    </div>
                    <span className="text-sm font-semibold px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                      {backlogTasks.length} pending
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {backlogTasks.slice(0, 5).map((task) => {
                      const priority = getBacklogPriority(task.originalDate || task.createdAt.split('T')[0]);
                      return (
                        <div key={task.id} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: `hsl(${priority.color})` }} />
                          <span className="truncate">{task.title}</span>
                          <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `hsl(${priority.color} / 0.15)`, color: `hsl(${priority.color})` }}>
                            {priority.label}
                          </span>
                        </div>
                      );
                    })}
                    {backlogTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{backlogTasks.length - 5} more tasks</p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Charts */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 mb-6">
            <MonthlyChart data={last6Months} />
            <SubjectChart data={subjectStats} />
          </div>

          {/* Study Consistency */}
          <div className="mb-6">
            <ConsistencyChart data={last7Days} />
          </div>

          {/* Subject Time Wheels */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-3">
            <SubjectTimeWheel title="Daily Time by Subject" data={dailySubjectStats} />
            <SubjectTimeWheel title="Weekly Time by Subject" data={weeklySubjectStats} />
            <SubjectTimeWheel title="Monthly Time by Subject" data={monthlySubjectStats} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
