import { useState } from 'react';
import { Play, Pause, Square, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/stats';
import { Task } from '@/types/study';

interface StudyTimerProps {
  displayTime: number;
  isRunning: boolean;
  currentSubject: string;
  currentCategory?: string;
  currentTaskId?: string;
  subjectNames: string[];
  categoryNames: string[];
  tasks: Task[];
  onStart: (subject: string, taskId?: string, category?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => { taskId?: string; duration: number };
  onCancel?: () => void;
  onTimeLogged?: (taskId: string, duration: number) => void;
}

export function StudyTimer({
  displayTime,
  isRunning,
  currentSubject,
  currentCategory,
  currentTaskId,
  subjectNames,
  categoryNames,
  tasks,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
  onTimeLogged,
}: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [validationError, setValidationError] = useState('');
  const hasStarted = displayTime > 0 || isRunning;

  // Filter tasks by selected category that are active (not completed, not backlog)
  const filteredTasks = tasks.filter(
    (t) => t.category === selectedCategory && !t.completed && !t.isBacklog
  );

  const handleStart = () => {
    if (!selectedCategory) {
      setValidationError('Please select a tab/category');
      return;
    }
    if (!selectedTaskId) {
      setValidationError('Please select a task');
      return;
    }
    if (!selectedSubject) {
      setValidationError('Please select a subject');
      return;
    }
    setValidationError('');
    onStart(selectedSubject, selectedTaskId, selectedCategory);
  };

  const handleStop = () => {
    const result = onStop();
    if (result.taskId && result.duration > 0 && onTimeLogged) {
      onTimeLogged(result.taskId, result.duration);
    }
    setSelectedSubject('');
    setSelectedCategory('');
    setSelectedTaskId('');
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedTaskId(''); // reset task when category changes
    setValidationError('');
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const displayTaskName = selectedTask?.title || (currentTaskId ? tasks.find((t) => t.id === currentTaskId)?.title : undefined);

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Study Timer</h3>
        </div>

        <div className="text-center py-4">
          <div
            className={cn(
              'font-display text-5xl font-bold tracking-tight transition-colors font-mono',
              isRunning ? 'text-primary' : 'text-foreground'
            )}
          >
            {formatTime(displayTime)}
          </div>
          {hasStarted && (
            <div className="mt-2 space-y-0.5">
              {currentCategory && (
                <p className="text-xs text-muted-foreground">
                  Tab: <span className="font-medium text-foreground">{currentCategory}</span>
                </p>
              )}
              {currentSubject && (
                <p className="text-xs text-muted-foreground">
                  Subject: <span className="font-medium text-foreground">{currentSubject}</span>
                </p>
              )}
              {displayTaskName && (
                <p className="text-xs text-muted-foreground">
                  Task: <span className="font-medium text-foreground">{displayTaskName}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {!hasStarted && (
          <div className="space-y-3 mb-4">
            {/* Category/Tab */}
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a tab/category" />
              </SelectTrigger>
              <SelectContent>
                {categoryNames.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subject */}
            <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setValidationError(''); }}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjectNames.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Task (filtered by category) */}
            <Select
              value={selectedTaskId}
              onValueChange={(v) => { setSelectedTaskId(v); setValidationError(''); }}
              disabled={!selectedCategory}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={selectedCategory ? 'Select a task' : 'Select tab first'} />
              </SelectTrigger>
              <SelectContent>
                {filteredTasks.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No tasks in this tab</div>
                ) : (
                  filteredTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {validationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationError}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-center">
          {!hasStarted ? (
            <Button
              onClick={handleStart}
              className="w-full gradient-primary border-0"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Studying
            </Button>
          ) : (
            <>
              {isRunning ? (
                <Button onClick={onPause} variant="secondary" className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              ) : (
                <Button onClick={onResume} className="flex-1 gradient-primary border-0">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <Button onClick={handleStop} variant="destructive" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              {onCancel && (
                <Button onClick={onCancel} variant="outline" size="icon" title="Cancel (discard session)">
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
