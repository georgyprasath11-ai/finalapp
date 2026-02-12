import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudySession } from '@/types/study';
import { formatTime } from '@/lib/stats';

interface SessionCardProps {
  session: StudySession;
  subjectColor?: string;
  onUpdate: (id: string, updates: Partial<Omit<StudySession, 'id'>>) => void;
  onDelete: (id: string) => void;
}

export function SessionCard({ session, subjectColor, onUpdate, onDelete }: SessionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState(Math.round(session.duration / 60).toString());

  const handleSave = () => {
    const mins = parseInt(editMinutes);
    if (mins > 0) {
      onUpdate(session.id, { duration: mins * 60 });
    }
    setIsEditing(false);
  };

  const colorStyle = subjectColor ? { backgroundColor: `hsl(${subjectColor} / 0.15)`, borderColor: `hsl(${subjectColor} / 0.3)` } : {};

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-medium transition-all" style={colorStyle}>
      <div
        className="w-2 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: subjectColor ? `hsl(${subjectColor})` : 'hsl(var(--primary))' }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{session.subject}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(session.startTime), 'h:mm a')} – {format(new Date(session.endTime), 'h:mm a')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              className="w-20 h-8 text-sm"
              min="1"
            />
            <span className="text-xs text-muted-foreground">min</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <span className="font-display font-semibold text-sm">{formatTime(session.duration)}</span>
            <Button
              size="sm" variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
              onClick={() => onDelete(session.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
