import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useSubjects } from '@/hooks/useSubjects';

interface AddTaskDialogProps {
  onAdd: (task: { title: string; subject: string; category: string; description: string; scheduledDate?: string; plannedTime?: number; notes?: string }) => void;
  categoryNames: string[];
  defaultCategory?: string;
}

export function AddTaskDialog({ onAdd, categoryNames, defaultCategory }: AddTaskDialogProps) {
  const { subjectNames } = useSubjects();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(defaultCategory || '');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [plannedTime, setPlannedTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title && subject && category) {
      onAdd({
        title, subject, category, description,
        scheduledDate: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : undefined,
        plannedTime: plannedTime ? parseInt(plannedTime) : undefined,
        notes: notes || undefined,
      });
      setTitle(''); setSubject(''); setCategory(defaultCategory || ''); setDescription(''); setScheduledDate(undefined); setPlannedTime(''); setNotes('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary border-0"><Plus className="w-4 h-4 mr-2" />Add Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Add New Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Complete Chapter 5 exercises" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tab / Category *</label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger><SelectValue placeholder="Select a tab" /></SelectTrigger>
              <SelectContent>
                {categoryNames.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject *</label>
            <Select value={subject} onValueChange={setSubject} required>
              <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
              <SelectContent>
                {subjectNames.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />{scheduledDate ? format(scheduledDate, "MMM d") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Planned Time</label>
              <Input type="number" value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} placeholder="Minutes" min="1" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any notes or details..." rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 gradient-primary border-0">Add Task</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
