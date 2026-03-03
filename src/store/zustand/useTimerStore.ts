import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PendingReflection, TimerSnapshot, UserData } from "@/types/models";
import { DEFAULT_TIMER_SNAPSHOT } from "@/lib/constants";

interface TimerStoreState {
  profileId: string | null;
  timer: TimerSnapshot;
  pendingReflection: PendingReflection | null;
  updatedAt: string | null;
  syncFromAppData: (data: UserData | null, pendingReflection: PendingReflection | null) => void;
  clear: () => void;
}

interface PersistedTimerStore {
  profileId: string | null;
  timer: TimerSnapshot;
  pendingReflection: PendingReflection | null;
  updatedAt: string | null;
}

const STORE_KEY = "study-dashboard:zustand:timer";
const STORE_VERSION = 1;

const initialPersistedState: PersistedTimerStore = {
  profileId: null,
  timer: { ...DEFAULT_TIMER_SNAPSHOT },
  pendingReflection: null,
  updatedAt: null,
};

const coercePersistedState = (value: unknown): PersistedTimerStore => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedTimerStore>;
  return {
    profileId: typeof record.profileId === "string" ? record.profileId : null,
    timer: record.timer ? { ...DEFAULT_TIMER_SNAPSHOT, ...record.timer } : { ...DEFAULT_TIMER_SNAPSHOT },
    pendingReflection: record.pendingReflection ?? null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useTimerStore = create<TimerStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      syncFromAppData: (data, pendingReflection) => {
        if (!data) {
          set({ ...initialPersistedState, pendingReflection });
          return;
        }

        set({
          profileId: data.profileId,
          timer: data.timer,
          pendingReflection,
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
        timer: state.timer,
        pendingReflection: state.pendingReflection,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
