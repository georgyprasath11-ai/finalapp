import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SessionRating } from '@/types/study';
import { formatTime } from '@/lib/stats';

interface SessionReflectionModalProps {
  open: boolean;
  duration: number;
  subject: string;
  taskName?: string;
  onSubmit: (rating: SessionRating, note?: string) => void;
}

const RATINGS: { value: SessionRating; emoji: string; label: string }[] = [
  { value: 'productive', emoji: '😃', label: 'Productive' },
  { value: 'average', emoji: '😐', label: 'Average' },
  { value: 'distracted', emoji: '😴', label: 'Distracted' },
];

export function SessionReflectionModal({ open, duration, subject, taskName, onSubmit }: SessionReflectionModalProps) {
  const [selected, setSelected] = useState<SessionRating | null>(null);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected, note.trim() || undefined);
    setSelected(null);
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">How was this session?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-center">
            <p className="text-2xl font-display font-bold text-primary">{formatTime(duration)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {subject}{taskName ? `: ${taskName}` : ''}
            </p>
          </div>

          <div className="flex justify-center gap-4">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelected(r.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all',
                  selected === r.value
                    ? 'border-primary bg-primary/10 scale-105'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <span className="text-3xl">{r.emoji}</span>
                <span className="text-xs font-medium">{r.label}</span>
              </button>
            ))}
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note about this session..."
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!selected}
            className="w-full gradient-primary border-0"
          >
            Save Reflection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
