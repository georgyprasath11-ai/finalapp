import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskDialog, TaskFormValue } from "@/components/tasks/TaskDialog";
import { TaskFilters, TaskFiltersValue } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { customTaskCategories } from "@/lib/constants";
import { classifyTimedTaskType } from "@/lib/daily-tasks";
import { cn } from "@/lib/utils";
import { DeleteTaskCategoryOptions, useAppStore } from "@/store/app-store";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { Task, TaskType } from "@/types/models";
import { normalizeTaskLifecycleStatus } from "@/utils/task-lifecycle";
import { addDays } from "@/utils/date";

const initialFilters: TaskFiltersValue = {
  search: "",
  subjectId: "all",
  status: "all",
  priority: "all",
  statusFilter: "all",
};

type StatusTab = "incomplete" | "completed";
type DurationTab = "short" | "long";
type CategoryDialogMode = "add" | "rename";

type InlineToast = {
  id: number;
  tone: "success" | "error";
  message: string;
};

const toastToneClass: Record<InlineToast["tone"], string> = {
  success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-400/35 bg-rose-500/15 text-rose-100",
};

const parseIsoMs = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTabTime = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes < 60) {
    return `${safeMinutes} min`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
};

const taskMinutes = (task: Task): number => {
  const totalSeconds = typeof task.totalTimeSeconds === "number" && Number.isFinite(task.totalTimeSeconds)
    ? task.totalTimeSeconds
    : (typeof task.timeSpent === "number" && Number.isFinite(task.timeSpent)
        ? task.timeSpent
        : 0);

  return Math.max(0, Math.floor(totalSeconds / 60));
};

const durationTypeLabel = (duration: DurationTab): string => (duration === "short" ? "Short Term" : "Long Term");

export default function TasksPage() {
  const {
    data,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    bulkDeleteTasks,
    bulkCompleteTasks,
    bulkSetTaskLifecycleStatus,
    addTaskCategory,
    renameTaskCategory,
    deleteTaskCategory,
    reorderTaskCategory,
    setActiveTaskCategory,
  } = useAppStore();
  const { todayIso, tomorrowIso, previewCheckboxSound } = useDailyTaskStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const minFutureDateIso = addDays(tomorrowIso, 1);

  const [filters, setFilters] = useState<TaskFiltersValue>(initialFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [focusDueDateOnOpen, setFocusDueDateOnOpen] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [statusTab, setStatusTab] = useState<StatusTab>("incomplete");
  const [durationTab, setDurationTab] = useState<DurationTab>("short");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogMode, setCategoryDialogMode] = useState<CategoryDialogMode>("add");
  const [categoryDraft, setCategoryDraft] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState<DeleteTaskCategoryOptions["strategy"]>("move");
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = useState<string | null>(null);

  const [toast, setToast] = useState<InlineToast | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);

  const completionSoundAtRef = useRef(0);
  const debouncedSearch = useDebouncedValue(filters.search, 180);

  const categories = useMemo(() => customTaskCategories(data?.categories), [data?.categories]);

  const effectiveFilters = useMemo(
    () => (filters.search === debouncedSearch ? filters : { ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId(null);
      return;
    }

    const preferredActive =
      data?.activeCategoryId && categories.some((category) => category.id === data.activeCategoryId)
        ? data.activeCategoryId
        : null;

    setSelectedCategoryId((previous) => {
      if (preferredActive && preferredActive !== previous) {
        return preferredActive;
      }

      if (previous && categories.some((category) => category.id === previous)) {
        return previous;
      }

      return categories[0]?.id ?? null;
    });
  }, [categories, data?.activeCategoryId]);

  useEffect(() => {
    if (!data || !selectedCategoryId) {
      return;
    }

    if (data.activeCategoryId !== selectedCategoryId) {
      setActiveTaskCategory(selectedCategoryId);
    }
  }, [data, selectedCategoryId, setActiveTaskCategory]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const applyFilters = useCallback((tasks: Task[]): Task[] => {
    const query = effectiveFilters.search.trim().toLowerCase();

    return tasks.filter((task) => {
      const lifecycleStatus = normalizeTaskLifecycleStatus(task);

      if (lifecycleStatus === "archived") {
        return false;
      }

      if (effectiveFilters.statusFilter === "active" && lifecycleStatus !== "active") {
        return false;
      }

      if (effectiveFilters.statusFilter === "backlog" && lifecycleStatus !== "backlog") {
        return false;
      }

      if (effectiveFilters.subjectId !== "all") {
        if (effectiveFilters.subjectId === "none" && task.subjectId !== null) {
          return false;
        }

        if (effectiveFilters.subjectId !== "none" && task.subjectId !== effectiveFilters.subjectId) {
          return false;
        }
      }

      if (effectiveFilters.priority !== "all" && task.priority !== effectiveFilters.priority) {
        return false;
      }

      if (query.length > 0) {
        const haystack = `${task.title} ${task.description}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [effectiveFilters]);

  const editingTask = editingTaskId && data ? data.tasks.find((task) => task.id === editingTaskId) : undefined;

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const alternateCategoryOptions = useMemo(
    () => categories.filter((category) => category.id !== pendingDeleteCategoryId),
    [categories, pendingDeleteCategoryId],
  );

  const pendingDeleteTaskCount = useMemo(() => {
    if (!data || !pendingDeleteCategoryId) {
      return 0;
    }

    return data.tasks.filter((task) => task.categoryId === pendingDeleteCategoryId).length;
  }, [data, pendingDeleteCategoryId]);

  const categoryTimeTotals = useMemo(() => {
    const totals = new Map<string, number>();

    if (!data) {
      return totals;
    }

    for (const category of categories) {
      totals.set(category.id, 0);
    }

    for (const task of data.tasks) {
      if (!task.categoryId || !totals.has(task.categoryId)) {
        continue;
      }

      totals.set(task.categoryId, (totals.get(task.categoryId) ?? 0) + taskMinutes(task));
    }

    return totals;
  }, [categories, data]);

  const visibleTasks = useMemo(() => {
    if (!data || !selectedCategoryId) {
      return [];
    }

    const filtered = data.tasks.filter((task) => {
      if (task.categoryId !== selectedCategoryId) {
        return false;
      }

      const lifecycleStatus = normalizeTaskLifecycleStatus(task);
      const isCompleted = lifecycleStatus === "completed" || task.completed;

      if (lifecycleStatus === "archived") {
        return false;
      }

      if (statusTab === "incomplete" && isCompleted) {
        return false;
      }

      if (statusTab === "completed" && !isCompleted) {
        return false;
      }

      const isShort = task.type === TaskType.SHORT_TERM;
      if (durationTab === "short" && !isShort) {
        return false;
      }

      if (durationTab === "long" && isShort) {
        return false;
      }

      return true;
    });

    const withSearchFilters = applyFilters(filtered);

    return [...withSearchFilters].sort((a, b) => {
      if (statusTab === "completed") {
        const completedCompare = parseIsoMs(b.completedAt) - parseIsoMs(a.completedAt);
        if (completedCompare !== 0) {
          return completedCompare;
        }
      }

      const createdCompare = parseIsoMs(b.createdAt) - parseIsoMs(a.createdAt);
      if (createdCompare !== 0) {
        return createdCompare;
      }

      return b.order - a.order;
    });
  }, [applyFilters, data, durationTab, selectedCategoryId, statusTab]);

  useEffect(() => {
    const shouldOpenDialog = searchParams.get("new") === "1";
    if (!shouldOpenDialog) {
      return;
    }

    setFocusDueDateOnOpen(false);
    setEditingTaskId(null);
    setDialogOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("new");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("focus") !== "search") {
      return;
    }

    const timeout = window.setTimeout(() => {
      const input = document.getElementById("tasks-search-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 70);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("focus");
    setSearchParams(nextParams, { replace: true });

    return () => window.clearTimeout(timeout);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const incomingStatusFilter = searchParams.get("statusFilter");
    if (incomingStatusFilter !== "all" && incomingStatusFilter !== "active" && incomingStatusFilter !== "backlog") {
      return;
    }

    setFilters((previous) => (
      previous.statusFilter === incomingStatusFilter
        ? previous
        : { ...previous, statusFilter: incomingStatusFilter }
    ));

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("statusFilter");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }

  const pushToast = (tone: InlineToast["tone"], text: string) => {
    setToast({ id: Date.now(), tone, message: text });
  };

  const submitTask = (value: TaskFormValue): string | null => {
    setMessage("");
    const dueDate = value.dueDate;

    if (!dueDate) {
      const error = "Please choose a date beyond tomorrow.";
      setMessage(error);
      return error;
    }

    if (dueDate <= tomorrowIso) {
      const error = "Short-term and Long-term tasks must be scheduled after tomorrow.";
      setMessage(error);
      return error;
    }

    if (editingTask) {
      updateTask(editingTask.id, {
        title: value.title,
        description: value.notes,
        subjectId: value.subjectId,
        priority: value.priority,
        categoryId: value.categoryId,
        estimatedMinutes: value.estimatedMinutes,
        dueDate,
      });
      setEditingTaskId(null);
      setFocusDueDateOnOpen(false);
      pushToast("success", "Task updated.");
      return null;
    }

    addTask({
      title: value.title,
      description: value.notes,
      subjectId: value.subjectId,
      bucket: value.bucket,
      priority: value.priority,
      categoryId: value.categoryId,
      estimatedMinutes: value.estimatedMinutes,
      dueDate,
    });
    setStatusTab("incomplete");
    setDurationTab(classifyTimedTaskType(dueDate, todayIso) === TaskType.SHORT_TERM ? "short" : "long");
    if (value.categoryId) {
      setSelectedCategoryId(value.categoryId);
    }
    setFocusDueDateOnOpen(false);
    pushToast("success", "Task created.");
    return null;
  };

  const handleToggleDone = (taskId: string, completed: boolean) => {
    const task = data.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    if (completed && !task.completed) {
      const nowMs = Date.now();
      if (nowMs - completionSoundAtRef.current > 120) {
        completionSoundAtRef.current = nowMs;
        previewCheckboxSound();
      }
    }

    toggleTask(taskId, completed);
  };

  const handleBulkComplete = (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - completionSoundAtRef.current > 120) {
      completionSoundAtRef.current = nowMs;
      previewCheckboxSound();
    }

    bulkCompleteTasks(taskIds, true);
    pushToast("success", `Completed ${taskIds.length} task(s).`);
  };

  const handleBulkReopen = (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }

    bulkCompleteTasks(taskIds, false);
    pushToast("success", `Reopened ${taskIds.length} task(s).`);
  };

  const handleBulkMoveToActive = (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }

    bulkSetTaskLifecycleStatus(taskIds, "active");
    pushToast("success", `Moved ${taskIds.length} task(s) to Active.`);
  };

  const handleBulkMoveToArchive = (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }

    bulkSetTaskLifecycleStatus(taskIds, "archived");
    pushToast("success", `Archived ${taskIds.length} task(s).`);
  };

  const handleBulkDelete = (taskIds: string[]) => {
    if (taskIds.length === 0) {
      return;
    }

    bulkDeleteTasks(taskIds);
    pushToast("success", `Deleted ${taskIds.length} task(s).`);
  };

  const openRescheduleDialog = (task: Task) => {
    setFocusDueDateOnOpen(true);
    setEditingTaskId(task.id);
    setDialogOpen(true);
  };

  const openAddCategoryDialog = () => {
    setCategoryDialogMode("add");
    setCategoryDraft("");
    setCategoryDialogOpen(true);
  };

  const openRenameCategoryDialog = () => {
    if (!activeCategory) {
      return;
    }

    setCategoryDialogMode("rename");
    setCategoryDraft(activeCategory.name);
    setCategoryDialogOpen(true);
  };

  const submitCategoryDialog = () => {
    const trimmed = categoryDraft.trim();
    if (!trimmed) {
      pushToast("error", "Category name cannot be empty.");
      return;
    }

    const duplicate = categories.some((category) => {
      if (categoryDialogMode === "rename" && category.id === activeCategory?.id) {
        return false;
      }

      return category.name.toLowerCase() === trimmed.toLowerCase();
    });

    if (duplicate) {
      pushToast("error", "A category with this name already exists.");
      return;
    }

    if (categoryDialogMode === "add") {
      addTaskCategory(trimmed);
      pushToast("success", `Category "${trimmed}" added.`);
    } else if (activeCategory) {
      renameTaskCategory(activeCategory.id, trimmed);
      pushToast("success", "Category renamed.");
    }

    setCategoryDialogOpen(false);
  };

  const openDeleteDialog = () => {
    if (!activeCategory) {
      return;
    }

    const fallbackTarget = categories.find((category) => category.id !== activeCategory.id)?.id ?? null;
    const linkedTaskCount = data.tasks.filter((task) => task.categoryId === activeCategory.id).length;

    setPendingDeleteCategoryId(activeCategory.id);
    setDeleteTargetCategoryId(fallbackTarget);
    setDeleteStrategy(linkedTaskCount > 0 ? "move" : "delete");
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (!pendingDeleteCategoryId) {
      return;
    }

    if (deleteStrategy === "move" && !deleteTargetCategoryId) {
      pushToast("error", "Select a destination category before deleting.");
      return;
    }

    const result = deleteTaskCategory(pendingDeleteCategoryId, {
      strategy: deleteStrategy,
      targetCategoryId: deleteStrategy === "move" ? (deleteTargetCategoryId ?? undefined) : undefined,
    });

    if (!result.ok) {
      pushToast("error", result.error ?? "Unable to delete category.");
      return;
    }

    pushToast(
      "success",
      deleteStrategy === "move"
        ? "Category deleted and tasks were moved."
        : "Category and its tasks were deleted.",
    );
    setDeleteDialogOpen(false);
    setPendingDeleteCategoryId(null);
  };

  const activeCategoryIndex = categories.findIndex((category) => category.id === activeCategory?.id);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Tasks</CardTitle>
            <Button
              onClick={() => {
                setFocusDueDateOnOpen(false);
                setEditingTaskId(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Future Task
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Dynamic categories are fully editable. Task completion uses global status tabs and each category tracks total study time.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as StatusTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="incomplete">Incomplete Tasks</TabsTrigger>
              <TabsTrigger value="completed">Completed Tasks</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
              {categories.map((category) => {
                const isActive = category.id === selectedCategoryId;
                const totalMinutes = categoryTimeTotals.get(category.id) ?? 0;

                return (
                  <button
                    key={category.id}
                    type="button"
                    draggable
                    onClick={() => setSelectedCategoryId(category.id)}
                    onDragStart={() => setDraggingCategoryId(category.id)}
                    onDragEnd={() => setDraggingCategoryId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggingCategoryId || draggingCategoryId === category.id) {
                        return;
                      }

                      reorderTaskCategory(draggingCategoryId, category.id);
                      setDraggingCategoryId(null);
                    }}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "border-primary/45 bg-primary/10 text-primary"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={`Open ${category.name} tab`}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                    <span className="truncate">{category.name}</span>
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] tabular-nums">
                      {formatTabTime(totalMinutes)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openAddCategoryDialog}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Tab
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="rounded-xl" aria-label="Manage active category tab">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/60">
                  <DropdownMenuItem onClick={openRenameCategoryDialog} disabled={!activeCategory}>
                    Rename Tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openDeleteDialog} disabled={!activeCategory}>
                    Delete Tab
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (activeCategoryIndex <= 0 || !activeCategory) {
                        return;
                      }

                      const target = categories[activeCategoryIndex - 1];
                      if (target) {
                        reorderTaskCategory(activeCategory.id, target.id);
                      }
                    }}
                    disabled={!activeCategory || activeCategoryIndex <= 0}
                  >
                    Move Tab Left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (!activeCategory || activeCategoryIndex < 0 || activeCategoryIndex >= categories.length - 1) {
                        return;
                      }

                      const target = categories[activeCategoryIndex + 1];
                      if (target) {
                        reorderTaskCategory(activeCategory.id, target.id);
                      }
                    }}
                    disabled={!activeCategory || activeCategoryIndex < 0 || activeCategoryIndex >= categories.length - 1}
                  >
                    Move Tab Right
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {activeCategory ? (
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{activeCategory.name}</span>
              {" "}
              total time spent:
              {" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatTabTime(categoryTimeTotals.get(activeCategory.id) ?? 0)}
              </span>
            </div>
          ) : null}

          <Tabs value={durationTab} onValueChange={(value) => setDurationTab(value as DurationTab)}>
            <TabsList className="grid w-full grid-cols-2 sm:max-w-xs">
              <TabsTrigger value="short">Short Term</TabsTrigger>
              <TabsTrigger value="long">Long Term</TabsTrigger>
            </TabsList>
          </Tabs>

          <TaskFilters
            value={filters}
            onChange={setFilters}
            subjects={data.subjects}
            showStatus={false}
            searchInputId="tasks-search-input"
          />

          {message ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
              {message}
            </p>
          ) : null}

          {toast ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${toastToneClass[toast.tone]}`} role="status" aria-live="polite">
              {toast.message}
            </div>
          ) : null}

          {!activeCategory ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
              No categories yet. Create a category tab to start adding tasks.
            </div>
          ) : (
            <motion.div
              key={`${activeCategory.id}:${statusTab}:${durationTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <TaskList
                tasks={visibleTasks}
                subjects={data.subjects}
                todayIso={todayIso}
                onToggleDone={handleToggleDone}
                onEdit={(task) => {
                  setFocusDueDateOnOpen(false);
                  setEditingTaskId(task.id);
                  setDialogOpen(true);
                }}
                onDelete={deleteTask}
                onReschedule={openRescheduleDialog}
                onBulkComplete={handleBulkComplete}
                onBulkReopen={handleBulkReopen}
                onBulkMoveToActive={handleBulkMoveToActive}
                onBulkMoveToArchive={handleBulkMoveToArchive}
                onBulkDelete={handleBulkDelete}
                recentlyMovedTaskId={null}
              />

              {visibleTasks.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No {statusTab} {durationTypeLabel(durationTab).toLowerCase()} tasks in {activeCategory.name} for the current filters.
                </p>
              ) : null}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTaskId(null);
            setFocusDueDateOnOpen(false);
          }
        }}
        subjects={data.subjects}
        categories={customTaskCategories(data.categories)}
        activeCategoryId={selectedCategoryId}
        initialTask={editingTask}
        defaultBucket="daily"
        minDueDate={minFutureDateIso}
        focusDueDateField={focusDueDateOnOpen}
        onSubmit={submitTask}
      />

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialogMode === "add" ? "Add Category Tab" : "Rename Category Tab"}</DialogTitle>
            <DialogDescription>
              Category tabs are user-managed and persist automatically.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
            placeholder="Category name"
            aria-label="Category name"
            autoFocus
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCategoryDialog} disabled={!categoryDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category tab?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how to handle tasks in this tab before deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This tab currently has <span className="font-semibold text-foreground">{pendingDeleteTaskCount}</span> task(s).
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={deleteStrategy === "move" ? "default" : "outline"}
                onClick={() => setDeleteStrategy("move")}
                disabled={alternateCategoryOptions.length === 0}
              >
                Move tasks to another tab
              </Button>
              <Button
                type="button"
                variant={deleteStrategy === "delete" ? "default" : "outline"}
                onClick={() => setDeleteStrategy("delete")}
              >
                Delete tasks with this tab
              </Button>
            </div>

            {deleteStrategy === "move" ? (
              <Select value={deleteTargetCategoryId ?? ""} onValueChange={setDeleteTargetCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose destination tab" />
                </SelectTrigger>
                <SelectContent>
                  {alternateCategoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteCategory();
              }}
            >
              Delete Tab
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
