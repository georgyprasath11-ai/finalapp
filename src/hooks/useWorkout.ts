import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface WorkoutExercise {
  name: string;
  muscles: string[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  duration: number; // seconds
  startTime: string;
  endTime: string;
  exercises: WorkoutExercise[];
}

const WORKOUT_SESSIONS_KEY = 'workout-sessions';
const WORKOUT_DAYS_KEY = 'workout-marked-days';

export function useWorkout() {
  const [sessions, setSessions] = useLocalStorage<WorkoutSession[]>(WORKOUT_SESSIONS_KEY, []);
  const [markedDays, setMarkedDays] = useLocalStorage<string[]>(WORKOUT_DAYS_KEY, []);

  // Timer state (local, not persisted)
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsed(elapsedBaseRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const startWorkout = useCallback(() => {
    startTimeRef.current = Date.now();
    elapsedBaseRef.current = elapsed;
    setIsRunning(true);
  }, [elapsed]);

  const pauseWorkout = useCallback(() => {
    elapsedBaseRef.current = elapsed;
    setIsRunning(false);
  }, [elapsed]);

  const stopWorkout = useCallback(() => {
    const finalElapsed = elapsed;
    setIsRunning(false);
    setElapsed(0);
    elapsedBaseRef.current = 0;
    return finalElapsed;
  }, [elapsed]);

  const resetWorkout = useCallback(() => {
    setIsRunning(false);
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, []);

  const saveWorkoutSession = useCallback((duration: number, exercises: WorkoutExercise[]) => {
    if (duration <= 0) return;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const newSession: WorkoutSession = {
      id: crypto.randomUUID(),
      date: dateStr,
      duration,
      startTime: new Date(now.getTime() - duration * 1000).toISOString(),
      endTime: now.toISOString(),
      exercises,
    };
    setSessions((prev) => [...prev, newSession]);
    // Auto-mark this day
    setMarkedDays((prev) => prev.includes(dateStr) ? prev : [...prev, dateStr]);
  }, [setSessions, setMarkedDays]);

  const toggleDay = useCallback((dateStr: string) => {
    setMarkedDays((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  }, [setMarkedDays]);

  const deleteWorkoutSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, [setSessions]);

  // Streak calculations
  const streaks = useMemo(() => {
    if (markedDays.length === 0) return { current: 0, longest: 0 };
    const sorted = [...markedDays].sort();
    let current = 0;
    let longest = 0;
    let streak = 1;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        streak++;
      } else {
        longest = Math.max(longest, streak);
        streak = 1;
      }
    }
    longest = Math.max(longest, streak);

    // Current streak: must include today or yesterday
    const lastDay = sorted[sorted.length - 1];
    if (lastDay === today || lastDay === yesterday) {
      streak = 1;
      for (let i = sorted.length - 2; i >= 0; i--) {
        const prev = new Date(sorted[i]);
        const curr = new Date(sorted[i + 1]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) {
          streak++;
        } else break;
      }
      current = streak;
    }

    return { current, longest };
  }, [markedDays]);

  // Analytics
  const totalWorkoutTime = useMemo(() => sessions.reduce((s, sess) => s + sess.duration, 0), [sessions]);

  const muscleDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach((sess) => {
      const timePerExercise = sess.exercises.length > 0 ? sess.duration / sess.exercises.length : 0;
      sess.exercises.forEach((ex) => {
        ex.muscles.forEach((m) => {
          const ml = m.toLowerCase().trim();
          if (ml) map[ml] = (map[ml] || 0) + timePerExercise / (ex.muscles.length || 1);
        });
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [sessions]);

  const weeklyComparison = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; total: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      const total = sessions
        .filter((s) => s.date >= startStr && s.date <= endStr)
        .reduce((sum, s) => sum + s.duration, 0);
      weeks.push({ label: `Week ${4 - w}`, total });
    }
    return weeks;
  }, [sessions]);

  return {
    sessions,
    markedDays,
    isRunning,
    elapsed,
    streaks,
    totalWorkoutTime,
    muscleDistribution,
    weeklyComparison,
    startWorkout,
    pauseWorkout,
    stopWorkout,
    resetWorkout,
    saveWorkoutSession,
    toggleDay,
    deleteWorkoutSession,
  };
}
