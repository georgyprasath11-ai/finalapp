import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PendingReflection, TimerSnapshot, UserData } from "@/types/models";
import { DEFAULT_TIMER_SNAPSHOT } from "@/lib/constants";
import { idbStorage } from "@/store/zustand/idbStorage";

interface TimerStoreState {
  profileId: string | null;
  timer: TimerSnapshot;
  pendingReflection: PendingReflection | null;
  targetCycles: number | null;
  updatedAt: string | null;
  syncFromAppData: (data: UserData | null, pendingReflection: PendingReflection | null) => void;
  setTargetCycles: (n: number | null) => void;
  clear: () => void;
}

interface PersistedTimerStore {
  profileId: string | null;
  timer: TimerSnapshot;
  pendingReflection: PendingReflection | null;
  targetCycles: number | null;
  updatedAt: string | null;
}

const STORE_KEY = "study-dashboard:zustand:timer";
const STORE_VERSION = 1;

const initialPersistedState: PersistedTimerStore = {
  profileId: null,
  timer: { ...DEFAULT_TIMER_SNAPSHOT },
  pendingReflection: null,
  targetCycles: null,
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
    targetCycles:
      typeof record.targetCycles === "number" && Number.isFinite(record.targetCycles) && record.targetCycles >= 1
        ? Math.floor(record.targetCycles)
        : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useTimerStore = create<TimerStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      syncFromAppData: (data, pendingReflection) => {
        if (!data) {
          set({ ...initialPersistedState, pendingReflection, targetCycles: null });
          return;
        }

        set({
          profileId: data.profileId,
          timer: data.timer,
          pendingReflection,
          updatedAt: data.updatedAt,
        });
      },
      setTargetCycles: (n) => {
        const normalized =
          typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : null;
        set({ targetCycles: normalized });
      },
      clear: () => set({ ...initialPersistedState }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        profileId: state.profileId,
        timer: state.timer,
        pendingReflection: state.pendingReflection,
        targetCycles: state.targetCycles,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
