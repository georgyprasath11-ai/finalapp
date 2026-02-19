import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/stats';
import { Task, SessionRating, SessionTaskEntry } from '@/types/study';
import { SessionReflectionModal } from '@/components/SessionReflectionModal';

interface StudyTimerProps {
  displayTime: number;
  isRunning: boolean;
  currentSubject: string;
  currentCategory?: string;
  currentTaskId?: string;
  subjectNames: string[];
  categoryNames: string[];
  tasks: Task[];
  onStart: (subject: string, taskId?: string, category?: string, initialElapsed?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => { taskId?: string; duration: number; subject: string; category?: string };
  onCancel?: () => void;
  onTimeLogged?: (taskId: string, duration: number) => void;
  onSaveSession?: (subject: string, duration: number, taskId?: string, category?: string, rating?: SessionRating, note?: string, existingSessionId?: string, tasks?: SessionTaskEntry[]) => void;
  onPreloadTime?: (seconds: number) => void;
  onSwitchTask?: (subject: string, taskId?: string, category?: string) => void;
}

export function StudyTimer({
  displayTime, isRunning, currentSubject, currentCategory, currentTaskId,
  subjectNames, categoryNames, tasks,
  onStart, onPause, onResume, onStop, onCancel, onTimeLogged, onSaveSession, onPreloadTime, onSwitchTask,
}: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [validationError, setValidationError] = useState('');
  const [reflectionData, setReflectionData] = useState<{
    duration: number;
    subject: string;
    taskId?: string;
    category?: string;
    taskName?: string;
    primarySubject?: string;
    primaryTaskId?: string;
    primaryCategory?: string;
    continuingSessionId?: string;
    previousDuration?: number;
    previousTaskTotals?: Record<string, number>;
    tasks?: SessionTaskEntry[];
  } | null>(null);
  const [isContinuation, setIsContinuation] = useState(false);
  const [continuingSessionId, setContinuingSessionId] = useState<string | undefined>();
  const [previousDuration, setPreviousDuration] = useState(0);
  const [sessionTasks, setSessionTasks] = useState<SessionTaskEntry[]>([]);
  const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);
  const [taskStartElapsed, setTaskStartElapsed] = useState<number | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const previousTaskTotalsRef = useRef<Record<string, number>>({});
  const hasStarted = (displayTime > 0 || isRunning) && !isContinuation;

  // Check for continuation session data
  useEffect(() => {
    const raw = localStorage.getItem('study-continue-session');
    if (!raw || hasStarted) return;
    try {
      const data = JSON.parse(raw);
      localStorage.removeItem('study-continue-session');
      const mode = data.mode === 'new-task' ? 'new-task' : 'same';
      if (Array.isArray(data.sessionTasks) && data.sessionTasks.length > 0) {
        setSessionTasks(data.sessionTasks);
        previousTaskTotalsRef.current = data.sessionTasks.reduce((acc: Record<string, number>, entry: SessionTaskEntry) => {
          if (entry.taskId) {
            acc[entry.taskId] = (acc[entry.taskId] || 0) + entry.duration;
          }
          return acc;
        }, {});
        const lastEntry = data.sessionTasks[data.sessionTasks.length - 1] as SessionTaskEntry | undefined;
        if (mode === 'same') {
          if (data.category || lastEntry?.category) setSelectedCategory(data.category || lastEntry?.category || '');
          if (data.subject || lastEntry?.subject) setSelectedSubject(data.subject || lastEntry?.subject || '');
          if (data.taskId || lastEntry?.taskId) setSelectedTaskId(data.taskId || lastEntry?.taskId || '');
        } else {
          setSelectedCategory('');
          setSelectedSubject('');
          setSelectedTaskId('');
        }
      } else {
        if (mode === 'same') {
          if (data.category) setSelectedCategory(data.category);
          if (data.subject) setSelectedSubject(data.subject);
          if (data.taskId) setSelectedTaskId(data.taskId);
        } else {
          setSelectedCategory('');
          setSelectedSubject('');
          setSelectedTaskId('');
        }
      }
      if (data.sessionId) setContinuingSessionId(data.sessionId);
      if (data.duration) {
        setPreviousDuration(data.duration);
        if (onPreloadTime) onPreloadTime(data.duration);
      }
      setIsContinuation(true);
    } catch { /* ignore */ }
  }, []); // Run once on mount

  const filteredTasks = tasks.filter(
    (t) => t.category === selectedCategory && !t.completed && !t.isBacklog
  );
  const taskTitleMap = new Map(tasks.map((t) => [t.id, t.title]));
  const buildSessionLabel = (entries: SessionTaskEntry[]) =>
    entries
      .map((entry) => {
        const taskTitle = entry.taskId ? taskTitleMap.get(entry.taskId) : undefined;
        if (entry.taskId && !taskTitle) return `${entry.subject}: Untitled Task`;
        return taskTitle ? `${entry.subject}: ${taskTitle}` : entry.subject;
      })
      .join(' + ');

  const handleStart = () => {
    if (!selectedCategory) { setValidationError('Please select a tab/category'); return; }
    if (!selectedTaskId) { setValidationError('Please select a task'); return; }
    if (!selectedSubject) { setValidationError('Please select a subject'); return; }
    setValidationError('');

    const baseEntry: SessionTaskEntry = {
      taskId: selectedTaskId,
      subject: selectedSubject,
      category: selectedCategory,
      duration: 0,
    };

    let updatedTasks = sessionTasks.length > 0 ? [...sessionTasks] : [];
    let nextIndex = updatedTasks.findIndex((t) => t.taskId === selectedTaskId);
    if (nextIndex === -1) {
      updatedTasks = [...updatedTasks, baseEntry];
      nextIndex = updatedTasks.length - 1;
    }
    setSessionTasks(updatedTasks);
    setActiveTaskIndex(nextIndex);
    setTaskStartElapsed(displayTime);

    // If continuing, pass the preloaded time as initial elapsed
    if (isContinuation && displayTime > 0) {
      onStart(selectedSubject, selectedTaskId, selectedCategory, displayTime);
      setIsContinuation(false);
    } else {
      onStart(selectedSubject, selectedTaskId, selectedCategory);
    }
    setIsAddingTask(false);
  };

  const handleAddTask = () => {
    if (!selectedCategory) { setValidationError('Please select a tab/category'); return; }
    if (!selectedTaskId) { setValidationError('Please select a task'); return; }
    if (!selectedSubject) { setValidationError('Please select a subject'); return; }
    setValidationError('');

    const nowElapsed = displayTime;
    let updatedTasks = [...sessionTasks];
    if (activeTaskIndex !== null && taskStartElapsed !== null && updatedTasks[activeTaskIndex]) {
      const delta = Math.max(0, nowElapsed - taskStartElapsed);
      updatedTasks[activeTaskIndex] = {
        ...updatedTasks[activeTaskIndex],
        duration: updatedTasks[activeTaskIndex].duration + delta,
      };
    }

    const nextEntry: SessionTaskEntry = {
      taskId: selectedTaskId,
      subject: selectedSubject,
      category: selectedCategory,
      duration: 0,
    };
    let nextIndex = updatedTasks.findIndex((t) => t.taskId === selectedTaskId);
    if (nextIndex === -1) {
      updatedTasks.push(nextEntry);
      nextIndex = updatedTasks.length - 1;
    }

    setSessionTasks(updatedTasks);
    setActiveTaskIndex(nextIndex);
    setTaskStartElapsed(nowElapsed);
    if (onSwitchTask) onSwitchTask(selectedSubject, selectedTaskId, selectedCategory);
    setIsAddingTask(false);
    setSelectedTaskId('');
    setSelectedSubject('');
    setSelectedCategory('');
  };

  const handleStop = () => {
    const result = onStop();
    if (result.duration > 0) {
      const finalDuration = result.duration;
      let updatedTasks = [...sessionTasks];
      if (activeTaskIndex !== null && taskStartElapsed !== null && updatedTasks[activeTaskIndex]) {
        const delta = Math.max(0, finalDuration - taskStartElapsed);
        updatedTasks[activeTaskIndex] = {
          ...updatedTasks[activeTaskIndex],
          duration: updatedTasks[activeTaskIndex].duration + delta,
        };
      }
      if (updatedTasks.length === 0 && result.taskId) {
        updatedTasks = [{
          taskId: result.taskId,
          subject: result.subject,
          category: result.category,
          duration: finalDuration,
        }];
      }
      updatedTasks = updatedTasks.filter((entry) => entry.duration > 0);
      const primaryEntry = updatedTasks[0];
      const sessionLabel = updatedTasks.length > 1 ? buildSessionLabel(updatedTasks) : primaryEntry?.subject || result.subject;
      const taskName = primaryEntry?.taskId ? taskTitleMap.get(primaryEntry.taskId) : undefined;
      setReflectionData({
        duration: finalDuration,
        subject: sessionLabel,
        taskId: primaryEntry?.taskId || result.taskId,
        category: primaryEntry?.category || result.category,
        taskName: updatedTasks.length > 1 ? undefined : taskName,
        primarySubject: primaryEntry?.subject || result.subject,
        primaryTaskId: primaryEntry?.taskId || result.taskId,
        primaryCategory: primaryEntry?.category || result.category,
        continuingSessionId,
        previousDuration,
        previousTaskTotals: previousTaskTotalsRef.current,
        tasks: updatedTasks,
      });
    }
    setSelectedSubject('');
    setSelectedCategory('');
    setSelectedTaskId('');
    setContinuingSessionId(undefined);
    setPreviousDuration(0);
    setSessionTasks([]);
    setActiveTaskIndex(null);
    setTaskStartElapsed(null);
    setIsAddingTask(false);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    setSelectedSubject('');
    setSelectedCategory('');
    setSelectedTaskId('');
    setContinuingSessionId(undefined);
    setPreviousDuration(0);
    setSessionTasks([]);
    setActiveTaskIndex(null);
    setTaskStartElapsed(null);
    setIsAddingTask(false);
    setIsContinuation(false);
  };

  const handleReflectionSubmit = (rating: SessionRating, note?: string) => {
    if (!reflectionData) return;

    if (reflectionData.continuingSessionId && onSaveSession) {
      // Continuation: update existing session, only add the NEW time delta per task
      const previousTotals = reflectionData.previousTaskTotals || {};
      (reflectionData.tasks || []).forEach((entry) => {
        if (!entry.taskId || !onTimeLogged) return;
        const prev = previousTotals[entry.taskId] || 0;
        const delta = entry.duration - prev;
        if (delta > 0) onTimeLogged(entry.taskId, delta);
      });
      // Update existing session with new total duration and reflection
      onSaveSession(
        reflectionData.primarySubject || reflectionData.subject,
        reflectionData.duration,
        reflectionData.primaryTaskId || reflectionData.taskId,
        reflectionData.primaryCategory || reflectionData.category,
        rating,
        note,
        reflectionData.continuingSessionId,
        reflectionData.tasks
      );
    } else {
      // Normal new session
      (reflectionData.tasks || []).forEach((entry) => {
        if (entry.taskId && entry.duration > 0 && onTimeLogged) {
          onTimeLogged(entry.taskId, entry.duration);
        }
      });
      if (onSaveSession) {
        onSaveSession(
          reflectionData.primarySubject || reflectionData.subject,
          reflectionData.duration,
          reflectionData.primaryTaskId || reflectionData.taskId,
          reflectionData.primaryCategory || reflectionData.category,
          rating,
          note,
          undefined,
          reflectionData.tasks
        );
      }
    }
    setReflectionData(null);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedTaskId('');
    setValidationError('');
  };

  const handleOpenAddTask = () => {
    setIsAddingTask(true);
    setValidationError('');
    setSelectedCategory('');
    setSelectedSubject('');
    setSelectedTaskId('');
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const displayTaskName = currentTaskId ? tasks.find((t) => t.id === currentTaskId)?.title : selectedTask?.title;

  return (
    <>
      <div className="stat-card">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Study Timer</h3>
          </div>

          <div className="text-center py-4">
            <div className={cn('font-display text-5xl font-bold tracking-tight transition-colors', isRunning ? 'text-primary' : 'text-foreground')}>
              {formatTime(displayTime)}
            </div>
            {hasStarted && (
              <div className="mt-2 space-y-0.5">
                {currentCategory && (
                  <p className="text-xs text-muted-foreground">Tab: <span className="font-medium text-foreground">{currentCategory}</span></p>
                )}
                {currentSubject && (
                  <p className="text-xs text-muted-foreground">Subject: <span className="font-medium text-foreground">{currentSubject}</span></p>
                )}
                {displayTaskName && (
                  <p className="text-xs text-muted-foreground">Task: <span className="font-medium text-foreground">{displayTaskName}</span></p>
                )}
              </div>
            )}
          </div>

          {(!hasStarted || isContinuation) && (
            <div className="space-y-3 mb-4">
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select a tab/category" /></SelectTrigger>
                <SelectContent>
                  {categoryNames.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setValidationError(''); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                <SelectContent>
                  {subjectNames.map((subject) => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedTaskId} onValueChange={(v) => { setSelectedTaskId(v); setValidationError(''); }} disabled={!selectedCategory}>
                <SelectTrigger className="text-sm"><SelectValue placeholder={selectedCategory ? 'Select a task' : 'Select tab first'} /></SelectTrigger>
                <SelectContent>
                  {filteredTasks.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No tasks in this tab</div>
                  ) : (
                    filteredTasks.map((task) => (<SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>))
                  )}
                </SelectContent>
              </Select>
              {validationError && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{validationError}</p>
              )}
            </div>
          )}

          {hasStarted && isAddingTask && (
            <div className="space-y-3 mb-4 rounded-lg border bg-muted/30 p-3">
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select a tab/category" /></SelectTrigger>
                <SelectContent>
                  {categoryNames.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setValidationError(''); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                <SelectContent>
                  {subjectNames.map((subject) => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedTaskId} onValueChange={(v) => { setSelectedTaskId(v); setValidationError(''); }} disabled={!selectedCategory}>
                <SelectTrigger className="text-sm"><SelectValue placeholder={selectedCategory ? 'Select a task' : 'Select tab first'} /></SelectTrigger>
                <SelectContent>
                  {filteredTasks.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No tasks in this tab</div>
                  ) : (
                    filteredTasks.map((task) => (<SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>))
                  )}
                </SelectContent>
              </Select>
              {validationError && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{validationError}</p>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleAddTask} className="flex-1 gradient-primary border-0">Add Task</Button>
                <Button onClick={() => setIsAddingTask(false)} variant="ghost">Cancel</Button>
              </div>
            </div>
          )}

          {hasStarted && !isAddingTask && !isContinuation && (
            <div className="flex justify-center mb-4">
              <Button
                onClick={handleOpenAddTask}
                variant="outline"
                className="gap-2 px-4 py-2 text-sm font-medium hover:bg-muted/60"
              >
                <Play className="w-4 h-4" />
                + Task
              </Button>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            {isContinuation && (
              <p className="text-xs text-muted-foreground italic mb-2 w-full text-center">Continued from previous session</p>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            {(!hasStarted || isContinuation) ? (
              <Button onClick={handleStart} className="w-full gradient-primary border-0">
                <Play className="w-4 h-4 mr-2" />{isContinuation ? 'Continue Studying' : 'Start Studying'}
              </Button>
            ) : (
              <>
                {isRunning ? (
                  <Button onClick={onPause} variant="secondary" className="flex-1"><Pause className="w-4 h-4 mr-2" />Pause</Button>
                ) : (
                  <Button onClick={onResume} className="flex-1 gradient-primary border-0"><Play className="w-4 h-4 mr-2" />Resume</Button>
                )}
                <Button onClick={handleStop} variant="destructive" className="flex-1"><Square className="w-4 h-4 mr-2" />Stop</Button>
                {onCancel && (
                  <Button onClick={handleCancel} variant="outline" size="icon" title="Cancel (discard session)"><XCircle className="w-4 h-4" /></Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {reflectionData && (
        <SessionReflectionModal
          open={!!reflectionData}
          duration={reflectionData.duration}
          subject={reflectionData.subject}
          taskName={reflectionData.taskName}
          onSubmit={handleReflectionSubmit}
        />
      )}
    </>
  );
}
