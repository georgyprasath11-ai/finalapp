import { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/stats';
import { Task, SessionRating } from '@/types/study';
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
  onSaveSession?: (subject: string, duration: number, taskId?: string, category?: string, rating?: SessionRating, note?: string) => void;
  onPreloadTime?: (seconds: number) => void;
}

export function StudyTimer({
  displayTime, isRunning, currentSubject, currentCategory, currentTaskId,
  subjectNames, categoryNames, tasks,
  onStart, onPause, onResume, onStop, onCancel, onTimeLogged, onSaveSession, onPreloadTime,
}: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [validationError, setValidationError] = useState('');
  const [reflectionData, setReflectionData] = useState<{ duration: number; subject: string; taskId?: string; category?: string; taskName?: string } | null>(null);
  const [isContinuation, setIsContinuation] = useState(false);
  const hasStarted = (displayTime > 0 || isRunning) && !isContinuation;

  // Check for continuation session data
  useEffect(() => {
    const raw = localStorage.getItem('study-continue-session');
    if (!raw || hasStarted) return;
    try {
      const data = JSON.parse(raw);
      localStorage.removeItem('study-continue-session');
      if (data.category) setSelectedCategory(data.category);
      if (data.subject) setSelectedSubject(data.subject);
      if (data.taskId) setSelectedTaskId(data.taskId);
      if (data.duration && onPreloadTime) {
        onPreloadTime(data.duration);
      }
      setIsContinuation(true);
    } catch { /* ignore */ }
  }, []); // Run once on mount

  const filteredTasks = tasks.filter(
    (t) => t.category === selectedCategory && !t.completed && !t.isBacklog
  );

  const handleStart = () => {
    if (!selectedCategory) { setValidationError('Please select a tab/category'); return; }
    if (!selectedTaskId) { setValidationError('Please select a task'); return; }
    if (!selectedSubject) { setValidationError('Please select a subject'); return; }
    setValidationError('');
    // If continuing, pass the preloaded time as initial elapsed
    if (isContinuation && displayTime > 0) {
      onStart(selectedSubject, selectedTaskId, selectedCategory, displayTime);
      setIsContinuation(false);
    } else {
      onStart(selectedSubject, selectedTaskId, selectedCategory);
    }
  };

  const handleStop = () => {
    const result = onStop();
    if (result.duration > 0) {
      const taskName = tasks.find((t) => t.id === result.taskId)?.title;
      setReflectionData({
        duration: result.duration,
        subject: result.subject,
        taskId: result.taskId,
        category: result.category,
        taskName,
      });
    }
    setSelectedSubject('');
    setSelectedCategory('');
    setSelectedTaskId('');
  };

  const handleReflectionSubmit = (rating: SessionRating, note?: string) => {
    if (!reflectionData) return;
    // Log time to task
    if (reflectionData.taskId && reflectionData.duration > 0 && onTimeLogged) {
      onTimeLogged(reflectionData.taskId, reflectionData.duration);
    }
    // Save session with reflection
    if (onSaveSession) {
      onSaveSession(reflectionData.subject, reflectionData.duration, reflectionData.taskId, reflectionData.category, rating, note);
    }
    setReflectionData(null);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedTaskId('');
    setValidationError('');
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const displayTaskName = selectedTask?.title || (currentTaskId ? tasks.find((t) => t.id === currentTaskId)?.title : undefined);

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
                  <Button onClick={onCancel} variant="outline" size="icon" title="Cancel (discard session)"><XCircle className="w-4 h-4" /></Button>
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
