import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Clock, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { SessionCard } from '@/components/SessionCard';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubjects } from '@/hooks/useSubjects';
import { useTasks } from '@/hooks/useTasks';
import { useCategories } from '@/hooks/useCategories';
import { formatTime } from '@/lib/stats';
import { StudySession, SessionTaskEntry } from '@/types/study';
import { toast } from 'sonner';

const SessionsPage = () => {
  const { isRunning, sessions, updateSession, deleteSession } = useStudyTimer();
  const { getSubjectColor, subjectNames } = useSubjects();
  const { tasks, addTimeToTask } = useTasks();
  const { categoryNames } = useCategories();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const taskNameMap = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const getSessionTasks = useCallback((session: StudySession): SessionTaskEntry[] => {
    if (session.tasks && session.tasks.length > 0) return session.tasks;
    if (session.taskId) {
      return [{
        taskId: session.taskId,
        subject: session.subject,
        category: session.category,
        duration: session.duration,
      }];
    }
    return [{
      taskId: undefined,
      subject: session.subject,
      category: session.category,
      duration: session.duration,
    }];
  }, []);

  const daySessions = useMemo(() =>
    sessions
      .filter((s) => s.date === dateStr)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [sessions, dateStr]
  );

  const totalTime = daySessions.reduce((sum, s) => sum + s.duration, 0);

  const handleTaskTimeAdjust = (entries: { taskId: string; delta: number }[]) => {
    entries.forEach((entry) => addTimeToTask(entry.taskId, entry.delta));
  };

  const handleContinue = useCallback((session: StudySession, mode: 'same' | 'new-task') => {
    const sessionTasks = getSessionTasks(session);
    const missingTask = sessionTasks.find((entry) => entry.taskId && !tasks.find((t) => t.id === entry.taskId));
    if (missingTask) {
      toast.error('One or more tasks linked to this session no longer exist.');
      return;
    }
    const missingSubject = sessionTasks.find((entry) => !subjectNames.includes(entry.subject));
    if (missingSubject) {
      toast.error('One or more subjects linked to this session no longer exist.');
      return;
    }
    const missingCategory = sessionTasks.find((entry) => entry.category && !categoryNames.includes(entry.category));
    if (missingCategory) {
      toast.error('One or more tabs linked to this session no longer exist.');
      return;
    }

    const lastTask = sessionTasks[sessionTasks.length - 1];
    localStorage.setItem('study-continue-session', JSON.stringify({
      sessionId: session.id,
      duration: session.duration,
      subject: lastTask?.subject || session.subject,
      taskId: lastTask?.taskId || session.taskId,
      category: lastTask?.category || session.category,
      sessionTasks,
      mode,
    }));
    toast.success('Loading session…');
    navigate('/');
  }, [tasks, subjectNames, categoryNames, navigate, getSessionTasks]);

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
                <Clock className="w-8 h-8 text-primary" />
                Sessions
              </h1>
              <p className="text-muted-foreground">View and edit your study sessions</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(selectedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="stat-card">
              <div className="relative z-10">
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="font-display text-2xl font-bold">{daySessions.length}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="relative z-10">
                <p className="text-sm text-muted-foreground">Total Time</p>
                <p className="font-display text-2xl font-bold">{formatTime(totalTime)}</p>
              </div>
            </div>
          </div>

          {daySessions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border">
              <Clock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-display font-semibold text-xl mb-2">No sessions</h3>
              <p className="text-muted-foreground">No study sessions recorded for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {daySessions.map((session) => {
                const sessionTasks = getSessionTasks(session);
                const primarySubject = sessionTasks[0]?.subject || session.subject;
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    subjectColor={getSubjectColor(primarySubject)}
                    taskNameMap={taskNameMap}
                    onUpdate={updateSession}
                    onDelete={deleteSession}
                    onTaskTimeAdjust={handleTaskTimeAdjust}
                    onContinue={(s) => handleContinue(s, 'same')}
                    onContinueWithNewTask={(s) => handleContinue(s, 'new-task')}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SessionsPage;
