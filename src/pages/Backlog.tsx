import { useState } from 'react';
import { format, parseISO, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Archive, ArrowUpDown, Calendar } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { BacklogTaskCard } from '@/components/BacklogTaskCard';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { useStudyTimer } from '@/hooks/useStudyTimer';

type SortOrder = 'oldest' | 'newest';

const BacklogPage = () => {
  const { isRunning } = useStudyTimer();
  const {
    backlogTasks,
    backlogByDate,
    updateTask,
    deleteTask,
    completeTask,
    rescheduleTask,
  } = useTasks();

  const [sortOrder, setSortOrder] = useState<SortOrder>('oldest');

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'));
  };

  // Format date for display
  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    const daysAgo = differenceInDays(new Date(), date);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else if (daysAgo <= 7) {
      return `${daysAgo} days ago`;
    } else {
      return format(date, 'EEEE, MMMM d, yyyy');
    }
  };

  // Get sorted date entries
  const sortedDateEntries = Object.entries(backlogByDate).sort(([a], [b]) => {
    return sortOrder === 'oldest' ? a.localeCompare(b) : b.localeCompare(a);
  });

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
                <Archive className="w-8 h-8 text-primary" />
                Backlog
              </h1>
              <p className="text-muted-foreground">
                {backlogTasks.length} {backlogTasks.length === 1 ? 'task' : 'tasks'} waiting to be rescheduled
              </p>
            </div>
            <Button
              variant="outline"
              onClick={toggleSort}
              className="gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortOrder === 'oldest' ? 'Oldest First' : 'Newest First'}
            </Button>
          </div>

          {/* Backlog Content */}
          {backlogTasks.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border">
              <Archive className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-display font-semibold text-xl mb-2">No backlog tasks</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Great job! You don't have any pending tasks in your backlog. 
                Tasks that aren't completed on time will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedDateEntries.map(([date, tasks]) => (
                <div key={date} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{formatDateHeader(date)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Tasks for this date */}
                  <div className="space-y-3 pl-2">
                    {tasks.map((task) => (
                      <BacklogTaskCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                        onDelete={deleteTask}
                        onComplete={completeTask}
                        onReschedule={rescheduleTask}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips Section */}
          {backlogTasks.length > 0 && (
            <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h4 className="font-medium text-sm mb-2 text-primary">💡 Quick Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Hover over a task to see quick reschedule buttons</li>
                <li>• Use "Today" or "Tomorrow" for quick rescheduling</li>
                <li>• Click the calendar icon to pick a specific date</li>
                <li>• Oldest tasks first helps you tackle overdue work systematically</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BacklogPage;
