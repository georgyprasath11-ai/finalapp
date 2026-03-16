import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Archive, Check, GripVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfettiBurst } from "@/components/common/ConfettiBurst";
import { cn } from "@/lib/utils";
import { Subject, Task } from "@/types/models";
import { normalizeTaskLifecycleStatus } from "@/utils/task-lifecycle";
import { formatDateLabel, formatMinutes, formatStudyTime } from "@/utils/format";

interface TaskListProps {
  tasks: Task[];
  subjects: Subject[];
  todayIso: string;
  onToggleDone: (taskId: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onReorder?: (sourceTaskId: string, targetTaskId: string) => void;
  onReschedule?: (task: Task) => void;
  onBulkComplete?: (taskIds: string[]) => void;
  onBulkReopen?: (taskIds: string[]) => void;
  onBulkMoveToActive?: (taskIds: string[]) => void;
  onBulkMoveToArchive?: (taskIds: string[]) => void;
  onBulkDelete?: (taskIds: string[]) => void;
  recentlyMovedTaskId?: string | null;
  recentlyAddedTaskId?: string | null;
  renderRowActions?: (task: Task) => ReactNode;
}

const priorityClass = {
  high: "border-rose-400/35 bg-rose-500/10 text-rose-200",
  medium: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  low: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
} as const;

const formatLastWorked = (lastWorkedAt: number | null | undefined): string => {
  if (typeof lastWorkedAt !== "number" || !Number.isFinite(lastWorkedAt)) {
    return "Not worked yet";
  }

  return new Date(lastWorkedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const VIRTUALIZATION_THRESHOLD = 120;
const ROW_ESTIMATE_PX = 202;

interface TaskRowProps {
  task: Task;
  subjectName: string;
  subjectColor: string;
  overdue: boolean;
  lifecycleStatus: ReturnType<typeof normalizeTaskLifecycleStatus>;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleDone: (taskId: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onReschedule?: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDropOn: (taskId: string) => void;
  onDragOver: (taskId: string) => void;
  onDragLeave: (taskId: string) => void;
  draggableEnabled: boolean;
  recentlyMoved: boolean;
  recentlyAdded: boolean;
  isDragTarget: boolean;
  isDragging: boolean;
  rowActions?: ReactNode;
}

const TaskRow = memo(function TaskRow({
  task,
  subjectName,
  subjectColor,
  overdue,
  lifecycleStatus,
  selected,
  onSelect,
  onToggleDone,
  onEdit,
  onDelete,
  onReschedule,
  onDragStart,
  onDropOn,
  onDragOver,
  onDragLeave,
  draggableEnabled,
  recentlyMoved,
  recentlyAdded,
  isDragTarget,
  isDragging,
  rowActions,
}: TaskRowProps) {
  const reduceMotion = useReducedMotion();
  const totalSeconds = typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
    ? Math.max(0, Math.floor(task.totalTimeSeconds))
    : 0;
  const sessionCount = typeof task.sessionCount === "number" && Number.isFinite(task.sessionCount)
    ? Math.max(0, Math.floor(task.sessionCount))
    : 0;
  const averageSessionSeconds = Math.floor(totalSeconds / Math.max(sessionCount, 1));
  const isCompleted = lifecycleStatus === "completed" || task.completed;
  const isBacklog = lifecycleStatus === "backlog";

  const [confettiActive, setConfettiActive] = useState(false);
  const prevCompletedRef = useRef(isCompleted);

  useEffect(() => {
    if (!prevCompletedRef.current && isCompleted) {
      setConfettiActive(true);
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted]);

  const dragShadow = "0 22px 46px hsl(220 55% 3% / 0.4)";

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96, backgroundColor: recentlyAdded ? "hsl(var(--primary) / 0.12)" : undefined }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isDragging ? 1.03 : 1,
        rotate: isDragging ? 1.5 : 0,
        boxShadow: isDragging ? dragShadow : undefined,
        backgroundColor: recentlyAdded && !reduceMotion ? "hsl(var(--card) / 0.85)" : undefined,
      }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative rounded-2xl border border-border/60 bg-card/85 p-3 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg",
        isCompleted ? "opacity-75" : "",
        overdue && !isCompleted ? "border-rose-400/40 bg-rose-500/10" : "",
        recentlyMoved
          ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
          : "",
        recentlyAdded ? "motion-safe:animate-bounce-in ring-2 ring-primary/40" : "",
        isDragTarget ? "border-dashed border-primary/50 motion-safe:animate-pulse" : "",
      )}
      draggable={draggableEnabled}
      onDragStart={draggableEnabled ? () => onDragStart(task.id) : undefined}
      onDragOver={draggableEnabled ? (event) => {
        event.preventDefault();
        onDragOver(task.id);
      } : undefined}
      onDragLeave={draggableEnabled ? () => onDragLeave(task.id) : undefined}
      onDrop={draggableEnabled ? () => onDropOn(task.id) : undefined}
    >
      <ConfettiBurst trigger={confettiActive} onComplete={() => setConfettiActive(false)} />
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={(state) => onSelect(Boolean(state))} aria-label={`Select task ${task.title}`} />
        {draggableEnabled && selected ? (
          <button type="button" className="mt-0.5 cursor-grab text-muted-foreground/60" aria-label="Drag task">
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleDone(task.id, !isCompleted)}
              className={cn(
                "text-left text-sm font-semibold transition-colors duration-200",
                isCompleted ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <motion.span
                animate={{ opacity: isCompleted ? 0.6 : 1, textDecoration: isCompleted ? "line-through" : "none" }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                {task.title}
              </motion.span>
            </button>
            <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-[11px] transition-colors duration-300", priorityClass[task.priority])}>
              {task.priority}
            </Badge>
            {isBacklog ? (
              <Badge variant="outline" className="rounded-full border-amber-400/45 bg-amber-500/15 text-amber-200">
                Backlog
              </Badge>
            ) : null}
            {overdue && !isCompleted ? (
              <Badge variant="outline" className="rounded-full border-rose-400/45 bg-rose-500/15 text-rose-200">
                Overdue
              </Badge>
            ) : null}
          </div>

          {task.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subjectColor }} />
              {subjectName}
            </span>
            {task.estimatedMinutes ? <span>{formatMinutes(task.estimatedMinutes)}</span> : null}
            {task.dueDate ? <span>Due {formatDateLabel(task.dueDate)}</span> : null}
            {task.rollovers > 0 ? <span>Rolled over {task.rollovers}x</span> : null}
            {isBacklog && onReschedule ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 rounded-lg px-2 text-[11px]"
                onClick={() => onReschedule(task)}
              >
                Reschedule
              </Button>
            ) : null}
          </div>

          <div className="mt-2 grid gap-1 rounded-xl border border-border/60 bg-background/50 p-2 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <span className="tabular-nums">Time: {formatStudyTime(totalSeconds)}</span>
            <span className="tabular-nums">Sessions: {sessionCount}</span>
            <span className="tabular-nums">Avg: {formatStudyTime(averageSessionSeconds)}</span>
            <span className="tabular-nums">Last: {formatLastWorked(task.lastWorkedAt)}</span>
          </div>
        </div>

        <div className={cn("flex items-center gap-1 transition", selected ? "opacity-100" : "pointer-events-none opacity-0")}
        >
          {rowActions}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
            onClick={() => onToggleDone(task.id, !isCompleted)}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onDelete(task.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
});

export const TaskList = memo(function TaskList({
  tasks,
  subjects,
  todayIso,
  onToggleDone,
  onEdit,
  onDelete,
  onReorder,
  onReschedule,
  onBulkComplete,
  onBulkReopen,
  onBulkMoveToActive,
  onBulkMoveToArchive,
  onBulkDelete,
  recentlyMovedTaskId = null,
  recentlyAddedTaskId = null,
  renderRowActions,
}: TaskListProps) {
  const draggableEnabled = typeof onReorder === "function";
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const shouldVirtualize = tasks.length >= VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 6,
    enabled: shouldVirtualize,
  });

  useEffect(() => {
    if (selectedTaskIds.size === 0) {
      return;
    }

    const visibleIds = new Set(tasks.map((task) => task.id));
    setSelectedTaskIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      previous.forEach((taskId) => {
        if (visibleIds.has(taskId)) {
          next.add(taskId);
        } else {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [tasks, selectedTaskIds.size]);

  useEffect(() => {
    if (!draggingTaskId) {
      setDropTargetId(null);
    }
  }, [draggingTaskId]);

  const selectedTaskIdsArray = useMemo(() => Array.from(selectedTaskIds), [selectedTaskIds]);
  const selectedTasks = useMemo(() => tasks.filter((task) => selectedTaskIds.has(task.id)), [selectedTaskIds, tasks]);
  const selectedCount = selectedTaskIds.size;

  const canComplete = selectedCount > 0 && selectedTasks.some((task) => normalizeTaskLifecycleStatus(task) !== "completed");
  const canReopen = selectedCount > 0 && selectedTasks.some((task) => normalizeTaskLifecycleStatus(task) === "completed");
  const canMoveToActive = selectedCount > 0 && selectedTasks.some((task) => normalizeTaskLifecycleStatus(task) !== "active");
  const canMoveToArchive = selectedCount > 0 && selectedTasks.some((task) => normalizeTaskLifecycleStatus(task) !== "archived");

  const clearSelection = () => {
    setSelectedTaskIds((previous) => (previous.size > 0 ? new Set() : previous));
  };

  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
      >
        <div className="rounded-2xl bg-muted/60 p-4">
          <Archive className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No tasks match the current filter.</p>
        <p className="text-xs text-muted-foreground/70">Adjust filters or add a new task.</p>
      </motion.div>
    );
  }

  const renderBulkActionBar = () => {
    if (selectedCount <= 0) {
      return null;
    }

    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-2.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {selectedCount} selected
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!canComplete || !onBulkComplete) {
              return;
            }
            onBulkComplete(selectedTaskIdsArray);
            clearSelection();
          }}
          disabled={!canComplete}
        >
          Complete
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!canReopen || !onBulkReopen) {
              return;
            }
            onBulkReopen(selectedTaskIdsArray);
            clearSelection();
          }}
          disabled={!canReopen}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reopen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!canMoveToActive || !onBulkMoveToActive) {
              return;
            }
            onBulkMoveToActive(selectedTaskIdsArray);
            clearSelection();
          }}
          disabled={!canMoveToActive}
        >
          Move to Active
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          title="Backlog is automatically managed"
          aria-label="Backlog is automatically managed"
        >
          Move to Backlog
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!canMoveToArchive || !onBulkMoveToArchive) {
              return;
            }
            onBulkMoveToArchive(selectedTaskIdsArray);
            clearSelection();
          }}
          disabled={!canMoveToArchive}
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          Move to Archive
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={selectedCount === 0 || !onBulkDelete}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    );
  };

  const renderRow = (task: Task) => {
    const subject = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
    const lifecycleStatus = normalizeTaskLifecycleStatus(task);
    const selected = selectedTaskIds.has(task.id);
    const overdue =
      lifecycleStatus !== "completed" &&
      lifecycleStatus !== "archived" &&
      task.dueDate !== null &&
      task.dueDate < todayIso;

    return (
      <TaskRow
        key={task.id}
        task={task}
        subjectName={subject?.name ?? "Unassigned"}
        subjectColor={subject?.color ?? "#64748b"}
        overdue={overdue}
        lifecycleStatus={lifecycleStatus}
        selected={selected}
        onSelect={(checked) => {
          setSelectedTaskIds((previous) => {
            const next = new Set(previous);
            if (checked) {
              next.add(task.id);
            } else {
              next.delete(task.id);
            }
            return next;
          });
        }}
        onToggleDone={onToggleDone}
        onEdit={onEdit}
        onDelete={onDelete}
        onReschedule={onReschedule}
        draggableEnabled={draggableEnabled}
        onDragStart={(taskId) => setDraggingTaskId(taskId)}
        onDragOver={(taskId) => setDropTargetId(taskId)}
        onDragLeave={(taskId) => setDropTargetId((current) => (current === taskId ? null : current))}
        recentlyMoved={recentlyMovedTaskId === task.id}
        recentlyAdded={recentlyAddedTaskId === task.id}
        isDragTarget={dropTargetId === task.id && draggingTaskId !== task.id}
        isDragging={draggingTaskId === task.id}
        rowActions={renderRowActions ? renderRowActions(task) : null}
        onDropOn={(targetTaskId) => {
          if (!draggableEnabled || !onReorder || !draggingTaskId || draggingTaskId === targetTaskId) {
            return;
          }
          onReorder(draggingTaskId, targetTaskId);
          setDraggingTaskId(null);
          setDropTargetId(null);
        }}
      />
    );
  };

  return (
    <>
      {renderBulkActionBar()}

      {shouldVirtualize ? (
        <div ref={scrollRef} className="thin-scrollbar max-h-[68vh] overflow-auto rounded-xl pr-1">
          <div
            className="relative w-full"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const task = tasks[virtualItem.index];
              if (!task) {
                return null;
              }

              return (
                <div
                  key={task.id}
                  className="absolute left-0 top-0 w-full pb-2"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {renderRow(task)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="thin-scrollbar space-y-2">
          <AnimatePresence initial={false}>
            {tasks.map((task) => renderRow(task))}
          </AnimatePresence>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedCount} task(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(event) => {
                event.preventDefault();
                if (!onBulkDelete || selectedTaskIdsArray.length === 0) {
                  setDeleteDialogOpen(false);
                  return;
                }
                onBulkDelete(selectedTaskIdsArray);
                clearSelection();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
