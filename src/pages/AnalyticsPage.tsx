import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
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

const formatRangeLabel = (startIso: string, endIso: string): string => {
  const fmt = (iso: string): string => {
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  if (startIso === endIso) {
    return fmt(startIso);
  }
  const startYear = startIso.slice(0, 4);
  const endYear = endIso.slice(0, 4);
  if (startYear === endYear) {
    const [sy, sm, sd] = startIso.split("-").map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const startShort = startDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return `${startShort} – ${fmt(endIso)}`;
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`;
};

function EmptyChartState() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
    >
      <div className="rounded-2xl bg-muted/60 p-4">
        <ChartPie className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">No chart data yet</p>
      <p className="text-xs text-muted-foreground/70">{EMPTY_CHART_TEXT}</p>
    </motion.div>
  );
}

interface ChartCardProps {
  testId: string;
  title: string;
  hasData: boolean;
  children: ReactNode;
  index: number;
}

const ChartCard = memo(function ChartCard({ testId, title, hasData, children, index }: ChartCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.1, duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft" data-testid={testId}>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {!hasData ? <EmptyChartState /> : children}
        </CardContent>
      </Card>
    </motion.div>
  );
});

function AnimatedStatValue({ value, suffix = "" }: { value: number; suffix?: string }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(Math.round(value));

  useEffect(() => {
    const controls = animate(0, value, {
      duration: reduceMotion ? 0 : 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [reduceMotion, value]);

  return (
    <motion.span>
      {display}
      {suffix}
    </motion.span>
  );
}

export default function AnalyticsPage() {
  const { data } = useAppStore();
  const [preset, setPreset] = useState<AnalyticsRangePreset>("week");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const reduceMotion = useReducedMotion();

  const handlePresetChange = (newPreset: AnalyticsRangePreset) => {
    if (newPreset === "custom" && !customStart && !customEnd) {
      const d = new Date();
      const todayStr = d.toISOString().slice(0, 10);
      const thirtyAgo = new Date(d);
      thirtyAgo.setDate(thirtyAgo.getDate() - 29);
      setCustomStart(thirtyAgo.toISOString().slice(0, 10));
      setCustomEnd(todayStr);
    }
    setPreset(newPreset);
  };

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
  let chartIndex = 0;

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
            Range: {formatRangeLabel(range.startIso, range.endIso)}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {rangeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePresetChange(option.id)}
              className={`relative rounded-xl border px-3 py-2 text-sm transition-colors ${
                preset === option.id
                  ? "border-primary/45 text-primary"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset === option.id ? (
                <motion.div
                  layoutId="rangePresetBg"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 }}
                />
              ) : null}
              <span className="relative">{option.label}</span>
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
        <motion.section
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
        >
          <div className="rounded-2xl bg-muted/60 p-4">
            <ChartPie className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No analytics yet</p>
          <p className="text-xs text-muted-foreground/70">{EMPTY_CHART_TEXT}</p>
        </motion.section>
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
            index={chartIndex++}
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
            index={chartIndex++}
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
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.subjectStudyTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Bar
                  dataKey="minutes"
                  fill="hsl(var(--chart-1))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-daily-trend"
            title="Daily Study Trend"
            hasData={dataset.dailyStudyTrend.some((point) => point.minutes > 0)}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.dailyStudyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`${value} min`, "Study time"]} />
                <Bar
                  dataKey="minutes"
                  fill="hsl(var(--chart-2))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-session-length"
            title="Study Session Length Distribution"
            hasData={dataset.sessionLengthDistribution.some((bucket) => bucket.value > 0)}
            index={chartIndex++}
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
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.completionBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Completion rate"]} />
                <Bar
                  dataKey="rate"
                  fill="hsl(var(--chart-3))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-study-weekly-consistency"
            title="Weekly Consistency"
            hasData={dataset.weeklyConsistency.length > 0}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.weeklyConsistency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} domain={[0, 7]} />
                <Tooltip formatter={(value: number) => [value, "Study days"]} />
                <Bar
                  dataKey="studyDays"
                  fill="hsl(var(--chart-4))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
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
            title="Session Point Distribution"
            hasData={hasReflections && dataset.productivityScoreDistribution.length > 0}
            index={chartIndex++}
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
            title="Session Points Trend"
            hasData={hasReflections && dataset.productivityTrend.length > 0}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg points"]} />
                <Bar
                  dataKey="points"
                  fill="hsl(var(--chart-5))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-by-subject"
            title="Average Points by Subject"
            hasData={hasReflections && dataset.productivityBySubject.length > 0}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg points"]} />
                <Bar
                  dataKey="points"
                  fill="hsl(var(--chart-2))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-productive-vs-unproductive-time"
            title="Productive vs Unproductive Study Time"
            hasData={hasReflections && dataset.productiveVsUnproductiveTime.some((slice) => slice.value > 0)}
            index={chartIndex++}
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
            title="Points vs Session Length"
            hasData={hasReflections && dataset.productivityVsSessionLength.some((bucket) => bucket.points > 0)}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityVsSessionLength}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg points"]} />
                <Bar
                  dataKey="points"
                  fill="hsl(var(--chart-1))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            testId="analytics-chart-productivity-weekly-consistency"
            title="Weekly Points Consistency"
            hasData={hasReflections && dataset.weeklyProductivityConsistency.length > 0}
            index={chartIndex++}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.weeklyProductivityConsistency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value: number) => [`${value}`, "Avg points"]} />
                <Bar
                  dataKey="points"
                  fill="hsl(var(--chart-3))"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
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
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                <AnimatedStatValue value={dataset.reflectionSummary.reflectedSessions} />
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Missing reflections</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                <AnimatedStatValue value={dataset.reflectionSummary.missingReflections} />
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total points</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                <AnimatedStatValue value={dataset.reflectionSummary.totalPoints} />
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Average points</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                <AnimatedStatValue value={dataset.reflectionSummary.averagePoints} suffix="/5" />
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
