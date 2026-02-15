import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Pencil, Trash2, Check, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudySession } from '@/types/study';
import { formatTime } from '@/lib/stats';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const RATING_EMOJI: Record<string, string> = {
  productive: '😃',
  average: '😐',
  distracted: '😴',
};

interface SessionCardProps {
  session: StudySession;
  subjectColor?: string;
  taskName?: string;
  onUpdate: (id: string, updates: Partial<Omit<StudySession, 'id'>>) => void;
  onDelete: (id: string) => void;
  onTaskTimeAdjust?: (taskId: string, delta: number) => void;
  onContinue?: (session: StudySession) => void;
}

export function SessionCard({ session, subjectColor, taskName, onUpdate, onDelete, onTaskTimeAdjust, onContinue }: SessionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState(Math.round(session.duration / 60).toString());

  const handleSave = () => {
    const mins = parseInt(editMinutes);
    if (mins > 0) {
      const newDuration = mins * 60;
      const delta = newDuration - session.duration;
      onUpdate(session.id, { duration: newDuration });
      // Adjust linked task's accumulated time
      if (session.taskId && delta !== 0 && onTaskTimeAdjust) {
        onTaskTimeAdjust(session.taskId, delta);
      }
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    // Remove time from linked task
    if (session.taskId && session.duration > 0 && onTaskTimeAdjust) {
      onTaskTimeAdjust(session.taskId, -session.duration);
    }
    onDelete(session.id);
  };

  const displayLabel = taskName
    ? `${session.subject}: ${taskName}`
    : session.subject;

  const colorStyle = subjectColor ? { backgroundColor: `hsl(${subjectColor} / 0.15)`, borderColor: `hsl(${subjectColor} / 0.3)` } : {};

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-md transition-all" style={colorStyle}>
      <div
        className="w-2 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: subjectColor ? `hsl(${subjectColor})` : 'hsl(var(--primary))' }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{displayLabel}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} className="w-20 h-8 text-sm" min="1" />
            <span className="text-xs text-muted-foreground">min</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave}><Check className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
          </div>
        ) : (
          <>
            <span className="font-display font-semibold text-sm">{formatTime(session.duration)}</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditing(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            {onContinue && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Continue this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will open a new timer on the Dashboard pre-loaded with this session's time ({formatTime(session.duration)}). The original session will be kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onContinue(session)}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </div>
  );
}
