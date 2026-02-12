import { useState } from 'react';
import { Play, Pause, Square, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/stats';

interface StudyTimerProps {
  displayTime: number;
  isRunning: boolean;
  currentSubject: string;
  subjectNames: string[];
  onStart: (subject: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel?: () => void;
}

export function StudyTimer({
  displayTime,
  isRunning,
  currentSubject,
  subjectNames,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
}: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const hasStarted = displayTime > 0 || isRunning;

  const handleStart = () => {
    if (selectedSubject) {
      onStart(selectedSubject);
    }
  };

  const handleStop = () => {
    onStop();
    setSelectedSubject('');
  };

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Study Timer</h3>
        </div>

        <div className="text-center py-6">
          <div
            className={cn(
              'font-display text-5xl font-bold tracking-tight transition-colors',
              isRunning ? 'text-primary' : 'text-foreground'
            )}
          >
            {formatTime(displayTime)}
          </div>
          {currentSubject && (
            <p className="mt-2 text-muted-foreground">
              Studying: <span className="font-medium text-foreground">{currentSubject}</span>
            </p>
          )}
        </div>

        {!hasStarted && (
          <div className="mb-4">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjectNames.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 justify-center">
          {!hasStarted ? (
            <Button
              onClick={handleStart}
              disabled={!selectedSubject}
              className="w-full gradient-primary border-0"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Studying
            </Button>
          ) : (
            <>
              {isRunning ? (
                <Button onClick={onPause} variant="secondary" className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              ) : (
                <Button onClick={onResume} className="flex-1 gradient-primary border-0">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <Button onClick={handleStop} variant="destructive" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              {onCancel && (
                <Button onClick={onCancel} variant="outline" size="icon" title="Cancel (discard session)">
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
