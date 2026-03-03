import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { CommandPalette } from "@/components/common/CommandPalette";
import { GlobalShortcuts } from "@/components/common/GlobalShortcuts";
import { ProfileGate } from "@/components/profile/ProfileGate";
import { FloatingTimerDock } from "@/components/timer/FloatingTimerDock";
import { ReflectionDialog } from "@/components/timer/ReflectionDialog";
import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { DailyTaskProvider } from "@/store/daily-task-store";
import { ZustandBridge } from "@/store/zustand";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PlannerPage = lazy(() => import("@/pages/PlannerPage"));
const DailyTasksPage = lazy(() => import("@/pages/DailyTasksPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const SessionsPage = lazy(() => import("@/pages/SessionsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const WorkoutPage = lazy(() => import("@/pages/WorkoutPage"));
const SubjectsPage = lazy(() => import("@/pages/SubjectsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ParentViewPage = lazy(() => import("@/pages/ParentViewPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const LoadingPage = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading...</div>
);

function TaskBacklogAutomationBootstrap() {
  const { data, runTaskBacklogAutomation } = useAppStore();

  useEffect(() => {
    if (!data?.profileId) {
      return;
    }

    runTaskBacklogAutomation();
  }, [data?.profileId, data?.tasks, runTaskBacklogAutomation]);

  return null;
}

function RoutedApp() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/daily-tasks" element={<DailyTasksPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/parent-view" element={<ParentViewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppStoreProvider>
        <ProfileGate>
          <DailyTaskProvider>
            <BrowserRouter>
              <ZustandBridge />
              <TaskBacklogAutomationBootstrap />
              <GlobalShortcuts />
              <RoutedApp />
              <FloatingTimerDock />
              <CommandPalette />
              <ReflectionDialog />
            </BrowserRouter>
          </DailyTaskProvider>
        </ProfileGate>
      </AppStoreProvider>
    </AppErrorBoundary>
  );
}
