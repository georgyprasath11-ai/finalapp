import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { useAnalyticsStore } from "@/store/zustand/useAnalyticsStore";
import { useSettingsStore } from "@/store/zustand/useSettingsStore";
import { useSubjectStore } from "@/store/zustand/useSubjectStore";
import { useTaskStore } from "@/store/zustand/useTaskStore";
import { useTimerStore } from "@/store/zustand/useTimerStore";

export function ZustandBridge() {
  const { data, analytics, pendingReflection } = useAppStore();
  const syncTasks = useTaskStore((state) => state.syncFromAppData);
  const syncSubjects = useSubjectStore((state) => state.syncFromAppData);
  const syncTimer = useTimerStore((state) => state.syncFromAppData);
  const syncAnalytics = useAnalyticsStore((state) => state.syncFromAppData);
  const syncSettings = useSettingsStore((state) => state.syncFromAppData);

  useEffect(() => {
    syncTasks(data);
    syncSubjects(data);
    syncTimer(data, pendingReflection);
    syncSettings(data);
    syncAnalytics(data?.profileId ?? null, analytics, data?.updatedAt ?? null);
  }, [analytics, data, pendingReflection, syncAnalytics, syncSettings, syncSubjects, syncTasks, syncTimer]);

  return null;
}
