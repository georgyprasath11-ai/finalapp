import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useNow } from "@/hooks/useNow";
import {
  BarChart2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Download,
  Link2,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BulkAddTasksDialog } from "@/components/tasks/BulkAddTasksDialog";
import { ConfettiBurst } from "@/components/common/ConfettiBurst";
import { readRecentTaskMove } from "@/lib/task-move-feedback";
import {
  addDays,
  endOfMonth,
  parseIsoDateLocal,
  startOfMonth,
  startOfWeek,
  toLocalIsoDate,
} from "@/utils/date";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { DailyTask, TaskPriority } from "@/types/models";

// ═══════════════════════════════════════════════════════════════════
// DAILY ANALYTICS — FIXED IMPLEMENTATION
//
// ROOT CAUSE OF PREVIOUS FAILURES:
//   The old code only read from `statsByDate`, which is a sparse
//   accumulator that only has entries for dates where the store's
//   updateDateStats() was explicitly called. Any task that existed
//   before that tracking was added, or in a fresh deployment, had
//   NO entry in statsByDate and was invisible to the range filter.
//
// THE FIX:
//   Compute per-day stats from THREE sources with a priority order:
//   1. dailyTasks array (filtered by scheduledFor) for today/tomorrow
//   2. dailyTaskHistory.days[date] for past dates (authoritative snapshot)
//   3. statsByDate[date] as a final fallback
//
// Data types used (all from @/types/models, already imported via store):
//   DailyTask          — has: id, scheduledFor, completed, priority
//   DailyTaskHistoryDay — has: tasks: DailyTaskHistoryTaskRecord[]
//   DailyTaskHistoryTaskRecord — has: completed, priority (TaskPriority)
//   DailyTaskDayStats  — has: total, completed, byPriority
//   DailyTaskHistoryDataset — has: days: Record<string, DailyTaskHistoryDay>
// ═══════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────

type DailyAnalyticsPreset = "week" | "month" | "last30" | "custom";

interface DailyAnalyticsRange {
  startIso: string; // inclusive, YYYY-MM-DD
  endIso: string;   // inclusive, YYYY-MM-DD
}

interface DailyTrendPoint {
  date: string;
  label: string;
  completed: number;
  total: number;
  rate: number; // 0–100
}

interface DailyRangeAnalytics {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  completionRate: number; // 0–100, 1 decimal place
  activeDays: number;     // days that had at least 1 task
  studiedDays: number;    // days where at least 1 task was completed
  dailyTrend: DailyTrendPoint[];
  priorityBreakdown: { high: number; medium: number; low: number };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Enumerate every ISO date string from startIso to endIso inclusive.
 *  Capped at 400 iterations to prevent infinite loops on bad input. */
const enumerateRangeDates = (startIso: string, endIso: string): string[] => {
  const results: string[] = [];
  let cursor = startIso;
  let guard = 0;
  while (cursor <= endIso && guard < 400) {
    results.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return results;
};

/** Convert a preset + optional custom dates into { startIso, endIso }.
 *
 *  "week"   → Monday of current week → Sunday of current week (7 days)
 *  "month"  → 1st of current month   → last day of current month
 *  "last30" → today − 29             → today (30 days inclusive)
 *  "custom" → user-supplied dates (auto-swapped if inverted; defaults to last30 if blank)
 */
const resolveDailyRange = (
  preset: DailyAnalyticsPreset,
  customStart: string,
  customEnd: string,
  todayIso: string,
): DailyAnalyticsRange => {
  const now = parseIsoDateLocal(todayIso);

  if (preset === "week") {
    const weekStartIso = toLocalIsoDate(startOfWeek(now)); // Monday
    return { startIso: weekStartIso, endIso: addDays(weekStartIso, 6) }; // Sunday
  }

  if (preset === "month") {
    return {
      startIso: toLocalIsoDate(startOfMonth(now)),
      endIso: toLocalIsoDate(endOfMonth(now)),
    };
  }

  if (preset === "last30") {
    return { startIso: addDays(todayIso, -29), endIso: todayIso };
  }

  // custom
  const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const s = isIso(customStart) ? customStart : addDays(todayIso, -29);
  const e = isIso(customEnd)   ? customEnd   : todayIso;
  return s <= e ? { startIso: s, endIso: e } : { startIso: e, endIso: s };
};

/** THE FIXED COMPUTATION — reads from three data sources in priority order.
 *
 *  For each date in the range, stats are resolved as follows:
 *
 *  Priority 1 — dailyTasks (live array):
 *    Used when date === todayIso or date === tomorrowIso.
 *    Filter dailyTasks by scheduledFor === date.
 *    Count total and completed directly from the task objects.
 *    Priority counts come from task.priority.
 *    This is always accurate for current/future tasks.
 *
 *  Priority 2 — dailyTaskHistory.days[date] (historical snapshot):
 *    Used for past dates. The history store saves a snapshot of each
 *    day's tasks when rollover happens. Contains tasks with completed
 *    and priority fields. More reliable than statsByDate for old data.
 *
 *  Priority 3 — statsByDate[date] (accumulated delta counters):
 *    Used as final fallback when neither of the above has data.
 *    Has total, completed, byPriority but may be incomplete for old tasks.
 *
 *  If none of the sources has data for a date, that day contributes zeros.
 */
const computeRangeAnalytics = (
  dailyTasks: import("@/types/models").DailyTask[],
  dailyTaskHistory: import("@/types/models").DailyTaskHistoryDataset,
  statsByDate: Record<string, import("@/types/models").DailyTaskDayStats>,
  range: DailyAnalyticsRange,
  todayIso: string,
  tomorrowIso: string,
): DailyRangeAnalytics => {
  const dates = enumerateRangeDates(range.startIso, range.endIso);

  let totalTasks = 0;
  let completedTasks = 0;
  let activeDays = 0;
  let studiedDays = 0;
  const priority = { high: 0, medium: 0, low: 0 };

  const dailyTrend: DailyTrendPoint[] = dates.map((date) => {
    let dayTotal = 0;
    let dayCompleted = 0;
    const dayPriority = { high: 0, medium: 0, low: 0 };

    if (date === todayIso || date === tomorrowIso) {
      // ── Priority 1: compute directly from live dailyTasks ──
      const tasksForDate = dailyTasks.filter((t) => t.scheduledFor === date);
      dayTotal = tasksForDate.length;
      dayCompleted = tasksForDate.filter((t) => t.completed).length;
      tasksForDate.forEach((t) => {
        if (t.priority === "high")   dayPriority.high   += 1;
        if (t.priority === "medium") dayPriority.medium += 1;
        if (t.priority === "low")    dayPriority.low    += 1;
      });
    } else {
      const historyDay = dailyTaskHistory.days[date];
      if (historyDay) {
        // ── Priority 2: compute from history snapshot ──
        const tasks = historyDay.tasks;
        dayTotal = tasks.length;
        dayCompleted = tasks.filter((t) => t.completed).length;
        tasks.forEach((t) => {
          if (t.priority === "high")   dayPriority.high   += 1;
          if (t.priority === "medium") dayPriority.medium += 1;
          if (t.priority === "low")    dayPriority.low    += 1;
        });
      } else {
        // ── Priority 3: fall back to statsByDate ──
        const stats = statsByDate[date];
        if (stats) {
          dayTotal     = stats.total;
          dayCompleted = stats.completed;
          dayPriority.high   = stats.byPriority?.high   ?? 0;
          dayPriority.medium = stats.byPriority?.medium ?? 0;
          dayPriority.low    = stats.byPriority?.low    ?? 0;
        }
      }
    }

    // Accumulate totals
    totalTasks     += dayTotal;
    completedTasks += dayCompleted;
    if (dayTotal     > 0) activeDays  += 1;
    if (dayCompleted > 0) studiedDays += 1;
    priority.high   += dayPriority.high;
    priority.medium += dayPriority.medium;
    priority.low    += dayPriority.low;

    // Build label: weekday name for ≤14-day ranges, "Mar 16" for longer
    const d = parseIsoDateLocal(date);
    const label =
      dates.length <= 14
        ? d.toLocaleDateString(undefined, { weekday: "short" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const rate = dayTotal > 0
      ? Number(((dayCompleted / dayTotal) * 100).toFixed(1))
      : 0;

    return { date, label, completed: dayCompleted, total: dayTotal, rate };
  });

  const completionRate = totalTasks > 0
    ? Number(((completedTasks / totalTasks) * 100).toFixed(1))
    : 0;

  return {
    totalTasks,
    completedTasks,
    incompleteTasks: Math.max(0, totalTasks - completedTasks),
    completionRate,
    activeDays,
    studiedDays,
    dailyTrend,
    priorityBreakdown: priority,
  };
};

/** Format a date range as a readable string.
 *  Same year:  "Mar 10 – Mar 22, 2026"
 *  Single day: "Mar 17, 2026"
 *  Cross-year: "Dec 28, 2025 – Jan 4, 2026" */
const formatDailyRangeLabel = (startIso: string, endIso: string): string => {
  const fmt = (iso: string, includeYear: boolean): string => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {}),
    });
  };
  if (startIso === endIso) return fmt(startIso, true);
  const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4);
  if (sameYear) return `${fmt(startIso, false)} – ${fmt(endIso, true)}`;
  return `${fmt(startIso, true)} – ${fmt(endIso, true)}`;
};
const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-200",
  medium: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-200",
  low: "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
};

interface DailyTasksNotice {
  tone: "success" | "error";
  message: string;
}

const noticeToneClass: Record<DailyTasksNotice["tone"], string> = {
  success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-400/35 bg-rose-500/15 text-rose-100",
};

interface TaskComposerState {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
}

const taskComposer = (todayIso: string): TaskComposerState => ({
  title: "",
  priority: "medium",
  scheduledFor: todayIso,
});

const isIsoDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeTaskTitleKey = (title: string): string => title.trim().replace(/\s+/g, " ").toLowerCase();

const parseBoolean = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return null;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

interface ImportedDailyTaskCsvRow {
  title: string;
  priority: TaskPriority;
  scheduledFor: string;
  completed: boolean;
}

const parseDailyTaskCsv = (raw: string): ImportedDailyTaskCsvRow[] => {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV is empty or missing rows.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const titleIndex = headers.indexOf("title");
  const priorityIndex = headers.indexOf("priority");
  const scheduledForIndex = headers.indexOf("scheduledfor");
  const completedIndex = headers.indexOf("completed");

  if (titleIndex < 0 || priorityIndex < 0 || scheduledForIndex < 0 || completedIndex < 0) {
    throw new Error("CSV header is invalid. Expected title, priority, scheduledFor, completed.");
  }

  const parsedRows: ImportedDailyTaskCsvRow[] = [];

  lines.slice(1).forEach((line) => {
    const cells = parseCsvLine(line);
    const title = (cells[titleIndex] ?? "").trim();
    const scheduledFor = (cells[scheduledForIndex] ?? "").trim();
    const priorityCandidate = (cells[priorityIndex] ?? "").trim().toLowerCase();
    const completedCandidate = parseBoolean(cells[completedIndex] ?? "");

    if (!title || !isIsoDateString(scheduledFor) || completedCandidate === null) {
      return;
    }

    if (priorityCandidate !== "high" && priorityCandidate !== "medium" && priorityCandidate !== "low") {
      return;
    }

    parsedRows.push({
      title,
      scheduledFor,
      priority: priorityCandidate as TaskPriority,
      completed: completedCandidate,
    });
  });

  if (parsedRows.length === 0) {
    throw new Error("No valid task rows were found in the CSV.");
  }

  return parsedRows;
};

const csvEscape = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

const buildDailyTaskCsv = (tasks: DailyTask[]): string => {
  const header = [
    "id",
    "title",
    "scheduledFor",
    "priority",
    "completed",
    "isRolledOver",
    "rolloverCount",
    "completedAt",
    "createdAt",
    "updatedAt",
  ];

  const rows = tasks.map((task) =>
    [
      task.id,
      task.title,
      task.scheduledFor,
      task.priority,
      String(task.completed),
      String(task.isRolledOver),
      String(task.rolloverCount),
      task.completedAt ?? "",
      task.createdAt,
      task.updatedAt,
    ]
      .map((cell) => csvEscape(cell))
      .join(","),
  );

  return [header.map((cell) => csvEscape(cell)).join(","), ...rows].join("\n");
};

function DailyTaskRow({
  task,
  removing,
  onToggle,
  onEdit,
  onDelete,
  todayIso,
  tomorrowIso,
  recentlyMoved,
  justCompleted,
}: {
  task: DailyTask;
  removing: boolean;
  onToggle: (task: DailyTask, checked: boolean) => void;
  onEdit: (task: DailyTask) => void;
  onDelete: (task: DailyTask) => void;
  todayIso: string;
  tomorrowIso: string;
  recentlyMoved: boolean;
  justCompleted: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const dateLabel = task.scheduledFor === todayIso ? "Today" : task.scheduledFor === tomorrowIso ? "Tomorrow" : task.scheduledFor;
  const [confettiActive, setConfettiActive] = useState(false);
  const prevCompletedRef = useRef(task.completed);

  useEffect(() => {
    if (!prevCompletedRef.current && task.completed) {
      setConfettiActive(true);
    }
    prevCompletedRef.current = task.completed;
  }, [task.completed]);

  return (
    <motion.div
      layout
      initial={reduceMotion ? false : { opacity: 0, x: -20, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.22 } }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <article
        className={`relative flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
          removing
            ? "motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-4 motion-safe:duration-200"
            : "motion-safe:animate-in motion-safe:fade-in"
        } ${recentlyMoved
          ? "ring-2 ring-primary/40 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
          : ""}`}
      >
        <ConfettiBurst trigger={confettiActive} onComplete={() => setConfettiActive(false)} />
        <div className="relative mt-1">
          {justCompleted ? (
            <div className="absolute -inset-2 rounded-full border border-primary/40 motion-safe:animate-completion-burst" />
          ) : null}
          <Checkbox
            checked={task.completed}
            onCheckedChange={(next) => onToggle(task, Boolean(next))}
            className="relative data-[state=checked]:scale-105 transition-transform duration-200"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-semibold transition-colors ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.title}
            </p>
            <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors duration-300 ${priorityBadgeClass[task.priority]}`}>
              {task.priority}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
              {dateLabel}
            </Badge>
            {task.isRolledOver ? (
              <Badge variant="outline" className="rounded-full border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-700 dark:text-rose-200">
                Incomplete
              </Badge>
            ) : null}
            {task.isLinkedMirror ? (
              <span className="inline-flex rounded-full p-[1px] motion-safe:animate-border-flow">
                <Badge variant="outline" className="rounded-full border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 gap-1">
                  <Link2 className="h-3 w-3" />
                  Linked
                </Badge>
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive" onClick={() => onDelete(task)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </article>
    </motion.div>
  );
}

export default function DailyTasksPage() {
  const now = useNow(1_000);
  const {
    todayIso,
    tomorrowIso,
    dailyTasks,
    todayTasks,
    tomorrowTasks,
    analytics,
    statsByDate,
    dailyTaskHistory,
    exportDailyTaskHistory,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    toggleDailyTask,
  } = useDailyTaskStore();
  const reduceMotion = useReducedMotion();

  const [composer, setComposer] = useState<TaskComposerState>(() => taskComposer(todayIso));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DailyTasksNotice | null>(null);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [formVisible] = useState(true);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [streakValue, setStreakValue] = useState(analytics.currentStreak);
  // ── Daily analytics range state ───────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<DailyAnalyticsPreset>("week");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [analyticsExpanded, setAnalyticsExpanded] = useState<boolean>(true);

  /**
   * Called when the user clicks a preset button.
   * If switching to "custom" for the first time, pre-fills the inputs
   * so the user sees a sensible default instead of blank fields.
   */
  const handlePresetChange = (preset: DailyAnalyticsPreset): void => {
    if (preset === "custom" && customStart === "" && customEnd === "") {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      setCustomStart(thirtyDaysAgo.toISOString().slice(0, 10));
      setCustomEnd(todayStr);
    }
    setActivePreset(preset);
  };

  /**
   * Recomputes whenever the preset, custom dates, or todayIso changes.
   * Uses the new resolveDailyRange() defined above.
   */
  const resolvedRange = useMemo<DailyAnalyticsRange>(
    () => resolveDailyRange(activePreset, customStart, customEnd, todayIso),
    [activePreset, customStart, customEnd, todayIso],
  );

  /**
   * Recomputes whenever statsByDate or the resolved range changes.
   * Uses the new computeRangeAnalytics() defined above.
   */
  const rangeAnalytics = useMemo(
    () => computeRangeAnalytics(
      dailyTasks,
      dailyTaskHistory,
      statsByDate,
      resolvedRange,
      todayIso,
      tomorrowIso,
    ),
    [dailyTasks, dailyTaskHistory, statsByDate, resolvedRange, todayIso, tomorrowIso],
  );

  const recentMove = useMemo(() => readRecentTaskMove(now), [now]);

  const taskMap = useMemo(
    () => new Map([...todayTasks, ...tomorrowTasks].map((task) => [task.id, task])),
    [todayTasks, tomorrowTasks],
  );

  const editingTask = editingTaskId ? taskMap.get(editingTaskId) ?? null : null;

  useEffect(() => {
    const controls = animate(0, analytics.currentStreak, {
      duration: reduceMotion ? 0 : 0.6,
      ease: "easeOut",
      onUpdate: (value) => setStreakValue(Math.round(value)),
    });

    return () => controls.stop();
  }, [analytics.currentStreak, reduceMotion]);

  const showNotice = (message: string, tone: DailyTasksNotice["tone"]) => {
    setNotice({ message, tone });
  };

  const resetComposer = () => {
    setComposer(taskComposer(todayIso));
    setEditingTaskId(null);
    setNotice(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (!composer.title.trim()) {
      showNotice("Task name is required.", "error");
      return;
    }

    if (![todayIso, tomorrowIso].includes(composer.scheduledFor)) {
      showNotice("Daily Tasks only allow Today or Tomorrow.", "error");
      return;
    }

    if (editingTask) {
      const result = updateDailyTask(editingTask.id, {
        title: composer.title,
        priority: composer.priority,
        scheduledFor: composer.scheduledFor,
      });

      if (!result.ok) {
        showNotice(result.error ?? "Unable to update task.", "error");
        return;
      }

      resetComposer();
      return;
    }

    const result = addDailyTask({
      title: composer.title,
      priority: composer.priority,
      scheduledFor: composer.scheduledFor,
    });

    if (!result.ok) {
      showNotice(result.error ?? "Unable to create task.", "error");
      return;
    }

    resetComposer();
  };

  const handleEdit = (task: DailyTask) => {
    setEditingTaskId(task.id);
    setComposer({
      title: task.title,
      priority: task.priority,
      scheduledFor: task.scheduledFor,
    });
    setNotice(null);
  };

  const handleDelete = (task: DailyTask) => {
    setRemovingTaskId(task.id);
    window.setTimeout(() => {
      deleteDailyTask(task.id);
      setRemovingTaskId((current) => (current === task.id ? null : current));
    }, 190);
  };

  const handleToggle = (task: DailyTask, checked: boolean) => {
    if (checked && !task.completed) {
      setJustCompletedId(task.id);
      window.setTimeout(() => setJustCompletedId((current) => (current === task.id ? null : current)), 600);
    }

    toggleDailyTask(task.id, checked, checked);
  };

  const exportDailyTasks = () => {
    const sortedTasks = [...dailyTasks].sort((a, b) => {
      const dateCompare = a.scheduledFor.localeCompare(b.scheduledFor);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return a.createdAt.localeCompare(b.createdAt);
    });

    const payload = buildDailyTaskCsv(sortedTasks);
    const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-tasks-${todayIso}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportDailyHistory = () => {
    const history = exportDailyTaskHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-task-history-${todayIso}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    setNotice(null);

    try {
      const raw = await file.text();
      const parsedRows = parseDailyTaskCsv(raw);
      const existingKeys = new Set(
        dailyTasks.map((task) => `${task.scheduledFor}::${normalizeTaskTitleKey(task.title)}`),
      );

      let imported = 0;
      let skipped = 0;

      parsedRows.forEach((row) => {
        const dedupeKey = `${row.scheduledFor}::${normalizeTaskTitleKey(row.title)}`;
        if (existingKeys.has(dedupeKey)) {
          skipped += 1;
          return;
        }

        const created = addDailyTask({
          title: row.title,
          priority: row.priority,
          scheduledFor: row.scheduledFor,
        });

        if (!created.ok || !created.taskId) {
          skipped += 1;
          return;
        }

        existingKeys.add(dedupeKey);
        imported += 1;

        if (row.completed) {
          toggleDailyTask(created.taskId, true, false);
        }
      });

      showNotice(
        imported > 0 ? `Imported ${imported} task(s). ${skipped} skipped.` : `No tasks imported. ${skipped} skipped.`,
        imported > 0 ? "success" : "error",
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to import CSV.";
      showNotice(msg, "error");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Daily Tasks (Today + Tomorrow)
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  void handleImportFile(event);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "Importing..." : "Import Daily Tasks"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportDailyTasks}>
                <Download className="mr-2 h-4 w-4" />
                Export Daily Tasks
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportDailyHistory}>
                <Download className="mr-2 h-4 w-4" />
                Export Full History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {formVisible ? (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: "hidden" }}
              >
                <form className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_180px_auto] md:items-end" onSubmit={submit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="daily-task-title">Task name</Label>
                    <Input
                      id="daily-task-title"
                      value={composer.title}
                      onChange={(event) => setComposer((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Read chapter notes"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={composer.priority}
                      onValueChange={(priority) => setComposer((prev) => ({ ...prev, priority: priority as TaskPriority }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="daily-task-date">Date</Label>
                    <Input
                      id="daily-task-date"
                      type="date"
                      min={todayIso}
                      max={tomorrowIso}
                      value={composer.scheduledFor}
                      onChange={(event) => setComposer((prev) => ({ ...prev, scheduledFor: event.target.value }))}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" className="rounded-xl">
                      <Plus className="mr-2 h-4 w-4" />
                      {editingTask ? "Save" : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkDialogOpen(true)}
                      className="gap-1.5 rounded-xl"
                    >
                      <ListPlus className="h-4 w-4" />
                      Add Multiple
                    </Button>
                    {editingTask ? (
                      <Button type="button" variant="outline" className="rounded-xl" onClick={resetComposer}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {notice ? (
              <motion.div
                key={notice.message}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.97 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-xl border px-3 py-2 text-sm ${noticeToneClass[notice.tone]}`}
                role="status"
                aria-live="polite"
              >
                {notice.message}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════════
              DAILY ANALYTICS — FULLY REBUILT
              All preset buttons work. All charts recompute on range change.
              ════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/40 p-4">

            {/* ── Section header with collapse toggle ── */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-expanded={analyticsExpanded}
                onClick={() => setAnalyticsExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                <BarChart2 className="h-4 w-4 text-primary" />
                Daily Analytics
                <motion.span
                  animate={{ rotate: analyticsExpanded ? 0 : -90 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.span>
              </button>

              {/* ── Animated range badge ── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${resolvedRange.startIso}|${resolvedRange.endIso}`}
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDailyRangeLabel(resolvedRange.startIso, resolvedRange.endIso)}</span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Collapsible body ── */}
            <AnimatePresence initial={false}>
              {analyticsExpanded && (
                <motion.div
                  key="analytics-body"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                  className="space-y-5"
                >

                  {/* ── Preset buttons ── */}
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Analytics date range">
                    {(
                      [
                        { id: "week"   as const, label: "This week"   },
                        { id: "month"  as const, label: "This month"  },
                        { id: "last30" as const, label: "Last 30 days"},
                        { id: "custom" as const, label: "Custom range"},
                      ] satisfies Array<{ id: DailyAnalyticsPreset; label: string }>
                    ).map((option) => {
                      const isActive = activePreset === option.id;
                      return (
                        <motion.button
                          key={option.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => handlePresetChange(option.id)}
                          whileHover={reduceMotion ? {} : { scale: 1.05, y: -1 }}
                          whileTap={reduceMotion  ? {} : { scale: 0.95 }}
                          className={[
                            "relative overflow-hidden rounded-xl border px-3 py-1.5 text-xs font-semibold",
                            "transition-colors duration-150 focus-visible:outline-none",
                            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                            isActive
                              ? "border-primary/50 text-primary"
                              : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                          ].join(" ")}
                        >
                          {/* Shared-layout animated background pill */}
                          {isActive && (
                            <motion.span
                              layoutId="dailyAnalyticsActivePill"
                              className="absolute inset-0 bg-primary/10 rounded-xl"
                              transition={
                                reduceMotion
                                  ? { duration: 0 }
                                  : { type: "spring", stiffness: 380, damping: 30 }
                              }
                            />
                          )}
                          <span className="relative">{option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* ── Custom date pickers (slide open only when "custom" is active) ── */}
                  <AnimatePresence>
                    {activePreset === "custom" && (
                      <motion.div
                        key="custom-inputs"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">From</p>
                          <Input
                            type="date"
                            value={customStart}
                            max={customEnd || undefined}
                            onChange={(e) => setCustomStart(e.target.value)}
                            aria-label="Analytics range start date"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">To</p>
                          <Input
                            type="date"
                            value={customEnd}
                            min={customStart || undefined}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            aria-label="Analytics range end date"
                            className="rounded-xl"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Stat tiles (4 KPI cards) ── */}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "Completed",
                        value: String(rangeAnalytics.completedTasks),
                        sub:   `of ${rangeAnalytics.totalTasks} scheduled`,
                        tone:  "emerald" as const,
                      },
                      {
                        label: "Completion Rate",
                        value: `${rangeAnalytics.completionRate}%`,
                        sub:   `${rangeAnalytics.activeDays} day(s) with tasks`,
                        tone:  "sky" as const,
                      },
                      {
                        label: "Incomplete",
                        value: String(rangeAnalytics.incompleteTasks),
                        sub:   `${rangeAnalytics.studiedDays} day(s) completed ≥1`,
                        tone:  "rose" as const,
                      },
                      {
                        label: "Current Streak",
                        value: String(streakValue),
                        sub:   `Best ever: ${analytics.longestStreak} day(s)`,
                        tone:  "amber" as const,
                      },
                    ].map((tile, idx) => (
                        <motion.div
                          key={tile.label}
                          initial={{ opacity: 0, y: 12, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0,  scale: 1    }}
                          transition={{
                            delay:    reduceMotion ? 0 : idx * 0.055,
                            duration: reduceMotion ? 0 : 0.32,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          whileHover={reduceMotion ? {} : { y: -2, scale: 1.02 }}
                          className={`rounded-xl border p-3 ${
                            tile.tone === "emerald"
                              ? "border-emerald-400/30 bg-emerald-500/10"
                              : tile.tone === "sky"
                                ? "border-sky-400/30 bg-sky-500/10"
                                : tile.tone === "rose"
                                  ? "border-rose-400/30 bg-rose-500/10"
                                  : "border-amber-400/30 bg-amber-500/10"
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                            {tile.label}
                          </p>
                          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">
                            {tile.value}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{tile.sub}</p>
                        </motion.div>
                    ))}
                  </div>

                  {/* ── Charts or empty state ── */}
                  {rangeAnalytics.totalTasks > 0 ? (
                    <div className="space-y-4">

                      {/* Row 1: Daily bar chart + Priority pie */}
                      <div className="grid gap-4 lg:grid-cols-2">

                        {/* Bar chart — daily totals vs completions */}
                        <motion.div
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0  }}
                          transition={{ delay: reduceMotion ? 0 : 0.1, duration: reduceMotion ? 0 : 0.38 }}
                          className="rounded-xl border border-border/60 bg-background/55 p-3"
                        >
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                            Daily Completions
                          </p>
                          <div className="h-[190px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={rangeAnalytics.dailyTrend}
                                margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
                                barCategoryGap="20%"
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="hsl(var(--border))"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                  axisLine={false}
                                  tickLine={false}
                                  interval="preserveStartEnd"
                                />
                                <YAxis
                                  allowDecimals={false}
                                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                  }}
                                  formatter={(v: number, name: string) => [
                                    v,
                                    name === "completed" ? "✓ Completed" : "· Scheduled",
                                  ]}
                                />
                                <Bar
                                  dataKey="total"
                                  name="total"
                                  fill="hsl(var(--muted))"
                                  radius={[3, 3, 0, 0]}
                                  animationBegin={80}
                                  animationDuration={650}
                                  animationEasing="ease-out"
                                />
                                <Bar
                                  dataKey="completed"
                                  name="completed"
                                  fill="hsl(var(--chart-1))"
                                  radius={[3, 3, 0, 0]}
                                  animationBegin={160}
                                  animationDuration={750}
                                  animationEasing="ease-out"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>

                        {/* Donut pie chart — priority breakdown */}
                        <motion.div
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0  }}
                          transition={{ delay: reduceMotion ? 0 : 0.18, duration: reduceMotion ? 0 : 0.38 }}
                          className="rounded-xl border border-border/60 bg-background/55 p-3"
                        >
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                            Priority Breakdown
                          </p>
                          <div className="h-[190px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: "High",   value: rangeAnalytics.priorityBreakdown.high   },
                                    { name: "Medium", value: rangeAnalytics.priorityBreakdown.medium },
                                    { name: "Low",    value: rangeAnalytics.priorityBreakdown.low    },
                                  ].filter((e) => e.value > 0)}
                                  dataKey="value"
                                  nameKey="name"
                                  outerRadius={75}
                                  innerRadius={38}
                                  animationBegin={200}
                                  animationDuration={900}
                                  label={({ name, percent }) =>
                                    (percent ?? 0) > 0.06
                                      ? `${name}: ${Math.round((percent ?? 0) * 100)}%`
                                      : ""
                                  }
                                  labelLine={false}
                                >
                                  <Cell fill="#ef4444" />
                                  <Cell fill="#f59e0b" />
                                  <Cell fill="#22c55e" />
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                  }}
                                  formatter={(v: number) => [v, "Tasks"]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </motion.div>
                      </div>

                    </div>
                  ) : (
                    /* ── Empty state when no tasks exist in this range ── */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1    }}
                      transition={{ duration: reduceMotion ? 0 : 0.3 }}
                      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-background/40 p-8 text-center"
                    >
                      <BarChart2 className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No task data for this range
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Try selecting a different period or add tasks to see analytics.
                      </p>
                    </motion.div>
                  )}

                  {/* ── Insights (always shown when available, not range-filtered) ── */}
                  {analytics.insights.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : 0.38, duration: reduceMotion ? 0 : 0.32 }}
                      className="space-y-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                        Insights
                      </p>
                      {analytics.insights.map((insight, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0   }}
                          transition={{
                            delay:    reduceMotion ? 0 : 0.40 + idx * 0.055,
                            duration: reduceMotion ? 0 : 0.26,
                          }}
                          className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs text-muted-foreground"
                        >
                          {insight}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* ═══════════════ END DAILY ANALYTICS ═══════════════ */}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 thin-scrollbar">
            {todayTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
              >
                <div className="rounded-2xl bg-muted/60 p-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No tasks for today yet.</p>
                <p className="text-xs text-muted-foreground/70">Add a task to kickstart today.</p>
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {todayTasks.map((task) => (
                  <DailyTaskRow
                    key={task.id}
                    task={task}
                    removing={removingTaskId === task.id}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    todayIso={todayIso}
                    tomorrowIso={tomorrowIso}
                    recentlyMoved={recentMove?.destination === "daily" && recentMove.taskId === task.id}
                    justCompleted={justCompletedId === task.id}
                  />
                ))}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Tomorrow Planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 thin-scrollbar">
            {tomorrowTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
              >
                <div className="rounded-2xl bg-muted/60 p-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Plan tomorrow by adding tasks above.</p>
                <p className="text-xs text-muted-foreground/70">Schedule priorities for the next day.</p>
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {tomorrowTasks.map((task) => (
                  <DailyTaskRow
                    key={task.id}
                    task={task}
                    removing={removingTaskId === task.id}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    todayIso={todayIso}
                    tomorrowIso={tomorrowIso}
                    recentlyMoved={recentMove?.destination === "daily" && recentMove.taskId === task.id}
                    justCompleted={justCompletedId === task.id}
                  />
                ))}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>

      <BulkAddTasksDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        mode="daily"
        todayIso={todayIso}
        onConfirm={(titles, shared) => {
          let successCount = 0;
          for (const title of titles) {
            const result = addDailyTask({
              title,
              priority: shared.priority,
              scheduledFor: shared.scheduledFor,
            });
            if (result.ok) {
              successCount += 1;
            }
          }
          showNotice(
            `${successCount} task${successCount === 1 ? "" : "s"} created.`,
            successCount > 0 ? "success" : "error",
          );
        }}
      />
    </div>
  );
}


