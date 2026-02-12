import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatTimeShort } from '@/lib/stats';
import { cn } from '@/lib/utils';

interface ComparisonBoxProps {
  vsYesterday: number;
  vsWeekAvg: number;
  vsMonthAvg: number;
}

function DiffRow({ label, diff }: { label: string; diff: number }) {
  const isPositive = diff > 0;
  const isZero = diff === 0;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className={cn(
        'flex items-center gap-1 text-sm font-semibold',
        isZero ? 'text-muted-foreground' : isPositive ? 'text-success' : 'text-destructive'
      )}>
        {isZero ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{isPositive ? '+' : ''}{formatTimeShort(Math.abs(diff)) || '0m'}</span>
      </div>
    </div>
  );
}

export function ComparisonBox({ vsYesterday, vsWeekAvg, vsMonthAvg }: ComparisonBoxProps) {
  return (
    <div className="stat-card">
      <div className="relative z-10">
        <h3 className="font-display font-semibold mb-3">Study Comparison</h3>
        <div className="divide-y divide-border">
          <DiffRow label="vs Yesterday" diff={vsYesterday} />
          <DiffRow label="vs Week Avg" diff={vsWeekAvg} />
          <DiffRow label="vs Month Avg" diff={vsMonthAvg} />
        </div>
      </div>
    </div>
  );
}
