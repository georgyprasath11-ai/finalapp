/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useNow } from "@/hooks/useNow";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { loadBundledCheckboxSounds, filenameWithoutExtension } from "@/lib/checkbox-sounds";
import {
  computeDailyTaskAnalytics,
  emptyDailyTaskStats,
  getTomorrowIso,
  isIsoDate,
  isTodayOrTomorrow,
  nextDailyTaskStats,
  splitTimedTasksByType,
} from "@/lib/daily-tasks";
import {
  CHECKBOX_SOUND_SCHEMA_VERSION,
  DAILY_TASKS_SCHEMA_VERSION,
  STORAGE_KEYS,
} from "@/lib/constants";
import { useAppStore } from "@/store/app-store";
import {
  CheckboxSound,
  DailyTask,
  DailyTaskDayStats,
  DailyTasksState,
  TaskPriority,
  TaskType,
  TimedTask,
} from "@/types/models";
import { dayDiff, todayIsoDate } from "@/utils/date";
import { createId } from "@/utils/id";

interface DailyTaskMutationResult {
  ok: boolean;
  error?: string;
}

interface DailyTaskInput {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
}

interface UpdateDailyTaskInput {
  title?: string;
  priority?: TaskPriority;
  scheduledFor?: string;
}

interface DailyTaskStoreValue {
  isReady: boolean;
  todayIso: string;
  tomorrowIso: string;
  dailyTasks: DailyTask[];
  todayTasks: DailyTask[];
  tomorrowTasks: DailyTask[];
  shortTermTasks: TimedTask[];
  longTermTasks: TimedTask[];
  statsByDate: Record<string, DailyTaskDayStats>;
  analytics: ReturnType<typeof computeDailyTaskAnalytics>;
  checkboxSounds: CheckboxSound[];
  selectedSound: CheckboxSound | null;
  selectedSoundId: string | null;
  addDailyTask: (input: DailyTaskInput) => DailyTaskMutationResult;
  updateDailyTask: (taskId: string, input: UpdateDailyTaskInput) => DailyTaskMutationResult;
  deleteDailyTask: (taskId: string) => void;
  toggleDailyTask: (taskId: string, completed: boolean, playSound?: boolean) => void;
  uploadCheckboxSound: (file: File) => Promise<DailyTaskMutationResult>;
  selectCheckboxSound: (soundId: string) => void;
  deleteCheckboxSound: (soundId: string) => void;
  previewCheckboxSound: (soundId?: string) => void;
}

const DailyTaskContext = createContext<DailyTaskStoreValue | undefined>(undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDailyTaskPriority = (value: unknown): value is TaskPriority =>
  value === "high" || value === "medium" || value === "low";

const isDailyTask = (value: unknown): value is DailyTask => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.scheduledFor === "string" &&
    isDailyTaskPriority(value.priority) &&
    typeof value.completed === "boolean" &&
    value.type === TaskType.DAILY
  );
};

const isDailyTasksState = (value: unknown): value is DailyTasksState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.version === "number" &&
    Array.isArray(value.tasks) &&
    value.tasks.every((task) => isDailyTask(task)) &&
    isRecord(value.statsByDate) &&
    (typeof value.lastRolloverDate === "string" || value.lastRolloverDate === null)
  );
};

const isCheckboxSound = (value: unknown): value is CheckboxSound => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    (value.source === "bundled" || value.source === "uploaded")
  );
};

const isCheckboxSoundList = (value: unknown): value is CheckboxSound[] =>
  Array.isArray(value) && value.every((item) => isCheckboxSound(item));

const isTimedTask = (value: unknown): value is TimedTask => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.scheduledFor === "string" &&
    (value.type === TaskType.SHORT_TERM || value.type === TaskType.LONG_TERM)
  );
};

const isTimedTaskList = (value: unknown): value is TimedTask[] =>
  Array.isArray(value) && value.every((item) => isTimedTask(item));

const sortDailyTasks = (tasks: DailyTask[]): DailyTask[] =>
  [...tasks].sort((a, b) => {
    const dateCompare = a.scheduledFor.localeCompare(b.scheduledFor);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.createdAt.localeCompare(b.createdAt);
  });

const fallbackDailyTasksState: DailyTasksState = {
  version: DAILY_TASKS_SCHEMA_VERSION,
  tasks: [],
  statsByDate: {},
  lastRolloverDate: null,
};

const updateDateStats = (
  statsByDate: Record<string, DailyTaskDayStats>,
  dateIso: string,
  options: {
    totalDelta?: number;
    completedDelta?: number;
    rolloverDelta?: number;
    priority?: TaskPriority;
    priorityDelta?: number;
  },
): Record<string, DailyTaskDayStats> => {
  const previous = statsByDate[dateIso] ?? emptyDailyTaskStats();
  const nextByPriority = {
    ...previous.byPriority,
  };

  if (options.priority) {
    const delta = options.priorityDelta ?? 0;
    nextByPriority[options.priority] = Math.max(0, (nextByPriority[options.priority] ?? 0) + delta);
  }

  const next = nextDailyTaskStats(previous, {
    total: previous.total + (options.totalDelta ?? 0),
    completed: previous.completed + (options.completedDelta ?? 0),
    rollover: previous.rollover + (options.rolloverDelta ?? 0),
    byPriority: nextByPriority,
  });

  return {
    ...statsByDate,
    [dateIso]: next,
  };
};

const normalizeSoundLabel = (raw: string): string => {
  const candidate = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return "Custom Sound";
  }

  return candidate.replace(/\b\w/g, (char) => char.toUpperCase());
};

const dedupeSoundName = (rawName: string, existingNames: Set<string>): string => {
  if (!existingNames.has(rawName.toLowerCase())) {
    existingNames.add(rawName.toLowerCase());
    return rawName;
  }

  let suffix = 2;
  while (existingNames.has(`${rawName.toLowerCase()} (${suffix})`)) {
    suffix += 1;
  }

  const deduped = `${rawName} (${suffix})`;
  existingNames.add(deduped.toLowerCase());
  return deduped;
};

const fallbackClickTone = () => {
  try {
    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "triangle";
    osc.frequency.value = 820;
    gain.gain.value = 0.05;

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start();
    osc.stop(context.currentTime + 0.14);

    osc.onended = () => {
      context.close().catch(() => {
        // Ignore audio context close errors.
      });
    };
  } catch {
    // Ignore browser audio restrictions.
  }
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unsupported file payload."));
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const MAX_SOUND_UPLOAD_BYTES = 2_500_000;

export function DailyTaskProvider({ children }: { children: React.ReactNode }) {
  const now = useNow(60_000);
  const { activeProfile, data } = useAppStore();

  const todayIso = useMemo(() => todayIsoDate(new Date(now)), [now]);
  const tomorrowIso = useMemo(() => getTomorrowIso(todayIso), [todayIso]);

  const profileId = activeProfile?.id ?? "__inactive__";

  const dailyTasksStorage = useLocalStorage<DailyTasksState>({
    key: STORAGE_KEYS.dailyTasks(profileId),
    version: DAILY_TASKS_SCHEMA_VERSION,
    initialValue: fallbackDailyTasksState,
    validate: isDailyTasksState,
  });

  const shortTermStorage = useLocalStorage<TimedTask[]>({
    key: STORAGE_KEYS.shortTermTasks(profileId),
    version: 1,
    initialValue: [],
    validate: isTimedTaskList,
  });

  const longTermStorage = useLocalStorage<TimedTask[]>({
    key: STORAGE_KEYS.longTermTasks(profileId),
    version: 1,
    initialValue: [],
    validate: isTimedTaskList,
  });

  const checkboxSoundsStorage = useLocalStorage<CheckboxSound[]>({
    key: STORAGE_KEYS.checkboxSounds(profileId),
    version: CHECKBOX_SOUND_SCHEMA_VERSION,
    initialValue: [],
    validate: isCheckboxSoundList,
  });

  const selectedSoundStorage = useLocalStorage<string | null>({
    key: STORAGE_KEYS.selectedSound(profileId),
    version: CHECKBOX_SOUND_SCHEMA_VERSION,
    initialValue: null,
    validate: (value): value is string | null => typeof value === "string" || value === null,
  });

  const bundledSounds = useMemo(() => loadBundledCheckboxSounds(), []);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    checkboxSoundsStorage.setValue((previous) => {
      const uploaded = previous.filter((sound) => sound.source === "uploaded");
      const next = [...bundledSounds, ...uploaded];

      if (next.length === previous.length && next.every((sound, index) => previous[index]?.id === sound.id)) {
        return previous;
      }

      return next;
    });
  }, [activeProfile, bundledSounds, checkboxSoundsStorage]);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    const allSounds = checkboxSoundsStorage.value;
    selectedSoundStorage.setValue((previous) => {
      if (previous && allSounds.some((sound) => sound.id === previous)) {
        return previous;
      }

      return allSounds[0]?.id ?? null;
    });
  }, [activeProfile, checkboxSoundsStorage.value, selectedSoundStorage]);

  useEffect(() => {
    if (!data || !activeProfile) {
      shortTermStorage.setValue([]);
      longTermStorage.setValue([]);
      return;
    }

    const futureTasks = data.tasks
      .filter((task) => {
        const due = task.dueDate ?? task.scheduledFor;
        return dayDiff(todayIso, due) > 1;
      })
      .map((task) => ({
        ...task,
        scheduledFor: task.dueDate ?? task.scheduledFor,
        dueDate: task.dueDate ?? task.scheduledFor,
      }));

    const split = splitTimedTasksByType(futureTasks, todayIso);
    shortTermStorage.setValue(split.shortTermTasks);
    longTermStorage.setValue(split.longTermTasks);
  }, [activeProfile, data, longTermStorage, shortTermStorage, todayIso]);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    dailyTasksStorage.setValue((previous) => {
      if (previous.lastRolloverDate === todayIso) {
        return previous;
      }

      let statsByDate = previous.statsByDate;
      let didRollover = false;
      const nowIso = new Date().toISOString();

      const tasks = previous.tasks.map((task) => {
        if (task.completed || task.scheduledFor >= todayIso) {
          return task;
        }

        didRollover = true;
        statsByDate = updateDateStats(statsByDate, todayIso, {
          totalDelta: 1,
          rolloverDelta: 1,
          priority: task.priority,
          priorityDelta: 1,
        });

        return {
          ...task,
          scheduledFor: todayIso,
          isRolledOver: true,
          rolloverCount: task.rolloverCount + 1,
          updatedAt: nowIso,
        } satisfies DailyTask;
      });

      if (!didRollover && previous.lastRolloverDate === todayIso) {
        return previous;
      }

      return {
        ...previous,
        tasks: sortDailyTasks(tasks),
        statsByDate,
        lastRolloverDate: todayIso,
      };
    });
  }, [activeProfile, dailyTasksStorage, todayIso]);

  const previewCheckboxSound = useCallback(
    (soundId?: string) => {
      const targetId = soundId ?? selectedSoundStorage.value;
      const target = checkboxSoundsStorage.value.find((sound) => sound.id === targetId) ?? null;
      if (!target) {
        fallbackClickTone();
        return;
      }

      try {
        const audio = new Audio(target.url);
        audio.currentTime = 0;
        audio.play().catch(() => {
          fallbackClickTone();
        });
      } catch {
        fallbackClickTone();
      }
    },
    [checkboxSoundsStorage.value, selectedSoundStorage.value],
  );

  const addDailyTask = useCallback(
    (input: DailyTaskInput): DailyTaskMutationResult => {
      if (!activeProfile) {
        return { ok: false, error: "No active profile selected." };
      }

      const title = input.title.trim();
      if (!title) {
        return { ok: false, error: "Task title is required." };
      }

      if (!isTodayOrTomorrow(input.scheduledFor, todayIso)) {
        return { ok: false, error: "Daily tasks can only be scheduled for Today or Tomorrow." };
      }

      const nowIso = new Date().toISOString();
      const task: DailyTask = {
        id: createId(),
        title,
        completed: false,
        priority: input.priority,
        createdAt: nowIso,
        scheduledFor: input.scheduledFor,
        type: TaskType.DAILY,
        rolloverCount: 0,
        isRolledOver: false,
        completedAt: null,
        updatedAt: nowIso,
      };

      dailyTasksStorage.setValue((previous) => {
        const statsByDate = updateDateStats(previous.statsByDate, task.scheduledFor, {
          totalDelta: 1,
          priority: task.priority,
          priorityDelta: 1,
        });

        return {
          ...previous,
          tasks: sortDailyTasks([...previous.tasks, task]),
          statsByDate,
        };
      });

      return { ok: true };
    },
    [activeProfile, dailyTasksStorage, todayIso],
  );

  const updateDailyTask = useCallback(
    (taskId: string, input: UpdateDailyTaskInput): DailyTaskMutationResult => {
      if (!activeProfile) {
        return { ok: false, error: "No active profile selected." };
      }

      if (input.scheduledFor && !isTodayOrTomorrow(input.scheduledFor, todayIso)) {
        return { ok: false, error: "Daily tasks can only be scheduled for Today or Tomorrow." };
      }

      let found = false;
      dailyTasksStorage.setValue((previous) => {
        let statsByDate = previous.statsByDate;

        const tasks = previous.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          found = true;
          const nextTitle = input.title?.trim() ? input.title.trim() : task.title;
          const nextPriority = input.priority ?? task.priority;
          const nextDate = input.scheduledFor ?? task.scheduledFor;

          const movedDate = nextDate !== task.scheduledFor;
          const changedPriority = nextPriority !== task.priority;

          if (movedDate || changedPriority) {
            statsByDate = updateDateStats(statsByDate, task.scheduledFor, {
              totalDelta: -1,
              completedDelta: task.completed ? -1 : 0,
              priority: task.priority,
              priorityDelta: -1,
            });

            statsByDate = updateDateStats(statsByDate, nextDate, {
              totalDelta: 1,
              completedDelta: task.completed ? 1 : 0,
              priority: nextPriority,
              priorityDelta: 1,
            });
          }

          return {
            ...task,
            title: nextTitle,
            priority: nextPriority,
            scheduledFor: nextDate,
            isRolledOver: movedDate ? false : task.isRolledOver,
            updatedAt: new Date().toISOString(),
          } satisfies DailyTask;
        });

        return {
          ...previous,
          tasks: sortDailyTasks(tasks),
          statsByDate,
        };
      });

      if (!found) {
        return { ok: false, error: "Task not found." };
      }

      return { ok: true };
    },
    [activeProfile, dailyTasksStorage, todayIso],
  );

  const deleteDailyTask = useCallback(
    (taskId: string) => {
      dailyTasksStorage.setValue((previous) => {
        const target = previous.tasks.find((task) => task.id === taskId);
        if (!target) {
          return previous;
        }

        const statsByDate = updateDateStats(previous.statsByDate, target.scheduledFor, {
          totalDelta: -1,
          completedDelta: target.completed ? -1 : 0,
          priority: target.priority,
          priorityDelta: -1,
        });

        return {
          ...previous,
          tasks: previous.tasks.filter((task) => task.id !== taskId),
          statsByDate,
        };
      });
    },
    [dailyTasksStorage],
  );

  const toggleDailyTask = useCallback(
    (taskId: string, completed: boolean, playSound = false) => {
      if (completed && playSound) {
        previewCheckboxSound();
      }

      dailyTasksStorage.setValue((previous) => {
        let statsByDate = previous.statsByDate;

        const tasks = previous.tasks.map((task) => {
          if (task.id !== taskId || task.completed === completed) {
            return task;
          }

          statsByDate = updateDateStats(statsByDate, task.scheduledFor, {
            completedDelta: completed ? 1 : -1,
          });

          return {
            ...task,
            completed,
            completedAt: completed ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          } satisfies DailyTask;
        });

        return {
          ...previous,
          tasks,
          statsByDate,
        };
      });
    },
    [dailyTasksStorage, previewCheckboxSound],
  );

  const uploadCheckboxSound = useCallback(
    async (file: File): Promise<DailyTaskMutationResult> => {
      if (!file.name.toLowerCase().endsWith(".mp3")) {
        return { ok: false, error: "Invalid file. Please upload an MP3 file." };
      }

      if (file.size > MAX_SOUND_UPLOAD_BYTES) {
        return { ok: false, error: "MP3 is too large. Keep uploads under 2.5MB." };
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const currentNames = new Set(checkboxSoundsStorage.value.map((sound) => sound.name.toLowerCase()));
        const baseName = normalizeSoundLabel(filenameWithoutExtension(file.name));
        const soundName = dedupeSoundName(baseName, currentNames);
        const soundId = `uploaded:${createId()}`;

        const uploaded: CheckboxSound = {
          id: soundId,
          name: soundName,
          source: "uploaded",
          url: dataUrl,
          createdAt: new Date().toISOString(),
        };

        checkboxSoundsStorage.setValue((previous) => [...previous, uploaded]);
        selectedSoundStorage.setValue(soundId);

        return { ok: true };
      } catch {
        return { ok: false, error: "Failed to read MP3 file." };
      }
    },
    [checkboxSoundsStorage, selectedSoundStorage],
  );

  const selectCheckboxSound = useCallback(
    (soundId: string) => {
      if (!checkboxSoundsStorage.value.some((sound) => sound.id === soundId)) {
        return;
      }

      selectedSoundStorage.setValue(soundId);
    },
    [checkboxSoundsStorage.value, selectedSoundStorage],
  );

  const deleteCheckboxSound = useCallback(
    (soundId: string) => {
      const target = checkboxSoundsStorage.value.find((sound) => sound.id === soundId);
      if (!target || target.source !== "uploaded") {
        return;
      }

      checkboxSoundsStorage.setValue((previous) => previous.filter((sound) => sound.id !== soundId));
      selectedSoundStorage.setValue((previous) => (previous === soundId ? null : previous));
    },
    [checkboxSoundsStorage, selectedSoundStorage],
  );

  const dailyTasks = dailyTasksStorage.value.tasks;
  const todayTasks = useMemo(
    () => sortDailyTasks(dailyTasks.filter((task) => task.scheduledFor === todayIso)),
    [dailyTasks, todayIso],
  );
  const tomorrowTasks = useMemo(
    () => sortDailyTasks(dailyTasks.filter((task) => task.scheduledFor === tomorrowIso)),
    [dailyTasks, tomorrowIso],
  );

  const analytics = useMemo(
    () => computeDailyTaskAnalytics(dailyTasks, dailyTasksStorage.value.statsByDate, todayIso),
    [dailyTasks, dailyTasksStorage.value.statsByDate, todayIso],
  );

  const selectedSound = useMemo(
    () => checkboxSoundsStorage.value.find((sound) => sound.id === selectedSoundStorage.value) ?? null,
    [checkboxSoundsStorage.value, selectedSoundStorage.value],
  );

  const contextValue = useMemo<DailyTaskStoreValue>(
    () => ({
      isReady: true,
      todayIso,
      tomorrowIso,
      dailyTasks,
      todayTasks,
      tomorrowTasks,
      shortTermTasks: shortTermStorage.value,
      longTermTasks: longTermStorage.value,
      statsByDate: dailyTasksStorage.value.statsByDate,
      analytics,
      checkboxSounds: checkboxSoundsStorage.value,
      selectedSound,
      selectedSoundId: selectedSoundStorage.value,
      addDailyTask,
      updateDailyTask,
      deleteDailyTask,
      toggleDailyTask,
      uploadCheckboxSound,
      selectCheckboxSound,
      deleteCheckboxSound,
      previewCheckboxSound,
    }),
    [
      addDailyTask,
      analytics,
      checkboxSoundsStorage.value,
      dailyTasks,
      dailyTasksStorage.value.statsByDate,
      deleteCheckboxSound,
      deleteDailyTask,
      longTermStorage.value,
      previewCheckboxSound,
      selectCheckboxSound,
      selectedSound,
      selectedSoundStorage.value,
      shortTermStorage.value,
      todayIso,
      todayTasks,
      toggleDailyTask,
      tomorrowIso,
      tomorrowTasks,
      updateDailyTask,
      uploadCheckboxSound,
    ],
  );

  return <DailyTaskContext.Provider value={contextValue}>{children}</DailyTaskContext.Provider>;
}

export function useDailyTaskStore(): DailyTaskStoreValue {
  const context = useContext(DailyTaskContext);
  if (!context) {
    throw new Error("useDailyTaskStore must be used inside DailyTaskProvider");
  }

  return context;
}


