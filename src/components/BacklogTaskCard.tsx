import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Check, Pencil, Trash2, X, MoreVertical, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Task, SUBJECTS } from '@/types/study';

interface BacklogTaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
}

export function BacklogTaskCard({ task, onUpdate, onDelete, onComplete, onReschedule }: BacklogTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editSubject, setEditSubject] = useState(task.subject);
  const [editNotes, setEditNotes] = useState(task.notes || '');
  const [editPlannedTime, setEditPlannedTime] = useState(task.plannedTime?.toString() || '');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = new Date();
  const tomorrow = addDays(today, 1);

  const handleSave = () => {
    onUpdate(task.id, {
      title: editTitle,
      description: editDescription,
      subject: editSubject,
      notes: editNotes,
      plannedTime: editPlannedTime ? parseInt(editPlannedTime) : undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditSubject(task.subject);
    setEditNotes(task.notes || '');
    setEditPlannedTime(task.plannedTime?.toString() || '');
    setIsEditing(false);
  };

  const handleMoveToToday = () => {
    onReschedule(task.id, format(today, 'yyyy-MM-dd'));
  };

  const handleMoveToTomorrow = () => {
    onReschedule(task.id, format(tomorrow, 'yyyy-MM-dd'));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onReschedule(task.id, format(date, 'yyyy-MM-dd'));
      setCalendarOpen(false);
    }
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-xl border border-primary bg-card shadow-medium animate-fade-in">
        <div className="space-y-3">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Task title"
            className="font-medium"
          />
          <Textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
          />
          <Select value={editSubject} onValueChange={setEditSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              type="number"
              value={editPlannedTime}
              onChange={(e) => setEditPlannedTime(e.target.value)}
              placeholder="Planned time (minutes)"
              className="flex-1"
            />
          </div>
          <Textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} size="sm" className="gradient-primary border-0">
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button onClick={handleCancel} size="sm" variant="ghost">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-medium animate-slide-up">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onComplete(task.id)}
          className="mt-1 w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary flex items-center justify-center transition-all"
        >
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium leading-tight">{task.title}</h4>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
              {task.subject}
            </span>
            {task.originalDate && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(task.originalDate), 'MMM d, yyyy')}
              </span>
            )}
            {task.plannedTime && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.plannedTime} min
              </span>
            )}
          </div>
          {task.notes && (
            <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
              {task.notes}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMoveToToday}
            className="text-xs h-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMoveToTomorrow}
            className="text-xs h-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Tomorrow
          </Button>
          
          {/* Date Picker */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Calendar className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={undefined}
                onSelect={handleDateSelect}
                disabled={(date) => date < today}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onComplete(task.id)}>
                <Check className="w-4 h-4 mr-2" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(task.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
