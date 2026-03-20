import { Link, NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  BookMarked,
  ClipboardList,
  Clock3,
  Dumbbell,
  Eye,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/daily-tasks", label: "Daily Tasks", icon: ListChecks },
  { to: "/important-questions", label: "Important Questions", icon: BookMarked },
  { to: "/tasks", label: "Short/Long Tasks", icon: ClipboardList },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/sessions", label: "Sessions", icon: Clock3 },
  { to: "/analytics", label: "Daily Analytics", icon: BarChart3 },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/subjects", label: "Subjects", icon: Users },
  { to: "/weekly-review", label: "Weekly Review", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/parent-view", label: "Parent View", icon: Eye },
] as const;

interface SidebarNavProps {
  children: React.ReactNode;
}

export function SidebarNav({ children }: SidebarNavProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profiles, activeProfile, switchProfile, isViewerMode, exitViewerMode, isSyncing } = useAppStore();
  const reduceMotion = useReducedMotion();

  const visibleLinks = useMemo(
    () =>
      isViewerMode
        ? links.filter((item) => item.to !== "/settings" && item.to !== "/subjects")
        : links,
    [isViewerMode],
  );

  const navContent = (
    <>
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link to="/dashboard" className={cn("flex items-center gap-2 font-display", collapsed && !isMobile ? "justify-center" : "") }>
          <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-soft">
            <Timer className="h-4 w-4" />
          </div>
          {(!collapsed || isMobile) && <span className="text-sm font-semibold tracking-wide">Study Forge</span>}
        </Link>
        {isMobile ? (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((prev) => !prev)}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isViewerMode && (!collapsed || isMobile) ? (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-semibold uppercase tracking-[0.12em]">Viewer Mode - Read Only</p>
          <p className="mt-1 text-amber-100/90">Editing controls are disabled for parent access.</p>
          <Button size="sm" variant="outline" className="mt-2 h-8" onClick={exitViewerMode}>
            Exit Viewer Mode
          </Button>
        </div>
      ) : null}

      {!collapsed || isMobile ? (
        <div className="mb-5 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Profile</p>
          <Select
            value={activeProfile?.id ?? ""}
            onValueChange={(value) => {
              switchProfile(value);
              setMobileOpen(false);
            }}
            disabled={isViewerMode}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choose profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <nav className="grid gap-1 thin-scrollbar">
        {visibleLinks.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.to}
              whileHover={reduceMotion ? undefined : { x: 4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
            >
              <NavLink
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                    collapsed && !isMobile ? "justify-center" : "",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="activeNavPill"
                        className="absolute left-0 top-0 h-full w-1 rounded-full bg-primary"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <motion.div
                      animate={{ rotate: isActive ? 0 : 0 }}
                      whileHover={reduceMotion ? undefined : { scale: 1.15 }}
                      transition={{ duration: reduceMotion ? 0 : 0.15 }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.div>
                    <AnimatePresence>
                      {(!collapsed || isMobile) && (
                        <motion.span
                          key="label"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.18 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </NavLink>
            </motion.div>
          );
        })}
      </nav>
      {isSyncing && (
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Syncing...
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.05),transparent_50%)] bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        {isMobile ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="fixed left-4 top-4 z-40 shadow-soft"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              {mobileOpen ? (
                <>
                  <motion.button
                    key="mobile-nav-overlay"
                    className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm"
                    aria-label="Close navigation"
                    onClick={() => setMobileOpen(false)}
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  />
                  <motion.aside
                    key="mobile-nav-panel"
                    className="fixed left-0 top-0 z-40 h-full w-72 border-r border-border/60 bg-sidebar p-4 shadow-large"
                    initial={{ x: -300, opacity: 0.96 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0.96 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {navContent}
                  </motion.aside>
                </>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <motion.aside
            className={cn("sticky top-0 h-screen border-r border-border/60 bg-sidebar p-4 shadow-soft")}
            animate={{ width: collapsed ? 96 : 288 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {navContent}
          </motion.aside>
        )}

        <main className="min-w-0 flex-1 p-4 md:p-6 thin-scrollbar">{children}</main>
      </div>
    </div>
  );
}
