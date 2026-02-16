import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatTimeShort } from '@/lib/stats';

interface SubjectTimeWheelProps {
  title: string;
  data: { subject: string; totalTime: number }[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
];

export function SubjectTimeWheel({ title, data }: SubjectTimeWheelProps) {
  const totalSeconds = data.reduce((sum, d) => sum + d.totalTime, 0);
  const chartData = data
    .filter((d) => d.totalTime > 0)
    .slice(0, 7)
    .map((d) => ({
      name: d.subject,
      value: d.totalTime,
      percent: totalSeconds > 0 ? Math.round((d.totalTime / totalSeconds) * 100) : 0,
    }));

  if (chartData.length === 0) {
    return (
      <div className="stat-card">
        <div className="relative z-10 text-center py-6">
          <h3 className="font-display font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">No data yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <h3 className="font-display font-semibold mb-4">{title}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatTimeShort(d.value)} ({d.percent}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value: string) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
