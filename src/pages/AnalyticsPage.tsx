import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/common/StatCard";
import { useAppStore } from "@/store/app-store";
import { consistencySeries, monthlySeries, subjectDistribution } from "@/lib/analytics";
import { formatDuration, formatMinutes, percentLabel } from "@/utils/format";

export default function AnalyticsPage() {
  const { data, analytics } = useAppStore();

  if (!data) {
    return null;
  }

  const consistency = consistencySeries(data.sessions, 21);
  const monthly = monthlySeries(data.sessions, 8);
  const subjects = subjectDistribution(data.sessions, data.subjects);

  const todayMinutes = Math.round(analytics.todayStudyMs / 60000);
  const dailyGoalProgress = Math.min(100, (todayMinutes / Math.max(1, data.settings.goals.dailyMinutes)) * 100);

  const weeklyMinutes = Math.round(analytics.weeklyTotalMs / 60000);
  const weeklyGoalProgress = Math.min(100, (weeklyMinutes / Math.max(1, data.settings.goals.weeklyMinutes)) * 100);

  const monthlyMinutes = Math.round(analytics.monthlyTotalMs / 60000);
  const monthlyGoalProgress = Math.min(100, (monthlyMinutes / Math.max(1, data.settings.goals.monthlyMinutes)) * 100);

  const wheelData = subjects.slice(0, 6).map((subject) => ({
    name: subject.subject,
    value: subject.minutes,
    fill: subject.color,
  }));

  const productivityData = [{
    name: "Productivity",
    value: Number(analytics.productivityPercent.toFixed(1)),
    fill: "hsl(var(--primary))",
  }];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Productivity" value={percentLabel(analytics.productivityPercent)} hint="15h capped formula" />
        <StatCard
          title="Weekly Comparison"
          value={`${Math.round((analytics.weeklyTotalMs - analytics.previousWeekTotalMs) / 60000)} min`}
          hint="Current week minus previous week"
        />
        <StatCard
          title="Monthly Comparison"
          value={`${Math.round((analytics.monthlyTotalMs - analytics.previousMonthTotalMs) / 60000)} min`}
          hint="Current month minus previous month"
        />
        <StatCard title="Streak" value={`${analytics.streakDays} days`} hint={`Best day ${analytics.bestDayLabel}`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Productivity Gauge</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={productivityData}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={14} />
                <text x="50%" y="58%" textAnchor="middle" className="fill-foreground text-3xl font-bold">
                  {percentLabel(analytics.productivityPercent)}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Consistency & Moving Average</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consistency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Daily minutes" />
                <Line
                  type="monotone"
                  dataKey="movingAverageMinutes"
                  stroke="hsl(var(--accent))"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                  name="7-day average"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Subject Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={subjects} dataKey="minutes" nameKey="subject" outerRadius={110} innerRadius={50} paddingAngle={2}>
                  {subjects.map((entry) => (
                    <Cell key={entry.subjectId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value} min`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Monthly Study Chart</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value} min`} />
                <Bar dataKey="minutes" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Study Time Wheel</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart data={wheelData} innerRadius="20%" outerRadius="95%" barSize={18}>
                <PolarAngleAxis type="number" domain={[0, Math.max(1, wheelData[0]?.value ?? 1)]} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={8} />
                <Tooltip formatter={(value: number) => `${value} min`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Goal Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex justify-between">
                <span>Daily goal</span>
                <span>{formatMinutes(todayMinutes)} / {formatMinutes(data.settings.goals.dailyMinutes)}</span>
              </div>
              <Progress value={dailyGoalProgress} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Weekly goal</span>
                <span>{formatMinutes(weeklyMinutes)} / {formatMinutes(data.settings.goals.weeklyMinutes)}</span>
              </div>
              <Progress value={weeklyGoalProgress} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Monthly goal</span>
                <span>{formatMinutes(monthlyMinutes)} / {formatMinutes(data.settings.goals.monthlyMinutes)}</span>
              </div>
              <Progress value={monthlyGoalProgress} className="h-2" />
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">Best Day</p>
              <p className="font-semibold">{analytics.bestDayLabel}</p>
              <p className="text-xs text-muted-foreground">{formatDuration(analytics.bestDayMinutes * 60000)}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
