import { useCallback, useMemo, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Task } from '@/types/study';

const TASKS_KEY = 'study-tasks';
const LAST_CHECK_KEY = 'study-last-auto-move';

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>(TASKS_KEY, []);
  const [lastCheck, setLastCheck] = useLocalStorage<string>(LAST_CHECK_KEY, '');

  // Auto-move unfinished tasks from past days to backlog + next day
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastCheck === today) return;

    setTasks((prev) => {
      let changed = false;
      const updated = prev.map((task) => {
        if (
          !task.completed &&
          !task.isBacklog &&
          task.scheduledDate &&
          task.scheduledDate < today
        ) {
          changed = true;
          return {
            ...task,
            isBacklog: true,
            originalDate: task.scheduledDate,
            scheduledDate: today, // reschedule to today
          };
        }
        return task;
      });
      return changed ? updated : prev;
    });
    setLastCheck(today);
  }, [lastCheck, setLastCheck, setTasks]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'accumulatedTime'>) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completed: false,
      isBacklog: false,
      accumulatedTime: 0,
    };
    setTasks((prev) => {
      // Prevent duplicate task names inside same category
      if (prev.some((t) => t.title.toLowerCase() === newTask.title.toLowerCase() && t.category === newTask.category && !t.completed)) {
        return prev;
      }
      return [...prev, newTask];
    });
    return newTask;
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    setTasks((prev) => prev.map((task) => task.id === id ? { ...task, ...updates } : task));
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [setTasks]);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: true, completedAt: new Date().toISOString(), isBacklog: false } : task
      )
    );
  }, [setTasks]);

  const uncompleteTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => task.id === id ? { ...task, completed: false, completedAt: undefined } : task)
    );
  }, [setTasks]);

  const moveToBacklog = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, isBacklog: true, originalDate: task.scheduledDate || task.createdAt.split('T')[0] }
          : task
      )
    );
  }, [setTasks]);

  const rescheduleTask = useCallback((id: string, newDate: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, scheduledDate: newDate, isBacklog: false } : task
      )
    );
  }, [setTasks]);

  // Add tracked time to a task
  const addTimeToTask = useCallback((id: string, seconds: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, accumulatedTime: (task.accumulatedTime || 0) + seconds }
          : task
      )
    );
  }, [setTasks]);

  const today = new Date().toISOString().split('T')[0];

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed && !task.isBacklog), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks]);
  const backlogTasks = useMemo(() => tasks.filter((task) => !task.completed && task.isBacklog), [tasks]);

  const backlogByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    backlogTasks.forEach((task) => {
      const date = task.originalDate || task.createdAt.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(task);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [date, tasks]) => { acc[date] = tasks; return acc; }, {} as Record<string, Task[]>);
  }, [backlogTasks]);

  // Get tasks filtered by category
  const getTasksByCategory = useCallback((category: string) => {
    return tasks.filter((task) => task.category === category);
  }, [tasks]);

  // Get active (non-completed, non-backlog) tasks by category
  const getActiveTasksByCategory = useCallback((category: string) => {
    return tasks.filter((task) => task.category === category && !task.completed && !task.isBacklog);
  }, [tasks]);

  // Total accumulated time for a category
  const getCategoryTotalTime = useCallback((category: string) => {
    return tasks
      .filter((t) => t.category === category)
      .reduce((sum, t) => sum + (t.accumulatedTime || 0), 0);
  }, [tasks]);

  return {
    tasks, activeTasks, completedTasks, backlogTasks, backlogByDate,
    addTask, updateTask, deleteTask, completeTask, uncompleteTask,
    moveToBacklog, rescheduleTask, addTimeToTask,
    getTasksByCategory, getActiveTasksByCategory, getCategoryTotalTime,
  };
}
