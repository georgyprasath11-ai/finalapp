import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { TimerState, StudySession } from '@/types/study';

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

  const startTimer = useCallback((subject: string, taskId?: string, category?: string) => {
    setTimerState({
      isRunning: true,
      elapsedTime: 0,
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

  const stopTimer = useCallback(() => {
    const finalElapsed = calculateCurrentElapsed();
    let newSession: StudySession | null = null;
    if (finalElapsed > 0 && timerState.currentSubject) {
      const now = new Date();
      const startTime = new Date(now.getTime() - finalElapsed * 1000);
      newSession = {
        id: crypto.randomUUID(),
        taskId: timerState.currentTaskId,
        subject: timerState.currentSubject,
        category: timerState.currentCategory,
        duration: finalElapsed,
        date: now.toISOString().split('T')[0],
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };
      setSessions((prev) => [...prev, newSession!]);
    }
    const taskId = timerState.currentTaskId;
    const duration = finalElapsed;
    setTimerState(initialTimerState);
    setDisplayTime(0);
    return { taskId, duration, session: newSession };
  }, [calculateCurrentElapsed, timerState.currentSubject, timerState.currentTaskId, timerState.currentCategory, setSessions, setTimerState]);

  const cancelTimer = useCallback(() => {
    setTimerState(initialTimerState);
    setDisplayTime(0);
  }, [setTimerState]);

  const resetTimer = useCallback(() => {
    setTimerState(initialTimerState);
    setDisplayTime(0);
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
    cancelTimer,
    resetTimer,
    updateSession,
    deleteSession,
  };
}
