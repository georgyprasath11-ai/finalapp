import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { TimerState, StudySession, SessionRating } from '@/types/study';

const TIMER_STATE_KEY = 'study-timer-state';
const SESSIONS_KEY = 'study-sessions';

const initialTimerState: TimerState = {
  isRunning: false,
  elapsedTime: 0,
  currentSubject: '',
  currentTaskId: undefined,
  currentCategory: undefined,
  startTimestamp: undefined,
};

export function useStudyTimer() {
  const [timerState, setTimerState] = useLocalStorage<TimerState>(TIMER_STATE_KEY, initialTimerState);
  const [sessions, setSessions] = useLocalStorage<StudySession[]>(SESSIONS_KEY, []);
  const [displayTime, setDisplayTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const calculateCurrentElapsed = useCallback(() => {
    if (timerState.isRunning && timerState.startTimestamp) {
      const additionalTime = Math.floor((Date.now() - timerState.startTimestamp) / 1000);
      return timerState.elapsedTime + additionalTime;
    }
    return timerState.elapsedTime;
  }, [timerState.isRunning, timerState.startTimestamp, timerState.elapsedTime]);

  useEffect(() => {
    setDisplayTime(calculateCurrentElapsed());
  }, [calculateCurrentElapsed]);

  useEffect(() => {
    if (timerState.isRunning) {
      intervalRef.current = window.setInterval(() => {
        setDisplayTime(calculateCurrentElapsed());
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState.isRunning, calculateCurrentElapsed]);

  const startTimer = useCallback((subject: string, taskId?: string, category?: string, initialElapsed?: number) => {
    const elapsed = initialElapsed || 0;
    setTimerState({
      isRunning: true,
      elapsedTime: elapsed,
      currentSubject: subject,
      currentTaskId: taskId,
      currentCategory: category,
      startTimestamp: Date.now(),
    });
  }, [setTimerState]);

  const pauseTimer = useCallback(() => {
    const currentElapsed = calculateCurrentElapsed();
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      elapsedTime: currentElapsed,
      startTimestamp: undefined,
    }));
  }, [setTimerState, calculateCurrentElapsed]);

  const resumeTimer = useCallback(() => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: true,
      startTimestamp: Date.now(),
    }));
  }, [setTimerState]);

  // stopTimer now returns data but does NOT save session yet (wait for reflection)
  const stopTimer = useCallback(() => {
    const finalElapsed = calculateCurrentElapsed();
    const taskId = timerState.currentTaskId;
    const subject = timerState.currentSubject;
    const category = timerState.currentCategory;
    const duration = finalElapsed;
    setTimerState(initialTimerState);
    setDisplayTime(0);
    return { taskId, duration, subject, category };
  }, [calculateCurrentElapsed, timerState.currentSubject, timerState.currentTaskId, timerState.currentCategory, setTimerState]);

  // Save session after reflection
  const saveSession = useCallback((subject: string, duration: number, taskId?: string, category?: string, rating?: SessionRating, note?: string) => {
    if (duration <= 0) return null;
    const now = new Date();
    const startTime = new Date(now.getTime() - duration * 1000);
    const newSession: StudySession = {
      id: crypto.randomUUID(),
      taskId,
      subject,
      category,
      duration,
      date: now.toISOString().split('T')[0],
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      rating,
      note,
    };
    setSessions((prev) => [...prev, newSession]);
    return newSession;
  }, [setSessions]);

  const cancelTimer = useCallback(() => {
    setTimerState(initialTimerState);
    setDisplayTime(0);
  }, [setTimerState]);

  const resetTimer = useCallback(() => {
    setTimerState(initialTimerState);
    setDisplayTime(0);
  }, [setTimerState]);

  // Preload time for continuation (paused state, no subject yet)
  const preloadTime = useCallback((seconds: number) => {
    setTimerState((prev) => ({
      ...prev,
      isRunning: false,
      elapsedTime: seconds,
      startTimestamp: undefined,
    }));
    setDisplayTime(seconds);
  }, [setTimerState]);

  // Session management
  const updateSession = useCallback((id: string, updates: Partial<Omit<StudySession, 'id'>>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, [setSessions]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, [setSessions]);

  return {
    displayTime,
    isRunning: timerState.isRunning,
    currentSubject: timerState.currentSubject,
    currentTaskId: timerState.currentTaskId,
    currentCategory: timerState.currentCategory,
    sessions,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    saveSession,
    cancelTimer,
    resetTimer,
    preloadTime,
    updateSession,
    deleteSession,
  };
}
