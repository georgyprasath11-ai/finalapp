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
  startTimestamp: undefined,
};

export function useStudyTimer() {
  const [timerState, setTimerState] = useLocalStorage<TimerState>(TIMER_STATE_KEY, initialTimerState);
  const [sessions, setSessions] = useLocalStorage<StudySession[]>(SESSIONS_KEY, []);
  const [displayTime, setDisplayTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Calculate current elapsed time including time since last timestamp
  const calculateCurrentElapsed = useCallback(() => {
    if (timerState.isRunning && timerState.startTimestamp) {
      const additionalTime = Math.floor((Date.now() - timerState.startTimestamp) / 1000);
      return timerState.elapsedTime + additionalTime;
    }
    return timerState.elapsedTime;
  }, [timerState.isRunning, timerState.startTimestamp, timerState.elapsedTime]);

  // Update display time on mount and when timer state changes
  useEffect(() => {
    setDisplayTime(calculateCurrentElapsed());
  }, [calculateCurrentElapsed]);

  // Timer tick effect
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, calculateCurrentElapsed]);

  const startTimer = useCallback((subject: string, taskId?: string) => {
    setTimerState({
      isRunning: true,
      elapsedTime: 0,
      currentSubject: subject,
      currentTaskId: taskId,
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
    
    if (finalElapsed > 0 && timerState.currentSubject) {
      const now = new Date();
      const startTime = new Date(now.getTime() - finalElapsed * 1000);
      
      const newSession: StudySession = {
        id: crypto.randomUUID(),
        taskId: timerState.currentTaskId,
        subject: timerState.currentSubject,
        duration: finalElapsed,
        date: now.toISOString().split('T')[0],
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };

      setSessions((prev) => [...prev, newSession]);
    }

    setTimerState(initialTimerState);
    setDisplayTime(0);
  }, [calculateCurrentElapsed, timerState.currentSubject, timerState.currentTaskId, setSessions, setTimerState]);

  const resetTimer = useCallback(() => {
    setTimerState(initialTimerState);
    setDisplayTime(0);
  }, [setTimerState]);

  return {
    displayTime,
    isRunning: timerState.isRunning,
    currentSubject: timerState.currentSubject,
    currentTaskId: timerState.currentTaskId,
    sessions,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
  };
}
