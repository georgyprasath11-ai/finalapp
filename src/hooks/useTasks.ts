import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Task } from '@/types/study';

const TASKS_KEY = 'study-tasks';

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>(TASKS_KEY, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completed: false,
      isBacklog: false,
    };
    setTasks((prev) => [...prev, newTask]);
    return newTask;
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, ...updates }
          : task
      )
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [setTasks]);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, completed: true, completedAt: new Date().toISOString(), isBacklog: false }
          : task
      )
    );
  }, [setTasks]);

  const uncompleteTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, completed: false, completedAt: undefined }
          : task
      )
    );
  }, [setTasks]);

  // Move task to backlog
  const moveToBacklog = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { 
              ...task, 
              isBacklog: true, 
              originalDate: task.scheduledDate || task.createdAt.split('T')[0]
            }
          : task
      )
    );
  }, [setTasks]);

  // Reschedule task from backlog to a new date
  const rescheduleTask = useCallback((id: string, newDate: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { 
              ...task, 
              scheduledDate: newDate, 
              isBacklog: false 
            }
          : task
      )
    );
  }, [setTasks]);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Active tasks (not completed and not in backlog)
  const activeTasks = useMemo(() => 
    tasks.filter((task) => !task.completed && !task.isBacklog),
    [tasks]
  );

  // Completed tasks
  const completedTasks = useMemo(() => 
    tasks.filter((task) => task.completed),
    [tasks]
  );

  // Backlog tasks (not completed and marked as backlog)
  const backlogTasks = useMemo(() => 
    tasks.filter((task) => !task.completed && task.isBacklog),
    [tasks]
  );

  // Group backlog tasks by date
  const backlogByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    backlogTasks.forEach((task) => {
      const date = task.originalDate || task.createdAt.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(task);
    });
    // Sort dates (oldest first)
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [date, tasks]) => {
        acc[date] = tasks;
        return acc;
      }, {} as Record<string, Task[]>);
  }, [backlogTasks]);

  return {
    tasks,
    activeTasks,
    completedTasks,
    backlogTasks,
    backlogByDate,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    moveToBacklog,
    rescheduleTask,
  };
}
