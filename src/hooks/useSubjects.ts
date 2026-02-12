import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { CustomSubject, DEFAULT_SUBJECTS } from '@/types/study';

const SUBJECTS_KEY = 'study-subjects';

export function useSubjects() {
  const [subjects, setSubjects] = useLocalStorage<CustomSubject[]>(SUBJECTS_KEY, DEFAULT_SUBJECTS);

  const addSubject = useCallback((name: string, color: string) => {
    const newSubject: CustomSubject = {
      id: crypto.randomUUID(),
      name,
      color,
    };
    setSubjects((prev) => [...prev, newSubject]);
    return newSubject;
  }, [setSubjects]);

  const updateSubject = useCallback((id: string, updates: Partial<Omit<CustomSubject, 'id'>>) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, [setSubjects]);

  const deleteSubject = useCallback((id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }, [setSubjects]);

  const getSubjectColor = useCallback((name: string): string => {
    const subject = subjects.find((s) => s.name === name);
    return subject?.color || '160 10% 50%';
  }, [subjects]);

  const subjectNames = useMemo(() => subjects.map((s) => s.name), [subjects]);

  return {
    subjects,
    subjectNames,
    addSubject,
    updateSubject,
    deleteSubject,
    getSubjectColor,
  };
}
