import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { TaskCategory, DEFAULT_CATEGORIES } from '@/types/study';

const CATEGORIES_KEY = 'study-categories';

export function useCategories() {
  const [categories, setCategories] = useLocalStorage<TaskCategory[]>(CATEGORIES_KEY, DEFAULT_CATEGORIES);

  const addCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Prevent duplicates
    setCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, { id: crypto.randomUUID(), name: trimmed }];
    });
  }, [setCategories]);

  const renameCategory = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
    );
  }, [setCategories]);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, [setCategories]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  return { categories, categoryNames, addCategory, renameCategory, deleteCategory };
}
