import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Tasks from "./pages/Tasks";
import Sessions from "./pages/Sessions";
import Planner from "./pages/Planner";
import Settings from "./pages/Settings";
import Backlog from "./pages/Backlog";
import Progress from "./pages/Progress";
import Analytics from "./pages/Analytics";
import Workout from "./pages/Workout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/subjects" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/backlog" element={<Backlog />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
