import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Pencil, Trash2, Check, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudySession, SessionTaskEntry } from '@/types/study';
import { formatTime } from '@/lib/stats';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const RATING_EMOJI: Record<string, string> = {
  productive: '😃',
  average: '😐',
  distracted: '😴',
};

interface SessionCardProps {
  session: StudySession;
  subjectColor?: string;
  taskNameMap?: Map<string, string>;
  onUpdate: (id: string, updates: Partial<Omit<StudySession, 'id'>>) => void;
  onDelete: (id: string) => void;
  onTaskTimeAdjust?: (entries: { taskId: string; delta: number }[]) => void;
  onContinue?: (session: StudySession) => void;
  onContinueWithNewTask?: (session: StudySession) => void;
}

export function SessionCard({ session, subjectColor, taskNameMap, onUpdate, onDelete, onTaskTimeAdjust, onContinue, onContinueWithNewTask }: SessionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState(Math.round(session.duration / 60).toString());

  const sessionTasks: SessionTaskEntry[] = session.tasks && session.tasks.length > 0
    ? session.tasks
    : [{
      taskId: session.taskId,
      subject: session.subject,
      category: session.category,
      duration: session.duration,
    }];

  const handleSave = () => {
    const mins = parseInt(editMinutes);
    if (mins > 0) {
      const newDuration = mins * 60;
      if (session.tasks && session.tasks.length > 0) {
        const totalExisting = sessionTasks.reduce((sum, t) => sum + t.duration, 0) || session.duration;
        const ratio = totalExisting > 0 ? newDuration / totalExisting : 0;
        const updatedTasks = sessionTasks.map((t) => ({
          ...t,
          duration: Math.max(0, Math.round(t.duration * ratio)),
        }));
        const updatedSum = updatedTasks.reduce((sum, t) => sum + t.duration, 0);
        if (updatedTasks.length > 0 && updatedSum !== newDuration) {
          updatedTasks[updatedTasks.length - 1].duration += (newDuration - updatedSum);
        }

        onUpdate(session.id, {
          duration: newDuration,
          tasks: updatedTasks,
          subject: updatedTasks[0]?.subject || session.subject,
          taskId: updatedTasks[0]?.taskId || session.taskId,
          category: updatedTasks[0]?.category || session.category,
        });

        if (onTaskTimeAdjust) {
          const deltaMap = new Map<string, number>();
          sessionTasks.forEach((t) => {
            if (t.taskId) deltaMap.set(t.taskId, (deltaMap.get(t.taskId) || 0) - t.duration);
          });
          updatedTasks.forEach((t) => {
            if (t.taskId) deltaMap.set(t.taskId, (deltaMap.get(t.taskId) || 0) + t.duration);
          });
          const entries = Array.from(deltaMap.entries())
            .filter(([, delta]) => delta !== 0)
            .map(([taskId, delta]) => ({ taskId, delta }));
          if (entries.length > 0) onTaskTimeAdjust(entries);
        }
      } else {
        const delta = newDuration - session.duration;
        onUpdate(session.id, { duration: newDuration });
        if (session.taskId && delta !== 0 && onTaskTimeAdjust) {
          onTaskTimeAdjust([{ taskId: session.taskId, delta }]);
        }
      }
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onTaskTimeAdjust) {
      const entries = sessionTasks
        .filter((t) => t.taskId)
        .map((t) => ({ taskId: t.taskId!, delta: -t.duration }));
      if (entries.length > 0) onTaskTimeAdjust(entries);
    }
    onDelete(session.id);
  };

  const displayLabel = sessionTasks
    .map((entry) => {
      const taskTitle = entry.taskId ? taskNameMap?.get(entry.taskId) : undefined;
      if (entry.taskId && !taskTitle) return `${entry.subject}: Untitled Task`;
      return taskTitle ? `${entry.subject}: ${taskTitle}` : entry.subject;
    })
    .join(' + ');

  const colorStyle = subjectColor ? { backgroundColor: `hsl(${subjectColor} / 0.15)`, borderColor: `hsl(${subjectColor} / 0.3)` } : {};

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-md transition-all" style={colorStyle}>
      <div
        className="w-2 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: subjectColor ? `hsl(${subjectColor})` : 'hsl(var(--primary))' }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{displayLabel}</p>
        <p className="text-sm font-semibold mt-1">{formatTime(session.duration)}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(session.startTime), 'h:mm a')} – {format(new Date(session.endTime), 'h:mm a')}
          </span>
          {session.rating && (
            <span>{RATING_EMOJI[session.rating]} {session.rating}</span>
          )}
        </div>
        {session.note && (
          <p className="text-xs text-muted-foreground italic mt-1">{session.note}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} className="w-20 h-8 text-sm" min="1" />
            <span className="text-xs text-muted-foreground">min</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave}><Check className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
          </div>
        ) : (
          <>
            {onContinue && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => onContinue(session)}>
                Continue
              </Button>
            )}
            {onContinueWithNewTask && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => onContinueWithNewTask(session)}>
                Continue with New Task
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
