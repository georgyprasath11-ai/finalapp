
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  useInView,
} from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  CalendarRange,
  CheckCircle2,
  ChartPie,
  Clock,
  Flame,
  Gauge,
  Moon,
  Star,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
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

// ─── Colour palette ────────────────────────────────────────────────────────────
const PIE_COLORS = ["#14b8a6", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e", "#f97316", "#ec4899"];
const CHART_PRIMARY = "hsl(var(--chart-1))";
const CHART_2 = "hsl(var(--chart-2))";
const CHART_3 = "hsl(var(--chart-3))";
const CHART_4 = "hsl(var(--chart-4))";
const CHART_5 = "hsl(var(--chart-5))";
const GRID_COLOR = "hsl(var(--border))";

const rangeOptions: Array<{ id: AnalyticsRangePreset; label: string }> = [
  { id: "all",     label: "All Time"      },
  { id: "last365", label: "Last 365 days" },
  { id: "last90",  label: "Last 90 days"  },
  { id: "last30",  label: "Last 30 days"  },
  { id: "month",   label: "This month"    },
  { id: "week",    label: "This week"     },
  { id: "custom",  label: "Custom range"  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatRangeLabel = (startIso: string, endIso: string): string => {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  };
  if (startIso === endIso) return fmt(startIso);
  const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4);
  if (sameYear) {
    const [sy, sm, sd] = startIso.split("-").map(Number);
    const short = new Date(sy, sm - 1, sd).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${short} – ${fmt(endIso)}`;
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`;
};

const fmtMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

// ─── AnimatedStatValue ─────────────────────────────────────────────────────────
function AnimatedStatValue({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: reduceMotion ? 0 : 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion, decimals]);
  return <span className="tabular-nums">{display}{suffix}</span>;
}

// ─── EmptyChartState ───────────────────────────────────────────────────────────
function EmptyChartState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
      <div className="rounded-2xl bg-muted/50 p-3">
        <ChartPie className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">No data for this range yet</p>
    </div>
  );
}
// ─── ChartCard ─────────────────────────────────────────────────────────────────
interface ChartCardProps {
  testId?: string;
  title: string;
  subtitle?: string;
  hasData: boolean;
  children: ReactNode;
  index: number;
  icon?: ReactNode;
  tall?: boolean;
}

const ChartCard = memo(function ChartCard({ testId, title, subtitle, hasData, children, index, icon, tall }: ChartCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  // once: true — once in view, stays "in view" forever (never unmounts).
  // margin: "0px 0px 400px 0px" — a positive bottom margin means charts are
  // considered "in view" when 400px below the visible viewport, so they mount
  // well before the user scrolls to them. Eliminates the placeholder flash.
  const isInView = useInView(ref, { once: true, margin: "0px 0px 400px 0px" });
  const reduceMotion = useReducedMotion();

  // hasBeenInView: tracks whether this card has EVER entered the viewport.
  // Once true, it stays true permanently — so chart children are mounted
  // exactly once (when first scrolled to) and never unmounted again.
  // This avoids mounting all 25 charts simultaneously on page load.
  const hasBeenInViewRef = useRef(false);
  if (isInView) hasBeenInViewRef.current = true;
  const shouldRenderChart = hasBeenInViewRef.current;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        delay: reduceMotion ? 0 : index * 0.06,
        duration: reduceMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion ? {} : { y: -3, boxShadow: "0 16px 40px hsl(220 55% 4% / 0.30)" }}
      data-testid={testId}
    >
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/90 shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {icon && <div className="rounded-lg bg-primary/10 p-1.5 text-primary">{icon}</div>}
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className={tall ? "h-[380px]" : "h-[280px]"}>
          {!shouldRenderChart ? (
            // Placeholder shown before card enters viewport — lightweight, no SVG
            <div className="flex h-full items-center justify-center">
              <div className="h-2 w-16 animate-pulse rounded-full bg-muted/50" />
            </div>
          ) : !hasData ? (
            <EmptyChartState />
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ─── StatTile ──────────────────────────────────────────────────────────────────
function StatTile({
  label, value, suffix = "", icon, tone = "default", index, decimals = 0,
}: {
  label: string; value: number; suffix?: string; icon: ReactNode;
  tone?: "default" | "emerald" | "amber" | "rose" | "sky"; index: number; decimals?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  const toneClass = {
    default: "border-border/60 bg-card/90",
    emerald: "border-emerald-400/30 bg-emerald-500/8",
    amber: "border-amber-400/30 bg-amber-500/8",
    rose: "border-rose-400/30 bg-rose-500/8",
    sky: "border-sky-400/30 bg-sky-500/8",
  }[tone];
  const iconTone = {
    default: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    rose: "bg-rose-500/15 text-rose-400",
    sky: "bg-sky-500/15 text-sky-400",
  }[tone];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? {} : { y: -2, scale: 1.02 }}
      whileTap={reduceMotion ? {} : { scale: 0.98 }}
      className={`rounded-2xl border p-4 transition-colors ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className={`rounded-lg p-1.5 ${iconTone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold">
        {isInView ? <AnimatedStatValue value={value} suffix={suffix} decimals={decimals} /> : "0"}
      </p>
    </motion.div>
  );
}

// ─── SectionHeading ────────────────────────────────────────────────────────────
function SectionHeading({ icon, label, index }: { icon: ReactNode; label: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: reduceMotion ? 0 : index * 0.04, duration: reduceMotion ? 0 : 0.35 }}
      className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground"
    >
      <motion.div
        animate={reduceMotion ? {} : { rotate: [0, 10, -10, 0] }}
        transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
      >
        {icon}
      </motion.div>
      {label}
    </motion.div>
  );
}

// ─── pieLabel helper ───────────────────────────────────────────────────────────
const pieLabel = (entry: { name?: string; percent?: number }) => {
  const pct = Math.round((entry.percent ?? 0) * 100);
  return pct > 4 ? `${entry.name ?? ""}: ${pct}%` : "";
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { data } = useAppStore();
  const [preset, setPreset] = useState<AnalyticsRangePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const reduceMotion = useReducedMotion();

  const handlePresetChange = (newPreset: AnalyticsRangePreset) => {
    if (newPreset === "custom" && !customStart && !customEnd) {
      // Pre-fill custom inputs with last 30 days so they're never blank
      const d = new Date();
      const todayStr = d.toISOString().slice(0, 10);
      const ago = new Date(d);
      ago.setDate(ago.getDate() - 29);
      setCustomStart(ago.toISOString().slice(0, 10));
      setCustomEnd(todayStr);
    }
    setPreset(newPreset);
  };

  const debouncedInput = useDebouncedValue({ preset, customStart, customEnd }, 220);

  // Compute the list of all session end dates once.
  // This is used by resolveAnalyticsRange for the "all" preset to find the
  // earliest session and set the range start to that date.
  // useMemo prevents recomputing on every render — only recalculates when
  // data.sessions changes (i.e. after an import).
  const allSessionEndDates = useMemo(
    () => (data?.sessions ?? [])
      .filter((s) => s.isActive !== true && s.endedAt)
      .map((s) => s.endedAt),
    [data?.sessions],
  );

  const range = useMemo(
    () =>
      resolveAnalyticsRange({
        preset: debouncedInput.preset,
        customStart: debouncedInput.customStart,
        customEnd: debouncedInput.customEnd,
        allSessionEndDates,
      }),
    [debouncedInput, allSessionEndDates],
  );

  const dataset = useMemo(() => (data ? buildAnalyticsDataset(data, range) : null), [data, range]);

  if (!data || !dataset) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  const hasSessions = dataset.filteredSessions.length > 0;
  const hasReflections = dataset.reflectionSummary.reflectedSessions > 0;
  let ci = 0; // chart index for stagger

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
      className="space-y-8"
    >
      {/* ── Header ── */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4 }}
        className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-soft"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.1, duration: 0.35 }}
              className="flex items-center gap-2 text-2xl font-bold"
            >
              <motion.span
                animate={reduceMotion ? {} : { rotate: [0, 360] }}
                transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
              >
                <BarChart2 className="h-6 w-6 text-primary" />
              </motion.span>
              Analytics
            </motion.h1>
            <p className="mt-1 text-sm text-muted-foreground">
              25+ charts across study behaviour, productivity, time patterns, and task insights.
              {preset === "all" && dataset && (
                <span className="ml-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  Showing all {dataset.totalSessions} session{dataset.totalSessions !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.2 }}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground"
          >
            <CalendarRange className="h-4 w-4 text-primary" />
            <AnimatePresence mode="wait">
              <motion.span
                key={`${range.startIso}-${range.endIso}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                {formatRangeLabel(range.startIso, range.endIso)}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Range preset buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {rangeOptions.map((option, i) => (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => handlePresetChange(option.id)}
              whileHover={reduceMotion ? {} : { scale: 1.04 }}
              whileTap={reduceMotion ? {} : { scale: 0.96 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : i * 0.06 }}
              className={`relative overflow-hidden rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                preset === option.id
                  ? "border-primary/50 text-primary"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset === option.id && (
                <motion.div
                  layoutId="rangePresetBg"
                  className="absolute inset-0 bg-primary/10"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 28 }}
                />
              )}
              <span className="relative">{option.label}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {preset === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="mt-3 grid gap-3 overflow-hidden sm:grid-cols-2"
            >
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" />
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ── Summary stat tiles ── */}
      <section className="space-y-3">
        <SectionHeading icon={<Zap className="h-4 w-4" />} label="Summary" index={0} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total Study" value={dataset.totalStudyMinutes} suffix=" min" icon={<Clock className="h-4 w-4" />} tone="sky" index={0} />
          <StatTile label="Sessions" value={dataset.totalSessions} icon={<Activity className="h-4 w-4" />} tone="default" index={1} />
          <StatTile label="Study Days" value={dataset.studyDaysCount} icon={<Flame className="h-4 w-4" />} tone="amber" index={2} />
          <StatTile label="Avg / Day" value={dataset.avgDailyMinutes} suffix=" min" icon={<Target className="h-4 w-4" />} tone="emerald" decimals={1} index={3} />
          <StatTile label="Longest Session" value={dataset.longestSessionMinutes} suffix=" min" icon={<Award className="h-4 w-4" />} tone="rose" index={4} />
          <StatTile label="Reflected" value={dataset.reflectionSummary.reflectedSessions} icon={<Star className="h-4 w-4" />} tone="default" index={5} />
        </div>
      </section>

      {/* ── Study Trend Charts ── */}
      <section className="space-y-3">
        <SectionHeading icon={<TrendingUp className="h-4 w-4" />} label="Study Trends" index={1} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {/* 1. Daily Study Trend — Bar Chart */}
          <ChartCard title="Daily Study Time" subtitle="Minutes per day" hasData={dataset.dailyStudyTrend.some(d => d.minutes > 0)} index={ci++} icon={<BarChart2 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.dailyStudyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} min`, "Study time"]} />
                <Bar dataKey="minutes" fill={CHART_PRIMARY} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 2. Cumulative Study Time — Area Chart (Ogive-style) */}
          <ChartCard title="Cumulative Study Time" subtitle="Running total over the range — Ogive curve" hasData={dataset.cumulativeStudyMinutes.some(d => d.cumulative > 0)} index={ci++} icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataset.cumulativeStudyMinutes} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} min`, ""]} />
                <Area type="monotone" dataKey="cumulative" stroke={CHART_PRIMARY} strokeWidth={2.5} fill="url(#cumulativeGrad)" dot={false} animationBegin={150} animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 3. Rolling 7-Day Average — Composed Bar+Line (Frequency Polygon style) */}
          <ChartCard title="7-Day Rolling Average" subtitle="Daily bars + rolling average line — Frequency Polygon" hasData={dataset.rollingAvgStudyTime.some(d => d.daily > 0)} index={ci++} icon={<Activity className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataset.rollingAvgStudyTime} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="daily" fill={CHART_2} opacity={0.45} radius={[3, 3, 0, 0]} name="Daily (min)" animationBegin={150} animationDuration={800} />
                <Line type="monotone" dataKey="rollingAvg" stroke={CHART_PRIMARY} strokeWidth={2.5} dot={false} name="7-day avg" animationBegin={300} animationDuration={1000} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 4. Session Count Per Day — Line Chart */}
          <ChartCard title="Sessions Per Day" subtitle="How many study sessions per day" hasData={dataset.sessionCountByDay.some(d => d.count > 0)} index={ci++} icon={<BookOpen className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataset.sessionCountByDay} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, "Sessions"]} />
                <Line type="monotone" dataKey="count" stroke={CHART_3} strokeWidth={2.5} dot={{ r: 3, fill: CHART_3 }} activeDot={{ r: 5 }} animationBegin={150} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 5. Study Streak History — Bar (binary, like histogram of presence) */}
          <ChartCard title="Study Day Streak History" subtitle="Histogram of study presence (1 = studied)" hasData={dataset.studyStreakHistory.some(d => d.studied > 0)} index={ci++} icon={<Flame className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.studyStreakHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v === 1 ? "Studied ✓" : "No study", ""]} />
                <Bar dataKey="studied" radius={[4, 4, 0, 0]} animationBegin={150} animationDuration={800}>
                  {dataset.studyStreakHistory.map((entry, idx) => (
                    <Cell key={idx} fill={entry.studied ? "#22c55e" : "hsl(var(--muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 6. Weekly Consistency — Bar */}
          <ChartCard title="Weekly Consistency" subtitle="Study days per week" hasData={dataset.weeklyConsistency.length > 0} index={ci++} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.weeklyConsistency} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} domain={[0, 7]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, "Study days"]} />
                <ReferenceLine y={5} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Goal", fontSize: 10, fill: "#22c55e" }} />
                <Bar dataKey="studyDays" fill={CHART_4} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ── Subject Analysis ── */}
      <section className="space-y-3">
        <SectionHeading icon={<BookOpen className="h-4 w-4" />} label="Subject Analysis" index={2} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {/* 7. Subject Study Time — Horizontal Bar */}
          <ChartCard title="Study Time by Subject" subtitle="Total minutes per subject" hasData={dataset.subjectStudyTime.length > 0} index={ci++} icon={<Clock className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.subjectStudyTime} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => [`${v} min`, "Study time"]} />
                <Bar dataKey="minutes" fill={CHART_PRIMARY} radius={[0, 5, 5, 0]} animationBegin={150} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 8. Subject Session Count — Bar */}
          <ChartCard title="Sessions by Subject" subtitle="Number of sessions per subject" hasData={dataset.subjectSessionCount.length > 0} index={ci++} icon={<Activity className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.subjectSessionCount} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, "Sessions"]} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800}>
                  {dataset.subjectSessionCount.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 9. Avg Session Duration by Subject — Bar */}
          <ChartCard title="Avg Session Duration" subtitle="Average minutes per session, by subject" hasData={dataset.avgSessionDurationBySubject.length > 0} index={ci++} icon={<Target className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.avgSessionDurationBySubject} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} min`, "Avg duration"]} />
                <Bar dataKey="avgMinutes" fill={CHART_5} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 10. Monthly Topics — Pie */}
          <ChartCard title="Topics This Month" subtitle="Pie chart of study topic distribution" hasData={dataset.monthlyTopics.length > 0} index={ci++} icon={<ChartPie className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.monthlyTopics} dataKey="value" nameKey="name" outerRadius={100} label={pieLabel} animationBegin={200} animationDuration={900}>
                  {dataset.monthlyTopics.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} min`, "Time"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 11. Weekly Topics — Donut Pie */}
          <ChartCard title="Topics This Week" subtitle="Donut chart of this week's topics" hasData={dataset.weeklyTopics.length > 0} index={ci++} icon={<ChartPie className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.weeklyTopics} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} label={pieLabel} animationBegin={200} animationDuration={900}>
                  {dataset.weeklyTopics.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} min`, "Time"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 12. Completion by Subject — Bar */}
          <ChartCard title="Completion Rate by Subject" subtitle="% of tasks completed per subject" hasData={dataset.completionBySubject.length > 0} index={ci++} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.completionBySubject} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} />
                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" />
                <Bar dataKey="rate" fill={CHART_3} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ── Time Patterns ── */}
      <section className="space-y-3">
        <SectionHeading icon={<Clock className="h-4 w-4" />} label="Time Patterns" index={3} />
        <div className="grid gap-4 md:grid-cols-2">

          {/* 13. Hour-of-Day — Bar (Histogram of session frequency) */}
          <ChartCard title="Study by Hour of Day" subtitle="Histogram — when do you study most?" hasData={dataset.hourOfDayDistribution.some(h => h.sessions > 0)} index={ci++} icon={<Clock className="h-3.5 w-3.5" />} tall>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.hourOfDayDistribution} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [v, name === "sessions" ? "Sessions" : "Minutes"]} />
                <Bar dataKey="sessions" name="sessions" radius={[3, 3, 0, 0]} animationBegin={150} animationDuration={900}>
                  {dataset.hourOfDayDistribution.map((entry, idx) => {
                    const h = idx;
                    const isNight = h < 6 || h >= 22;
                    const isMorning = h >= 6 && h < 12;
                    const isAfternoon = h >= 12 && h < 18;
                    const fill = isNight ? "#6366f1" : isMorning ? "#f59e0b" : isAfternoon ? "#0ea5e9" : "#8b5cf6";
                    return <Cell key={idx} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 14. Day-of-Week — Radar Chart */}
          <ChartCard title="Study by Day of Week" subtitle="Radar chart — which days are most productive?" hasData={dataset.dayOfWeekDistribution.some(d => d.sessions > 0)} index={ci++} icon={<Brain className="h-3.5 w-3.5" />} tall>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dataset.dayOfWeekDistribution} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke={GRID_COLOR} />
                <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
                <Radar name="Sessions" dataKey="sessions" stroke={CHART_PRIMARY} fill={CHART_PRIMARY} fillOpacity={0.25} animationBegin={200} animationDuration={900} />
                <Radar name="Minutes" dataKey="minutes" stroke={CHART_2} fill={CHART_2} fillOpacity={0.15} animationBegin={300} animationDuration={900} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 15. Session Length Distribution — Pie */}
          <ChartCard title="Session Length Distribution" subtitle="Pie chart of short vs long sessions" hasData={dataset.sessionLengthDistribution.some(b => b.value > 0)} index={ci++} icon={<ChartPie className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.sessionLengthDistribution} dataKey="value" nameKey="name" outerRadius={105} label={pieLabel} animationBegin={200} animationDuration={900}>
                  {dataset.sessionLengthDistribution.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Sessions"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 16. Task Completion Timeline — Composed Line+Bar */}
          <ChartCard title="Task Timeline" subtitle="Tasks created vs completed per day" hasData={dataset.taskCompletionTimeline.some(d => d.completed > 0 || d.created > 0)} index={ci++} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataset.taskCompletionTimeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="created" name="Created" fill={CHART_2} opacity={0.5} radius={[3, 3, 0, 0]} animationBegin={150} animationDuration={800} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} animationBegin={300} animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ── Productivity Analytics ── */}
      <section className="space-y-3">
        <SectionHeading icon={<Gauge className="h-4 w-4" />} label="Productivity" index={4} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {/* 17. Productivity Trend — Line Chart */}
          <ChartCard title="Productivity Score Trend" subtitle="Average session points over time — Line chart" hasData={hasReflections && dataset.productivityTrend.length > 0} index={ci++} icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataset.productivityTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}`, "Avg points"]} />
                <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Avg", fontSize: 10 }} />
                <Line type="monotone" dataKey="points" stroke={CHART_5} strokeWidth={2.5} dot={{ r: 4, fill: CHART_5 }} activeDot={{ r: 6 }} animationBegin={150} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 18. Productivity by Subject — Bar */}
          <ChartCard title="Avg Points by Subject" hasData={hasReflections && dataset.productivityBySubject.length > 0} index={ci++} icon={<Star className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityBySubject} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}`, "Avg points"]} />
                <Bar dataKey="points" fill={CHART_2} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 19. Session Score Distribution — Pie */}
          <ChartCard title="Session Score Distribution" subtitle="Productive / Average / Distracted split" hasData={hasReflections && dataset.productivityScoreDistribution.length > 0} index={ci++} icon={<ChartPie className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.productivityScoreDistribution} dataKey="value" nameKey="name" outerRadius={105} label={pieLabel} animationBegin={200} animationDuration={900}>
                  {dataset.productivityScoreDistribution.map((_, idx) => (
                    <Cell key={idx} fill={["#22c55e", "#f59e0b", "#ef4444"][idx % 3]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Sessions"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 20. Productive vs Unproductive Time — Donut */}
          <ChartCard title="Productive vs Unproductive Time" subtitle="Minutes in productive vs other sessions" hasData={hasReflections && dataset.productiveVsUnproductiveTime.some(s => s.value > 0)} index={ci++} icon={<Target className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataset.productiveVsUnproductiveTime} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} label={pieLabel} animationBegin={200} animationDuration={900}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} min`, ""]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 21. Points vs Session Length — Bar (Histogram-style) */}
          <ChartCard title="Points vs Session Length" subtitle="Histogram — does longer = more productive?" hasData={hasReflections && dataset.productivityVsSessionLength.some(b => b.points > 0)} index={ci++} icon={<BarChart2 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset.productivityVsSessionLength} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}`, "Avg points"]} />
                <Bar dataKey="points" fill={CHART_PRIMARY} radius={[5, 5, 0, 0]} animationBegin={150} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 22. Weekly Productivity Consistency — Line */}
          <ChartCard title="Weekly Productivity Consistency" subtitle="Avg points per week — Frequency polygon" hasData={hasReflections && dataset.weeklyProductivityConsistency.length > 0} index={ci++} icon={<Activity className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataset.weeklyProductivityConsistency} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}`, "Avg points"]} />
                <Line type="monotone" dataKey="points" stroke={CHART_3} strokeWidth={2.5} dot={{ r: 4 }} animationBegin={150} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ── Reflection Insights ── */}
      <section className="space-y-3">
        <SectionHeading icon={<Brain className="h-4 w-4" />} label="Reflection Insights" index={5} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Reflected Sessions", value: dataset.reflectionSummary.reflectedSessions, icon: <Star className="h-4 w-4" />, tone: "default" as const },
            { label: "Missing Reflections", value: dataset.reflectionSummary.missingReflections, icon: <Moon className="h-4 w-4" />, tone: "rose" as const },
            { label: "Total Points", value: dataset.reflectionSummary.totalPoints, icon: <Zap className="h-4 w-4" />, tone: "amber" as const },
            { label: "Average Points /5", value: dataset.reflectionSummary.averagePoints, icon: <Award className="h-4 w-4" />, tone: "emerald" as const, decimals: 1 },
          ].map((tile, i) => (
            <StatTile key={tile.label} label={tile.label} value={tile.value} icon={tile.icon} tone={tile.tone} index={i} decimals={(tile as { decimals?: number }).decimals ?? 0} />
          ))}
        </div>

        {/* 23. Reflection coverage — Area chart */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Productive Share Trend" subtitle="% of sessions rated Productive" hasData={hasReflections} index={ci++} icon={<Sun className="h-3.5 w-3.5" />}>
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <div className="relative">
                <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
                  <circle cx="70" cy="70" r="56" className="fill-none stroke-border/50" strokeWidth="12" />
                  <motion.circle
                    cx="70" cy="70" r="56"
                    className="fill-none stroke-emerald-400"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - dataset.reflectionSummary.productiveShare / 100) }}
                    transition={{ duration: reduceMotion ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{ strokeDasharray: 2 * Math.PI * 56 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedStatValue value={dataset.reflectionSummary.productiveShare} suffix="%" />
                  </p>
                  <p className="text-xs text-muted-foreground">Productive</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {dataset.reflectionSummary.reflectedSessions} reflected out of{" "}
                {dataset.filteredSessions.length} sessions
              </p>
            </div>
          </ChartCard>

          {/* 24. Most studied subject highlight */}
          <ChartCard title="Top Subject Breakdown" subtitle="Cumulative area by subject — Ogive" hasData={dataset.subjectStudyTime.length > 0} index={ci++} icon={<Trophy className="h-3.5 w-3.5" />}>
            <div className="flex h-full flex-col justify-center gap-3 px-2">
              {dataset.subjectStudyTime.slice(0, 5).map((entry, idx) => {
                const maxMin = dataset.subjectStudyTime[0]?.minutes ?? 1;
                const pct = maxMin > 0 ? (entry.minutes / maxMin) * 100 : 0;
                return (
                  <div key={entry.subject} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{entry.subject}</span>
                      <span className="text-muted-foreground">{entry.minutes} min</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: reduceMotion ? 0 : idx * 0.1 + 0.3, duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </section>

      {/* ── Hours & Reflections Data ── */}
      <section className="space-y-3">
        <SectionHeading icon={<Clock className="h-4 w-4" />} label="Hours &amp; Reflections" index={6} />

        {/* Row 1: four stat tiles */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total Hours"
            value={parseFloat((dataset.totalStudyMinutes / 60).toFixed(1))}
            suffix="h"
            icon={<Clock className="h-4 w-4" />}
            tone="sky"
            index={0}
            decimals={1}
          />
          <StatTile
            label="Reflected Sessions"
            value={dataset.reflectionSummary.reflectedSessions}
            icon={<Star className="h-4 w-4" />}
            tone="emerald"
            index={1}
          />
          <StatTile
            label="Avg Points / Session"
            value={dataset.reflectionSummary.averagePoints}
            suffix="/5"
            icon={<Award className="h-4 w-4" />}
            tone="amber"
            index={2}
            decimals={1}
          />
          <StatTile
            label="Productive Share"
            value={dataset.reflectionSummary.productiveShare}
            suffix="%"
            icon={<TrendingUp className="h-4 w-4" />}
            tone="default"
            index={3}
            decimals={1}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {/* Chart A — Hours studied per day with reflection overlay */}
          <ChartCard
            title="Daily Hours + Reflections"
            subtitle="Bars = hours studied · Green fill = day had at least one reflection"
            hasData={dataset.hoursWithReflectionTimeline.some(d => d.hours > 0)}
            index={ci++}
            icon={<Clock className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataset.hoursWithReflectionTimeline}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    name === "hours" ? `${v}h` : v,
                    name === "hours" ? "Study hours" : "Reflections",
                  ]}
                />
                <Bar
                  dataKey="hours"
                  name="hours"
                  radius={[5, 5, 0, 0]}
                  animationBegin={150}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {dataset.hoursWithReflectionTimeline.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.hasReflection ? "#22c55e" : CHART_PRIMARY}
                      fillOpacity={entry.hours > 0 ? 1 : 0.3}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="reflectionCount"
                  name="reflectionCount"
                  fill="#f59e0b"
                  radius={[3, 3, 0, 0]}
                  opacity={0.7}
                  animationBegin={300}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart B — Cumulative hours (Ogive) */}
          <ChartCard
            title="Cumulative Hours Studied"
            subtitle="Running total of hours over the range"
            hasData={dataset.cumulativeHours.some(d => d.hours > 0)}
            index={ci++}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dataset.cumulativeHours}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="cumulativeHoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_2} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_2} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip formatter={(v: number) => [`${v}h`, "Cumulative hours"]} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke={CHART_2}
                  strokeWidth={2.5}
                  fill="url(#cumulativeHoursGrad)"
                  dot={false}
                  animationBegin={150}
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart C — Daily reflection rate % */}
          <ChartCard
            title="Daily Reflection Rate"
            subtitle="% of sessions that had a reflection rating each day"
            hasData={dataset.dailyReflectionRate.some(d => d.total > 0)}
            index={ci++}
            icon={<Brain className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dataset.dailyReflectionRate}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Reflection rate"]} />
                <ReferenceLine
                  y={100}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{ value: "100%", fontSize: 10, fill: "#22c55e" }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={CHART_5}
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { rate: number } };
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={payload.rate === 100 ? "#22c55e" : payload.rate > 0 ? CHART_5 : "hsl(var(--muted))"}
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  animationBegin={150}
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart D — Subject hours + reflection rate (grouped bar) */}
          <ChartCard
            title="Subject Hours vs Reflection Rate"
            subtitle="Hours studied and % of sessions reflected per subject"
            hasData={dataset.subjectHoursAndReflections.length > 0}
            index={ci++}
            icon={<BookOpen className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dataset.subjectHoursAndReflections}
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="hours"
                  tick={{ fontSize: 11 }}
                  unit="h"
                  orientation="left"
                />
                <YAxis
                  yAxisId="rate"
                  tick={{ fontSize: 11 }}
                  unit="%"
                  orientation="right"
                  domain={[0, 100]}
                />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="hours"
                  dataKey="hours"
                  name="Hours"
                  fill={CHART_PRIMARY}
                  radius={[5, 5, 0, 0]}
                  animationBegin={150}
                  animationDuration={800}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="reflectionRate"
                  name="Reflection %"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#f59e0b" }}
                  animationBegin={300}
                  animationDuration={900}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart E — Average hours by day of week */}
          <ChartCard
            title="Avg Hours by Day of Week"
            subtitle="Which days do you study the most?"
            hasData={dataset.avgHoursByDayOfWeek.some(d => d.avgHours > 0)}
            index={ci++}
            icon={<Activity className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataset.avgHoursByDayOfWeek}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `${v}h`,
                    name === "avgHours" ? "Avg hours" : "Total hours",
                  ]}
                />
                <Bar
                  dataKey="avgHours"
                  name="avgHours"
                  radius={[5, 5, 0, 0]}
                  animationBegin={150}
                  animationDuration={800}
                >
                  {dataset.avgHoursByDayOfWeek.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        idx === 0 || idx === 6
                          ? "#8b5cf6" // weekend — purple
                          : entry.avgHours ===
                              Math.max(...dataset.avgHoursByDayOfWeek.map((d) => d.avgHours))
                            ? "#22c55e" // best day — green
                            : CHART_PRIMARY
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart F — Reflection comment depth (word count distribution) */}
          <ChartCard
            title="Reflection Comment Depth"
            subtitle="Word count distribution of reflection notes"
            hasData={dataset.reflectionWordCountDistribution.some(d => d.count > 0)}
            index={ci++}
            icon={<Brain className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataset.reflectionWordCountDistribution}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, "Sessions"]} />
                <Bar
                  dataKey="count"
                  radius={[5, 5, 0, 0]}
                  animationBegin={150}
                  animationDuration={800}
                >
                  {dataset.reflectionWordCountDistribution.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={["hsl(var(--muted))", CHART_3, CHART_2, "#22c55e"][idx % 4]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>
    </motion.div>
  );
}
