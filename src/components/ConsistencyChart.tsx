import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatTimeShort } from '@/lib/stats';

interface ConsistencyChartProps {
  data: { day: string; label: string; totalTime: number }[];
}

export function ConsistencyChart({ data }: ConsistencyChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    hours: Math.round((d.totalTime / 3600) * 10) / 10,
  }));

  const maxHours = Math.max(...chartData.map((d) => d.hours));
  const minHours = Math.min(...chartData.map((d) => d.hours));

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Study Consistency (Last 7 Days)</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="font-medium">{d.day}</p>
                        <p className="text-sm text-muted-foreground">{formatTimeShort(d.totalTime)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => {
                  let fill = 'hsl(var(--secondary))';
                  if (maxHours > 0 && entry.hours === maxHours) fill = 'hsl(var(--primary))';
                  else if (entry.hours === minHours && maxHours !== minHours) fill = 'hsl(var(--accent))';
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
