import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AppSettings, ParentViewerState, UserData, VacationModeState } from "@/types/models";
import { DEFAULT_PARENT_VIEWER, DEFAULT_SETTINGS, DEFAULT_VACATION_MODE } from "@/lib/constants";

interface SettingsStoreState {
  profileId: string | null;
  settings: AppSettings;
  vacationMode: VacationModeState;
  parentViewer: ParentViewerState;
  updatedAt: string | null;
  syncFromAppData: (data: UserData | null) => void;
  clear: () => void;
}

interface PersistedSettingsStore {
  profileId: string | null;
  settings: AppSettings;
  vacationMode: VacationModeState;
  parentViewer: ParentViewerState;
  updatedAt: string | null;
}

const STORE_KEY = "study-dashboard:zustand:settings";
const STORE_VERSION = 1;

const cloneDefaultSettings = (): AppSettings => ({
  ...DEFAULT_SETTINGS,
  goals: { ...DEFAULT_SETTINGS.goals },
  timer: { ...DEFAULT_SETTINGS.timer },
});

const cloneDefaultVacation = (): VacationModeState => ({
  ...DEFAULT_VACATION_MODE,
});

const cloneDefaultParentViewer = (): ParentViewerState => ({
  ...DEFAULT_PARENT_VIEWER,
  auditLog: [],
});

const initialPersistedState: PersistedSettingsStore = {
  profileId: null,
  settings: cloneDefaultSettings(),
  vacationMode: cloneDefaultVacation(),
  parentViewer: cloneDefaultParentViewer(),
  updatedAt: null,
};

const coercePersistedState = (value: unknown): PersistedSettingsStore => {
  if (!value || typeof value !== "object") {
    return {
      ...initialPersistedState,
      settings: cloneDefaultSettings(),
      vacationMode: cloneDefaultVacation(),
      parentViewer: cloneDefaultParentViewer(),
    };
  }

  const record = value as Partial<PersistedSettingsStore>;
  return {
    profileId: typeof record.profileId === "string" ? record.profileId : null,
    settings: record.settings
      ? {
          ...cloneDefaultSettings(),
          ...record.settings,
          goals: { ...DEFAULT_SETTINGS.goals, ...record.settings.goals },
          timer: { ...DEFAULT_SETTINGS.timer, ...record.settings.timer },
        }
      : cloneDefaultSettings(),
    vacationMode: record.vacationMode
      ? { ...cloneDefaultVacation(), ...record.vacationMode }
      : cloneDefaultVacation(),
    parentViewer: record.parentViewer
      ? {
          ...cloneDefaultParentViewer(),
          ...record.parentViewer,
          auditLog: Array.isArray(record.parentViewer.auditLog) ? record.parentViewer.auditLog : [],
        }
      : cloneDefaultParentViewer(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      syncFromAppData: (data) => {
        if (!data) {
          set({
            ...initialPersistedState,
            settings: cloneDefaultSettings(),
            vacationMode: cloneDefaultVacation(),
            parentViewer: cloneDefaultParentViewer(),
          });
          return;
        }

        set({
          profileId: data.profileId,
          settings: {
            ...cloneDefaultSettings(),
            ...data.settings,
            goals: { ...DEFAULT_SETTINGS.goals, ...data.settings.goals },
            timer: { ...DEFAULT_SETTINGS.timer, ...data.settings.timer },
          },
          vacationMode: { ...cloneDefaultVacation(), ...data.vacationMode },
          parentViewer: {
            ...cloneDefaultParentViewer(),
            ...data.parentViewer,
            auditLog: Array.isArray(data.parentViewer.auditLog) ? data.parentViewer.auditLog : [],
          },
          updatedAt: data.updatedAt,
        });
      },
      clear: () =>
        set({
          ...initialPersistedState,
          settings: cloneDefaultSettings(),
          vacationMode: cloneDefaultVacation(),
          parentViewer: cloneDefaultParentViewer(),
        }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profileId: state.profileId,
        settings: state.settings,
        vacationMode: state.vacationMode,
        parentViewer: state.parentViewer,
        updatedAt: state.updatedAt,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
