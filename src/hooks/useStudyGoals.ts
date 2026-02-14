import { useLocalStorage } from './useLocalStorage';
import { StudyGoals } from '@/types/study';
import { useCallback } from 'react';

const GOALS_KEY = 'study-goals';

const defaultGoals: StudyGoals = {
  weeklyHours: 20,
  monthlyHours: 80,
  yearlyHours: 900,
};

export function useStudyGoals() {
  const [goals, setGoals] = useLocalStorage<StudyGoals>(GOALS_KEY, defaultGoals);

  const updateGoals = useCallback((updates: Partial<StudyGoals>) => {
    setGoals((prev) => ({ ...prev, ...updates }));
  }, [setGoals]);

  return { goals, updateGoals };
}
