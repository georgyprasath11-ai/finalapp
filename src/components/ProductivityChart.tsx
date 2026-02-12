import { formatHours } from '@/lib/stats';

interface ProductivityChartProps {
  totalSeconds: number;
  percent: number;
  color: string;
  label: string;
}

export function ProductivityChart({ totalSeconds, percent, color, label }: ProductivityChartProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <h3 className="font-display font-semibold mb-4">Daily Productivity</h3>
        <div className="flex items-center justify-center gap-6">
          <div className="relative w-44 h-44">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80" cy="80" r={radius}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="12"
              />
              <circle
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-3xl font-bold" style={{ color }}>
                {percent}%
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Hours Studied</p>
              <p className="font-display text-xl font-bold">{formatHours(totalSeconds)}h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Daily Goal</p>
              <p className="font-display text-lg font-semibold text-muted-foreground">15h</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
