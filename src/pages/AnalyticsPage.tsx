import { memo, type ReactNode, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, ChartPie, Gauge, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  AnalyticsRangePreset,
  buildAnalyticsDataset,
  resolveAnalyticsRange,
} from "@/lib/task-analytics";
import { useAppStore } from "@/store/app-store";

const EMPTY_CHART_TEXT = "Not enough data yet. Start studying to unlock insights.";

const pieColors = ["#14b8a6", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

const pieLabel = (entry: { name?: string; percent?: number }): string => {
  const name = entry.name ?? "Slice";
  const pct = Math.round((entry.percent ?? 0) * 100);
  return `${name}: ${pct}%`;
};

const rangeOptions: Array<{ id: AnalyticsRangePreset; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last30", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
];

function EmptyChartState() {
  return (
    <p className="rounded-xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
      {EMPTY_CHART_TEXT}
    </p>
  );
}

interface ChartCardProps {
  testId: string;
  title: string;
  hasData: boolean;
  children: ReactNode;
}

const ChartCard = memo(function ChartCard({ testId, title, hasData, children }: ChartCardProps) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft" data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {!hasData ? <EmptyChartState /> : children}
      </CardContent>
    </Card>
  );
});

export default function AnalyticsPage() {
  const { data } = useAppStore();
  const [preset, setPreset] = useState<AnalyticsRangePreset>("week");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const debouncedRangeInput = useDebouncedValue({ preset, customStart, customEnd }, 220);

  const range = useMemo(
    () => resolveAnalyticsRange({
      preset: debouncedRangeInput.preset,
      customStart: debouncedRangeInput.customStart,
      customEnd: debouncedRangeInput.customEnd,
    }),
    [debouncedRangeInput],
  );

  const dataset = useMemo(() => (data ? buildAnalyticsDataset(data, range) : null), [data, range]);

  if (!data || !dataset) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const hasStudySessions = dataset.filteredSessions.length > 0;
  const hasReflections = dataset.reflectionSummary.reflectedSessions > 0;
  const hasTaskData = data.tasks.length > 0;

  const chartCount = 13;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {chartCount} charts across study behavior, productivity, and reflection insights.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            Range: {range.startIso} to {range.endIso}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {rangeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreset(option.id)}
              className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                preset === option.id
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              aria-label="Custom range start date"
            />
            <Input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              aria-label="Custom range end date"
            />
          </div>
        ) : null}
      </section>

      {!hasStudySessions && !hasTaskData ? (
        <section className="rounded-2xl border border-dashed border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          {EMPTY_CHART_TEXT}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <ChartPie className="h-4 w-4" />
          Study Analytics
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ChartCard
            testId="analytics-chart-study-monthly-topics"
            title="Monthly Topics Distribution"
            hasData={dataset.monthlyTopics.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.monthlyTopics} dataKey="value" nameKey="name" outerRadius={105} label={pieLabel}>
                  {dataset.monthlyTopics.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} min`, "Time"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-weekly-topics"
            title="Weekly Topics Distribution"
            hasData={dataset.weeklyTopics.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.weeklyTopics} dataKey="value" nameKey="name" innerRadius={52} outerRadius={108} label={pieLabel}>
                  {dataset.weeklyTopics.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} min`, "Time"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-subject-time"
            title="Subject-wise Study Time"
            hasData={dataset.subjectStudyTime.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.subjectStudyTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Bar dataKey="minutes" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-daily-trend"
            title="Daily Study Trend"
            hasData={dataset.dailyStudyTrend.some((point) => point.minutes > 0)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.dailyStudyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Bar dataKey="minutes" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-session-length"
            title="Study Session Length Distribution"
            hasData={dataset.sessionLengthDistribution.some((bucket) => bucket.value > 0)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.sessionLengthDistribution} dataKey="value" nameKey="name" outerRadius={110} label={pieLabel}>
                  {dataset.sessionLengthDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Sessions"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-completion-by-subject"
            title="Completion Rate by Subject"
            hasData={dataset.completionBySubject.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.completionBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Completion rate"]} />
                <Bar dataKey="rate" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-weekly-consistency"
            title="Weekly Consistency"
            hasData={dataset.weeklyConsistency.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.weeklyConsistency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} domain={[0, 7]} />
                <Tooltip formatter={(value: number) => [value, "Study days"]} />
                <Bar dataKey="studyDays" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Gauge className="h-4 w-4" />
          Productivity Analytics
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ChartCard
            testId="analytics-chart-productivity-score-distribution"
            title="Productivity Score Distribution"
            hasData={hasReflections && dataset.productivityScoreDistribution.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.productivityScoreDistribution} dataKey="value" nameKey="name" outerRadius={108} label={pieLabel}>
                  {dataset.productivityScoreDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Sessions"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-trend"
            title="Productivity Trend Over Time"
            hasData={hasReflections && dataset.productivityTrend.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg score"]} />
                <Bar dataKey="score" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-by-subject"
            title="Productivity by Subject"
            hasData={hasReflections && dataset.productivityBySubject.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg score"]} />
                <Bar dataKey="score" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-productive-vs-unproductive-time"
            title="Productive vs Unproductive Study Time"
            hasData={hasReflections && dataset.productiveVsUnproductiveTime.some((slice) => slice.value > 0)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.productiveVsUnproductiveTime} dataKey="value" nameKey="name" outerRadius={108} label={pieLabel}>
                  {dataset.productiveVsUnproductiveTime.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-vs-session-length"
            title="Productivity vs Session Length"
            hasData={hasReflections && dataset.productivityVsSessionLength.some((bucket) => bucket.score > 0)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityVsSessionLength}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg score"]} />
                <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-weekly-consistency"
            title="Weekly Productivity Consistency"
            hasData={hasReflections && dataset.weeklyProductivityConsistency.length > 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.weeklyProductivityConsistency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg score"]} />
                <Bar dataKey="score" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Reflection Insights
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reflected sessions</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{dataset.reflectionSummary.reflectedSessions}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Missing reflections</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{dataset.reflectionSummary.missingReflections}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Productive share</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{dataset.reflectionSummary.productiveShare}%</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Average score</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{dataset.reflectionSummary.averageScore}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
