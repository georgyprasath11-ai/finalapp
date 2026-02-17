import { useLocalStorage } from './useLocalStorage';

export interface AppSettings {
  workoutEnabled: boolean;
}

const SETTINGS_KEY = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  workoutEnabled: false,
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);

  const toggleWorkout = () => {
    setSettings((prev) => ({ ...prev, workoutEnabled: !prev.workoutEnabled }));
  };

  return { settings, toggleWorkout };
}
