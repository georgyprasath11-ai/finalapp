import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileGate } from "@/components/profile/ProfileGate";
import { ReflectionDialog } from "@/components/timer/ReflectionDialog";
import { AppStoreProvider } from "@/store/app-store";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PlannerPage = lazy(() => import("@/pages/PlannerPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const SessionsPage = lazy(() => import("@/pages/SessionsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const WorkoutPage = lazy(() => import("@/pages/WorkoutPage"));
const SubjectsPage = lazy(() => import("@/pages/SubjectsPage"));
const BacklogPage = lazy(() => import("@/pages/BacklogPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const LoadingPage = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading...</div>
);

function RoutedApp() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/backlog" element={<BacklogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <ProfileGate>
        <BrowserRouter>
          <RoutedApp />
          <ReflectionDialog />
        </BrowserRouter>
      </ProfileGate>
    </AppStoreProvider>
  );
}
