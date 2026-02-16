import { Check, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from '@/types/study';
import { useSubjects } from '@/hooks/useSubjects';

interface TodayTasksProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
}

export function TodayTasks({ tasks, onComplete, onUncomplete }: TodayTasksProps) {
  const { getSubjectColor } = useSubjects();
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(
    (t) => t.scheduledDate === today && !t.isBacklog
  );

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Pin className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Tasks for Today</h3>
          {todayTasks.length > 0 && (
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {todayTasks.filter((t) => !t.completed).length} remaining
            </span>
          )}
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tasks scheduled for today.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {todayTasks.map((task) => {
              const color = getSubjectColor(task.subject);
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50',
                    task.completed && 'opacity-50'
                  )}
                >
                  <button
                    onClick={() => (task.completed ? onUncomplete(task.id) : onComplete(task.id))}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                      task.completed ? 'bg-success border-success' : 'border-muted-foreground/30 hover:border-primary'
                    )}
                  >
                    {task.completed && <Check className="w-3 h-3 text-success-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', task.completed && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `hsl(${color} / 0.15)`, color: `hsl(${color})` }}
                      >
                        {task.subject}
                      </span>
                      <span className="text-xs text-muted-foreground">{task.category}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
