import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Subject, UserData } from "@/types/models";

interface SubjectStoreState {
  profileId: string | null;
  subjects: Subject[];
  updatedAt: string | null;
  syncFromAppData: (data: UserData | null) => void;
  clear: () => void;
}

interface PersistedSubjectStore {
  profileId: string | null;
  subjects: Subject[];
  updatedAt: string | null;
}

const STORE_KEY = "study-dashboard:zustand:subjects";
const STORE_VERSION = 1;

const initialPersistedState: PersistedSubjectStore = {
  profileId: null,
  subjects: [],
  updatedAt: null,
};

const coercePersistedState = (value: unknown): PersistedSubjectStore => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedSubjectStore>;
  return {
    profileId: typeof record.profileId === "string" ? record.profileId : null,
    subjects: Array.isArray(record.subjects) ? record.subjects : [],
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useSubjectStore = create<SubjectStoreState>()(
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
          subjects: data.subjects,
          updatedAt: data.updatedAt,
        });
      },
      clear: () => set({ ...initialPersistedState }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profileId: state.profileId,
        subjects: state.subjects,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
