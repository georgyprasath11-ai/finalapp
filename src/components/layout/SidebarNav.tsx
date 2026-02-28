import { Link, NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock3,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/daily-tasks", label: "Daily Tasks", icon: ListChecks },
  { to: "/tasks", label: "Short/Long Tasks", icon: ClipboardList },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/sessions", label: "Sessions", icon: Clock3 },
  { to: "/analytics", label: "Daily Analytics", icon: BarChart3 },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/subjects", label: "Subjects", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarNavProps {
  children: React.ReactNode;
}

export function SidebarNav({ children }: SidebarNavProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profiles, activeProfile, switchProfile } = useAppStore();

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

      {!collapsed || isMobile ? (
        <div className="mb-5 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Profile</p>
          <Select
            value={activeProfile?.id ?? ""}
            onValueChange={(value) => {
              switchProfile(value);
              setMobileOpen(false);
            }}
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

      <nav className="grid gap-1">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  collapsed && !isMobile ? "justify-center" : "",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
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
            {mobileOpen ? (
              <button
                className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                type="button"
              />
            ) : null}
            <aside
              className={cn(
                "fixed left-0 top-0 z-40 h-full w-72 border-r border-border/60 bg-sidebar p-4 shadow-large transition-transform",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              {navContent}
            </aside>
          </>
        ) : (
          <aside
            className={cn(
              "sticky top-0 h-screen border-r border-border/60 bg-sidebar p-4 shadow-soft transition-all",
              collapsed ? "w-24" : "w-72",
            )}
          >
            {navContent}
          </aside>
        )}

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

