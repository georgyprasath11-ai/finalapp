import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Dumbbell, Play, Pause, Square, Plus, X, Flame, Trophy, Clock, Trash2 } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useWorkout, WorkoutExercise } from '@/hooks/useWorkout';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { formatTime, formatTimeShort } from '@/lib/stats';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const CHART_COLORS = [
  'hsl(158, 64%, 40%)', 'hsl(38, 92%, 55%)', 'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 55%)', 'hsl(330, 70%, 55%)', 'hsl(142, 72%, 45%)',
  'hsl(15, 80%, 55%)', 'hsl(258, 60%, 55%)',
];

const WorkoutPage = () => {
  const { isRunning: studyTimerRunning } = useStudyTimer();
  const {
    sessions, markedDays, isRunning, elapsed, streaks,
    totalWorkoutTime, muscleDistribution, weeklyComparison,
    startWorkout, pauseWorkout, stopWorkout, resetWorkout,
    saveWorkoutSession, toggleDay, deleteWorkoutSession,
  } = useWorkout();

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [stoppedDuration, setStoppedDuration] = useState(0);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [currentExName, setCurrentExName] = useState('');
  const [currentMuscle, setCurrentMuscle] = useState('');
  const [currentMuscles, setCurrentMuscles] = useState<string[]>([]);

  const markedDates = useMemo(() => markedDays.map((d) => new Date(d + 'T00:00:00')), [markedDays]);

  const handleStop = () => {
    const dur = stopWorkout();
    if (dur > 0) {
      setStoppedDuration(dur);
      setExercises([]);
      setShowFinishModal(true);
    }
  };

  const addExercise = () => {
    if (!currentExName.trim()) return;
    setExercises((prev) => [...prev, { name: currentExName.trim(), muscles: [...currentMuscles] }]);
    setCurrentExName('');
    setCurrentMuscles([]);
  };

  const addMuscle = () => {
    const m = currentMuscle.trim();
    if (m && !currentMuscles.includes(m)) {
      setCurrentMuscles((prev) => [...prev, m]);
    }
    setCurrentMuscle('');
  };

  const removeMuscle = (m: string) => {
    setCurrentMuscles((prev) => prev.filter((x) => x !== m));
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveWorkout = () => {
    saveWorkoutSession(stoppedDuration, exercises);
    setShowFinishModal(false);
    setStoppedDuration(0);
    setExercises([]);
  };

  const handleDayClick = (date: Date | undefined) => {
    if (date) toggleDay(format(date, 'yyyy-MM-dd'));
  };

  const totalMuscleTime = muscleDistribution.reduce((s, m) => s + m.value, 0);

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={studyTimerRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
              <Dumbbell className="w-8 h-8 text-primary" />
              Workout Tracker
            </h1>
            <p className="text-muted-foreground">Track workouts, streaks, and progress</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
            {/* Timer */}
            <div className="stat-card">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Workout Timer</h3>
                </div>
                <div className="text-center py-4">
                  <div className={`font-display text-5xl font-bold tracking-tight transition-colors ${isRunning ? 'text-primary' : 'text-foreground'}`}>
                    {formatTime(elapsed)}
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {!isRunning && elapsed === 0 && (
                    <Button onClick={startWorkout} className="w-full gradient-primary border-0">
                      <Play className="w-4 h-4 mr-2" />Start Workout
                    </Button>
                  )}
                  {isRunning && (
                    <>
                      <Button onClick={pauseWorkout} variant="secondary" className="flex-1">
                        <Pause className="w-4 h-4 mr-2" />Pause
                      </Button>
                      <Button onClick={handleStop} variant="destructive" className="flex-1">
                        <Square className="w-4 h-4 mr-2" />Stop
                      </Button>
                    </>
                  )}
                  {!isRunning && elapsed > 0 && (
                    <>
                      <Button onClick={startWorkout} className="flex-1 gradient-primary border-0">
                        <Play className="w-4 h-4 mr-2" />Resume
                      </Button>
                      <Button onClick={handleStop} variant="destructive" className="flex-1">
                        <Square className="w-4 h-4 mr-2" />Stop
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Streak Stats */}
            <div className="stat-card">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-accent" />
                  <h3 className="font-display font-semibold">Streaks</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="font-display text-3xl font-bold text-primary">{streaks.current}</p>
                    <p className="text-xs text-muted-foreground">Current Streak</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="font-display text-3xl font-bold text-accent">{streaks.longest}</p>
                    <p className="text-xs text-muted-foreground">Longest Streak</p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Workout Time</p>
                  <p className="font-display text-xl font-bold text-primary">{formatTimeShort(totalWorkoutTime) || '0m'}</p>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="stat-card md:col-span-2 lg:col-span-1">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Workout Calendar</h3>
                </div>
                <Calendar
                  mode="single"
                  onSelect={handleDayClick}
                  modifiers={{ marked: markedDates }}
                  modifiersStyles={{
                    marked: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: '50%' },
                  }}
                  className="mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Muscle Distribution */}
            <div className="stat-card">
              <div className="relative z-10">
                <h3 className="font-display font-semibold mb-4">Muscle Group Distribution</h3>
                {muscleDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={muscleDistribution}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={90}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name} ${totalMuscleTime > 0 ? Math.round((value / totalMuscleTime) * 100) : 0}%`}
                        >
                          {muscleDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatTimeShort(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Comparison */}
            <div className="stat-card">
              <div className="relative z-10">
                <h3 className="font-display font-semibold mb-4">Weekly Workout Time</h3>
                {weeklyComparison.every((w) => w.total === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 60)}m`} />
                        <Tooltip formatter={(v: number) => formatTimeShort(v)} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="stat-card">
            <div className="relative z-10">
              <h3 className="font-display font-semibold mb-4">Recent Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No workout sessions yet. Start your first workout!</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {[...sessions].reverse().slice(0, 20).map((sess) => (
                    <div key={sess.id} className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/50 group">
                      <Dumbbell className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{format(new Date(sess.date), 'MMM d, yyyy')} · {formatTimeShort(sess.duration)}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sess.exercises.map((ex, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{ex.name}</Badge>
                          ))}
                          {sess.exercises.length === 0 && <span className="text-xs text-muted-foreground">No exercises logged</span>}
                        </div>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => deleteWorkoutSession(sess.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Finish Workout Modal */}
      <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Workouts Completed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Duration: <span className="font-semibold text-foreground">{formatTime(stoppedDuration)}</span></p>

            {/* Exercise List */}
            {exercises.length > 0 && (
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary">
                    <span className="text-sm font-medium flex-1">{ex.name}</span>
                    <div className="flex gap-1 flex-wrap">
                      {ex.muscles.map((m) => (
                        <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeExercise(i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Exercise Form */}
            <div className="space-y-2 border rounded-lg p-3">
              <Input
                value={currentExName}
                onChange={(e) => setCurrentExName(e.target.value)}
                placeholder="Exercise name (e.g., Bench Press)"
              />
              <div className="flex gap-2">
                <Input
                  value={currentMuscle}
                  onChange={(e) => setCurrentMuscle(e.target.value)}
                  placeholder="Muscle (e.g., Chest)"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMuscle())}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addMuscle} disabled={!currentMuscle.trim()}>
                  Add
                </Button>
              </div>
              {currentMuscles.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {currentMuscles.map((m) => (
                    <Badge key={m} variant="secondary" className="cursor-pointer" onClick={() => removeMuscle(m)}>
                      {m} <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
              <Button size="sm" onClick={addExercise} disabled={!currentExName.trim()} className="w-full">
                <Plus className="w-4 h-4 mr-1" />Add Exercise
              </Button>
            </div>

            <Button onClick={handleSaveWorkout} className="w-full gradient-primary border-0">
              Save Workout Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkoutPage;
