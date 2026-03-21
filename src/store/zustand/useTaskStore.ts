import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Task, TaskCategory, UserData } from "@/types/models";
import { idbStorage } from "@/store/zustand/idbStorage";

interface TaskStoreState {
  profileId: string | null;
  tasks: Task[];
  categories: TaskCategory[];
  activeCategoryId: string | null;
  updatedAt: string | null;
  syncFromAppData: (data: UserData | null) => void;
  clear: () => void;
}

interface PersistedTaskStore {
  profileId: string | null;
  tasks: Task[];
  categories: TaskCategory[];
  activeCategoryId: string | null;
  updatedAt: string | null;
}

const STORE_VERSION = 1;
const STORE_KEY = "study-dashboard:zustand:tasks";

const initialPersistedState: PersistedTaskStore = {
  profileId: null,
  tasks: [],
  categories: [],
  activeCategoryId: null,
  updatedAt: null,
};

const coercePersistedState = (value: unknown): PersistedTaskStore => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedTaskStore>;
  return {
    profileId: typeof record.profileId === "string" ? record.profileId : null,
    tasks: Array.isArray(record.tasks) ? record.tasks : [],
    categories: Array.isArray(record.categories) ? record.categories : [],
    activeCategoryId: typeof record.activeCategoryId === "string" ? record.activeCategoryId : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      syncFromAppData: (data) => {
        if (!data) {
          set({ ...initialPersistedState });
          return;
        }

        set({
          profileId: data.profileId,
          tasks: data.tasks,
          categories: data.categories ?? [],
          activeCategoryId: data.activeCategoryId ?? null,
          updatedAt: data.updatedAt,
        });
      },
      clear: () => set({ ...initialPersistedState }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        profileId: state.profileId,
        tasks: state.tasks,
        categories: state.categories,
        activeCategoryId: state.activeCategoryId,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
