import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskCard } from '@/components/TaskCard';
import { useTasks } from '@/hooks/useTasks';
import { useSubjects } from '@/hooks/useSubjects';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { cn } from '@/lib/utils';
import { Task } from '@/types/study';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PlannerPage = () => {
  const { isRunning } = useStudyTimer();
  const { activeTasks, completedTasks, addTask, updateTask, deleteTask, completeTask, uncompleteTask, moveToBacklog } = useTasks();
  const { getSubjectColor } = useSubjects();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const allTasks = useMemo(() => [...activeTasks, ...completedTasks], [activeTasks, completedTasks]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startPadding = getDay(days[0]);

  const getTasksForDay = (day: Date): Task[] => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return allTasks.filter((t) => t.scheduledDate === dateStr);
  };

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-primary" />
                Planner
              </h1>
              <p className="text-muted-foreground">Plan your study schedule</p>
            </div>
            <AddTaskDialog onAdd={addTask} />
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-display text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-card p-2 min-h-[80px]" />
            ))}
            {days.map((day) => {
              const dayTasks = getTasksForDay(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'bg-card p-2 min-h-[80px] text-left hover:bg-secondary/50 transition-colors',
                    isToday(day) && 'ring-2 ring-inset ring-primary',
                    selectedDay && isSameDay(day, selectedDay) && 'bg-primary/10'
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium',
                    isToday(day) && 'text-primary font-bold'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          'text-[10px] px-1 py-0.5 rounded truncate',
                          t.completed && 'line-through opacity-50'
                        )}
                        style={{
                          backgroundColor: `hsl(${getSubjectColor(t.subject)} / 0.2)`,
                          color: `hsl(${getSubjectColor(t.subject)})`,
                        }}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Day Detail Dialog */}
          <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {selectedDay && format(selectedDay, 'EEEE, MMMM d, yyyy')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {selectedDayTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No tasks for this day</p>
                ) : (
                  selectedDayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onComplete={completeTask}
                      onUncomplete={uncompleteTask}
                      onMoveToBacklog={moveToBacklog}
                    />
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default PlannerPage;
