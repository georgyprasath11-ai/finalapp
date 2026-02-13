import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Pencil, Trash2, X, MoreVertical, Archive, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Task } from '@/types/study';
import { useSubjects } from '@/hooks/useSubjects';
import { formatTime } from '@/lib/stats';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onMoveToBacklog?: (id: string) => void;
}

export function TaskCard({ task, onUpdate, onDelete, onComplete, onUncomplete, onMoveToBacklog }: TaskCardProps) {
  const { subjectNames, getSubjectColor } = useSubjects();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editSubject, setEditSubject] = useState(task.subject);
  const [editNotes, setEditNotes] = useState(task.notes || '');
  const [editPlannedTime, setEditPlannedTime] = useState(task.plannedTime?.toString() || '');

  const subjectColor = getSubjectColor(task.subject);

  const handleSave = () => {
    onUpdate(task.id, {
      title: editTitle, description: editDescription, subject: editSubject,
      notes: editNotes, plannedTime: editPlannedTime ? parseInt(editPlannedTime) : undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title); setEditDescription(task.description); setEditSubject(task.subject);
    setEditNotes(task.notes || ''); setEditPlannedTime(task.plannedTime?.toString() || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-xl border border-primary bg-card shadow-md animate-fade-in">
        <div className="space-y-3">
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Task title" className="font-medium" />
          <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
          <Select value={editSubject} onValueChange={setEditSubject}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjectNames.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input type="number" value={editPlannedTime} onChange={(e) => setEditPlannedTime(e.target.value)} placeholder="Planned time (minutes)" />
          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} size="sm" className="gradient-primary border-0"><Check className="w-4 h-4 mr-1" />Save</Button>
            <Button onClick={handleCancel} size="sm" variant="ghost"><X className="w-4 h-4 mr-1" />Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  const accTime = task.accumulatedTime || 0;

  return (
    <div className={cn('group p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-md animate-slide-up', task.completed && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => (task.completed ? onUncomplete(task.id) : onComplete(task.id))}
          className={cn(
            'mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            task.completed ? 'bg-success border-success' : 'border-muted-foreground/30 hover:border-primary'
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-success-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className={cn('font-medium leading-tight', task.completed && 'line-through text-muted-foreground')}>{task.title}</h4>
          {/* Accumulated time display */}
          <p className="mt-1 font-mono text-2xl font-bold text-primary tracking-tight">
            {formatTime(accTime)}
          </p>
          {task.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{task.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: `hsl(${subjectColor} / 0.15)`, color: `hsl(${subjectColor})` }}
            >
              {task.subject}
            </span>
            {task.scheduledDate && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />{format(new Date(task.scheduledDate), 'MMM d')}
              </span>
            )}
            {task.plannedTime && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />{task.plannedTime} min
              </span>
            )}
          </div>
          {task.notes && <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">{task.notes}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
            {onMoveToBacklog && !task.completed && (
              <DropdownMenuItem onClick={() => onMoveToBacklog(task.id)}><Archive className="w-4 h-4 mr-2" />Move to Backlog</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
