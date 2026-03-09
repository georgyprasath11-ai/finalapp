import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Habit } from "@/types/models";
import { createId } from "@/utils/id";

interface HabitState {
  habits: Habit[];
  addHabit: (draft: Pick<Habit, "name" | "emoji" | "color">) => void;
  toggleHabitDay: (id: string, isoDate: string) => void;
  editHabit: (id: string, patch: Pick<Habit, "name" | "emoji" | "color">) => void;
  archiveHabit: (id: string) => void;
  deleteHabit: (id: string) => void;
  restoreHabit: (id: string) => void;
  setHabits: (habits: Habit[]) => void;
}

interface PersistedHabitState {
  habits: Habit[];
}

const STORE_KEY = "app:habits";
const STORE_VERSION = 1;

const initialPersistedState: PersistedHabitState = {
  habits: [],
};

const sortCompletions = (completions: string[]): string[] =>
  Array.from(new Set(completions)).sort((a, b) => a.localeCompare(b));

const normalizeHabit = (habit: Habit): Habit => ({
  ...habit,
  completions: sortCompletions(habit.completions ?? []),
});

const coercePersistedState = (value: unknown): PersistedHabitState => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedHabitState>;
  return {
    habits: Array.isArray(record.habits) ? (record.habits as Habit[]).map(normalizeHabit) : [],
  };
};

const nextId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createId();
};

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      addHabit: (draft) => {
        const nowIso = new Date().toISOString();
        const habit: Habit = {
          id: nextId(),
          name: draft.name.trim(),
          emoji: draft.emoji,
          color: draft.color,
          completions: [],
          createdAt: nowIso,
          archivedAt: null,
        };

        set((state) => ({
          habits: [...state.habits, habit],
        }));
      },
      toggleHabitDay: (id, isoDate) =>
        set((state) => ({
          habits: state.habits.map((habit) => {
            if (habit.id !== id) {
              return habit;
            }

            const exists = habit.completions.includes(isoDate);
            const completions = exists
              ? habit.completions.filter((date) => date !== isoDate)
              : [...habit.completions, isoDate];

            return {
              ...habit,
              completions: sortCompletions(completions),
            };
          }),
        })),
      editHabit: (id, patch) =>
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  name: patch.name.trim(),
                  emoji: patch.emoji,
                  color: patch.color,
                }
              : habit,
          ),
        })),
      archiveHabit: (id) =>
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  archivedAt: new Date().toISOString(),
                }
              : habit,
          ),
        })),
      restoreHabit: (id) =>
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  archivedAt: null,
                }
              : habit,
          ),
        })),
      deleteHabit: (id) =>
        set((state) => ({
          habits: state.habits.filter((habit) => habit.id !== id),
        })),
      setHabits: (habits) =>
        set({
          habits: habits.map(normalizeHabit),
        }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        habits: state.habits,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
