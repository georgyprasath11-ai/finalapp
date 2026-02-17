import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, CheckSquare, BarChart3, Timer, Archive, Clock, CalendarDays, Target, Settings, Dumbbell } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

const baseNavItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/sessions', icon: Clock, label: 'Sessions' },
  { path: '/planner', icon: CalendarDays, label: 'Planner' },
  { path: '/backlog', icon: Archive, label: 'Backlog' },
  { path: '/progress', icon: Target, label: 'Progress' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface NavigationProps {
  timerActive?: boolean;
}

export function Navigation({ timerActive }: NavigationProps) {
  const location = useLocation();
  const { settings } = useSettings();

  const navItems = settings.workoutEnabled
    ? [...baseNavItems.slice(0, -1), { path: '/workout', icon: Dumbbell, label: 'Workout' }, baseNavItems[baseNavItems.length - 1]]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:relative md:bottom-auto md:border-t-0 md:border-r md:h-screen md:w-64 md:flex-shrink-0">
      <div className="flex items-center justify-around py-2 md:flex-col md:items-stretch md:justify-start md:p-4 md:gap-1 overflow-x-auto">
        <div className="hidden md:flex items-center gap-3 px-4 py-6 border-b border-border mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Study</h1>
            <p className="text-xs text-muted-foreground">Summary Sender</p>
          </div>
        </div>

        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                'hover:bg-secondary',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !isActive && 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:inline text-sm font-medium">{label}</span>
            </Link>
          );
        })}

        {timerActive && (
          <div className="hidden md:flex items-center gap-2 px-4 py-3 mt-auto border-t border-border pt-4">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
            <span className="text-sm text-muted-foreground">Timer running</span>
          </div>
        )}
      </div>
    </nav>
  );
}
