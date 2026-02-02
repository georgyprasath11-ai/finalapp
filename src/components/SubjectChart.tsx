import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatTimeShort } from '@/lib/stats';

interface SubjectChartProps {
  data: { subject: string; totalTime: number; sessionCount: number; averageTime: number }[];
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

export function SubjectChart({ data }: SubjectChartProps) {
  const chartData = data.slice(0, 7).map((d) => ({
    name: d.subject,
    value: d.totalTime,
    sessions: d.sessionCount,
  }));

  if (chartData.length === 0) {
    return (
      <div className="stat-card">
        <div className="relative z-10 text-center py-8">
          <p className="text-muted-foreground">No study data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Start studying to see your subject breakdown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="relative z-10">
        <h3 className="font-display font-semibold mb-4">Time by Subject</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatTimeShort(data.value)} ({data.sessions} sessions)
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
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
