import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AppAnalytics } from "@/types/models";
import { idbStorage } from "@/store/zustand/idbStorage";

interface AnalyticsStoreState {
  profileId: string | null;
  analytics: AppAnalytics;
  updatedAt: string | null;
  syncFromAppData: (profileId: string | null, analytics: AppAnalytics, updatedAt: string | null) => void;
  clear: () => void;
}

interface PersistedAnalyticsStore {
  profileId: string | null;
  analytics: AppAnalytics;
  updatedAt: string | null;
}

const STORE_KEY = "study-dashboard:zustand:analytics";
const STORE_VERSION = 1;

const defaultAnalytics: AppAnalytics = {
  todayStudyMs: 0,
  productivityPercent: 0,
  streakDays: 0,
  bestDayLabel: "No study day yet",
  bestDayMinutes: 0,
  weeklyTotalMs: 0,
  previousWeekTotalMs: 0,
  monthlyTotalMs: 0,
  previousMonthTotalMs: 0,
};

const initialPersistedState: PersistedAnalyticsStore = {
  profileId: null,
  analytics: { ...defaultAnalytics },
  updatedAt: null,
};

const coercePersistedState = (value: unknown): PersistedAnalyticsStore => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedAnalyticsStore>;
  return {
    profileId: typeof record.profileId === "string" ? record.profileId : null,
    analytics: record.analytics ? { ...defaultAnalytics, ...record.analytics } : { ...defaultAnalytics },
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useAnalyticsStore = create<AnalyticsStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      syncFromAppData: (profileId, analytics, updatedAt) =>
        set({
          profileId,
          analytics: { ...defaultAnalytics, ...analytics },
          updatedAt,
        }),
      clear: () => set({ ...initialPersistedState }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        profileId: state.profileId,
        analytics: state.analytics,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
