import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, CheckSquare, BarChart3, Timer, Archive } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/backlog', icon: Archive, label: 'Backlog' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
];

interface NavigationProps {
  timerActive?: boolean;
}

export function Navigation({ timerActive }: NavigationProps) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:relative md:bottom-auto md:border-t-0 md:border-r md:h-screen md:w-64">
      <div className="flex items-center justify-around py-2 md:flex-col md:items-stretch md:justify-start md:p-4 md:gap-2">
        {/* Logo - desktop only */}
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
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                'hover:bg-secondary',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !isActive && 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden md:inline font-medium">{label}</span>
            </Link>
          );
        })}

        {/* Timer indicator */}
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
