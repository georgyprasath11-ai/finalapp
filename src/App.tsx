import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { CommandPalette } from "@/components/common/CommandPalette";
import { GlobalShortcuts } from "@/components/common/GlobalShortcuts";
import { PageTransition } from "@/components/common/PageTransition";
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
const ImportantQuestionsPage = lazy(() => import("@/pages/ImportantQuestionsPage"));
const WeeklyReviewPage = lazy(() => import("@/pages/WeeklyReviewPage"));
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
  const location = useLocation();
  return (
    <AppShell>
      <Suspense fallback={<LoadingPage />}>
        <AnimatePresence mode="wait" key={location.pathname}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
            <Route path="/planner" element={<PageTransition><PlannerPage /></PageTransition>} />
            <Route path="/daily-tasks" element={<PageTransition><DailyTasksPage /></PageTransition>} />
            <Route path="/tasks" element={<PageTransition><TasksPage /></PageTransition>} />
            <Route path="/sessions" element={<PageTransition><SessionsPage /></PageTransition>} />
            <Route path="/analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
            <Route path="/workout" element={<PageTransition><WorkoutPage /></PageTransition>} />
            <Route path="/subjects" element={<PageTransition><SubjectsPage /></PageTransition>} />
            <Route path="/important-questions" element={<PageTransition><ImportantQuestionsPage /></PageTransition>} />
            <Route path="/weekly-review" element={<PageTransition><WeeklyReviewPage /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            <Route path="/parent-view" element={<PageTransition><ParentViewPage /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
          </Routes>
        </AnimatePresence>
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
