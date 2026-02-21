import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveSessionTaskIds } from "@/lib/study-intelligence";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { SessionRating, StudySession } from "@/types/models";
import { formatStudyTime } from "@/utils/format";

const EDIT_MINUTES_MIN = 1;
const EDIT_MINUTES_MAX = 1440;
const REFLECTION_COMMENT_MAX = 300;

const ratingMeta: Record<SessionRating, { label: string; tone: string; badgeTone: string }> = {
  productive: {
    label: "Productive",
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15",
    badgeTone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  average: {
    label: "Average",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:border-amber-300/50 hover:bg-amber-500/15",
    badgeTone: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  distracted: {
    label: "Distracted",
    tone: "border-rose-400/30 bg-rose-500/10 text-rose-200 hover:border-rose-300/50 hover:bg-rose-500/15",
    badgeTone: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  },
};

const toSessionSeconds = (session: StudySession): number => {
  if (typeof session.accumulatedTime === "number" && Number.isFinite(session.accumulatedTime)) {
    return Math.max(0, Math.floor(session.accumulatedTime));
  }

  if (typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds)) {
    return Math.max(0, Math.floor(session.durationSeconds));
  }

  return Math.max(0, Math.floor(session.durationMs / 1000));
};

const formatStamp = (value: number | undefined | null, fallbackIso: string): string => {
  const timestamp = typeof value === "number" && Number.isFinite(value) ? value : Date.parse(fallbackIso);
  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  return new Date(timestamp).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sessionStatusLabel = (session: StudySession): "Running" | "Paused" | "Completed" => {
  if (session.status === "running") {
    return "Running";
  }

  if (session.status === "paused") {
    return "Paused";
  }

  return "Completed";
};

export default function SessionsPage() {
  const {
    data,
    deleteSession,
    updateSessionDuration,
    continueSession,
    continueSessionWithTask,
    saveSessionReflection,
  } = useAppStore();
  const navigate = useNavigate();

  const [subjectId, setSubjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [minutesDraft, setMinutesDraft] = useState("");
  const [continuePickerSessionId, setContinuePickerSessionId] = useState<string | null>(null);
  const [continueTaskDraft, setContinueTaskDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [reflectionSessionId, setReflectionSessionId] = useState<string | null>(null);
  const [reflectionRatingDraft, setReflectionRatingDraft] = useState<SessionRating | null>(null);
  const [reflectionCommentDraft, setReflectionCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimeoutRef = useRef<number | null>(null);
  const forceCloseEditTimeoutRef = useRef<number | null>(null);

  const taskMap = useMemo(() => new Map((data?.tasks ?? []).map((task) => [task.id, task])), [data?.tasks]);
  const subjectMap = useMemo(() => new Map((data?.subjects ?? []).map((subject) => [subject.id, subject])), [data?.subjects]);
  const openTasks = useMemo(
    () =>
      (data?.tasks ?? [])
        .filter((task) => !task.completed)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [data?.tasks],
  );

  const liveSession = useMemo(
    () => (data?.sessions ?? []).find((session) => session.isActive === true && (session.status === "running" || session.status === "paused")) ?? null,
    [data?.sessions],
  );

  const sessionTaskLabel = useCallback(
    (session: StudySession): string => {
      const taskIds = resolveSessionTaskIds(session);
      if (taskIds.length === 0) {
        return "No task";
      }

      return taskIds
        .map((taskId) => {
          const task = taskMap.get(taskId);
          const taskTitle = task?.title ?? "Unknown task";
          const taskSubjectId = task?.subjectId ?? session.subjectId;
          const subjectName = taskSubjectId ? subjectMap.get(taskSubjectId)?.name ?? "Unknown" : "Unassigned";
          return `${subjectName}: ${taskTitle}`;
        })
        .join(" + ");
    },
    [subjectMap, taskMap],
  );

  const sessions = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalized = query.trim().toLowerCase();

    return [...data.sessions]
      .sort((a, b) => {
        const aTime =
          (typeof a.endTime === "number" ? a.endTime : undefined) ??
          (typeof a.startTime === "number" ? a.startTime : undefined) ??
          Date.parse(a.endedAt);
        const bTime =
          (typeof b.endTime === "number" ? b.endTime : undefined) ??
          (typeof b.startTime === "number" ? b.startTime : undefined) ??
          Date.parse(b.endedAt);
        return bTime - aTime;
      })
      .filter((session) => {
        if (subjectId !== "all") {
          if (subjectId === "none" && session.subjectId !== null) {
            return false;
          }

          if (subjectId !== "none" && session.subjectId !== subjectId) {
            return false;
          }
        }

        if (normalized.length > 0) {
          const taskText = sessionTaskLabel(session);
          const subjectName = session.subjectId ? subjectMap.get(session.subjectId)?.name ?? "" : "";
          const reflectionText = (session.reflectionComment ?? session.reflection ?? "").toLowerCase();
          const text = `${taskText} ${subjectName} ${reflectionText}`.toLowerCase();
          if (!text.includes(normalized)) {
            return false;
          }
        }

        return true;
      });
  }, [data, query, sessionTaskLabel, subjectId, subjectMap]);

  const editingSession = useMemo(
    () => sessions.find((session) => session.id === editingSessionId) ?? null,
    [editingSessionId, sessions],
  );

  const reflectionSession = useMemo(
    () => sessions.find((session) => session.id === reflectionSessionId) ?? null,
    [reflectionSessionId, sessions],
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (forceCloseEditTimeoutRef.current !== null) {
        window.clearTimeout(forceCloseEditTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1800);
  };

  if (!data) {
    return null;
  }

  const closeEditModal = () => {
    setEditingSessionId(null);
    setMinutesDraft("");
    setIsSavingEdit(false);
    setError(null);
  };

  const openEditModal = (session: StudySession) => {
    if (session.isActive === true || session.status !== "completed") {
      setError("Only completed sessions can be edited.");
      return;
    }

    const minutes = Math.max(1, Math.round(toSessionSeconds(session) / 60));
    setEditingSessionId(session.id);
    setMinutesDraft(minutes.toString());
    setError(null);
  };

  const routeToDashboard = () => {
    window.requestAnimationFrame(() => {
      navigate("/dashboard");
    });
  };

  const saveEdit = async () => {
    if (!editingSession || isSavingEdit) {
      return;
    }

    const trimmed = minutesDraft.trim();
    if (!trimmed) {
      setError("Please enter time in whole minutes.");
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError("Please enter time in whole minutes.");
      return;
    }

    if (parsed < EDIT_MINUTES_MIN || parsed > EDIT_MINUTES_MAX) {
      setError(`Time (minutes) must be between ${EDIT_MINUTES_MIN} and ${EDIT_MINUTES_MAX}.`);
      return;
    }

    const nextMinutes = Math.max(EDIT_MINUTES_MIN, Math.min(EDIT_MINUTES_MAX, parsed));
    const nextSeconds = nextMinutes * 60;

    setIsSavingEdit(true);
    setError(null);

    const didUpdate = await Promise.resolve(updateSessionDuration(editingSession.id, nextSeconds));
    if (!didUpdate) {
      setIsSavingEdit(false);
      setError("Could not update session duration.");
      return;
    }

    closeEditModal();

    if (forceCloseEditTimeoutRef.current !== null) {
      window.clearTimeout(forceCloseEditTimeoutRef.current);
    }
    forceCloseEditTimeoutRef.current = window.setTimeout(() => {
      setEditingSessionId(null);
      forceCloseEditTimeoutRef.current = null;
    }, 300);

    showToast("Session time updated successfully");
  };

  const handleContinue = (session: StudySession) => {
    if (liveSession) {
      setError(null);
      setContinuePickerSessionId(null);
      setContinueTaskDraft("");
      routeToDashboard();
      return;
    }

    const taskIds = resolveSessionTaskIds(session);
    if (taskIds.length === 0) {
      setError("Only task-linked sessions can be continued.");
      return;
    }

    const didContinue = continueSession(session.id);
    if (!didContinue) {
      setError("No active session to continue right now.");
      return;
    }

    setError(null);
    setContinuePickerSessionId(null);
    setContinueTaskDraft("");
    if (editingSessionId === session.id) {
      closeEditModal();
    }
    routeToDashboard();
  };

  const beginContinueWithNewTask = (session: StudySession) => {
    const taskIds = resolveSessionTaskIds(session);
    if (!liveSession && taskIds.length === 0) {
      setError("Only task-linked sessions can be continued.");
      return;
    }

    setContinuePickerSessionId(session.id);
    setContinueTaskDraft("");
    setError(null);
  };

  const confirmContinueWithNewTask = (session: StudySession) => {
    if (!continueTaskDraft) {
      setError("Pick a task to continue this session.");
      return;
    }

    const didContinue = continueSessionWithTask(session.id, continueTaskDraft);
    if (!didContinue) {
      setError("No active session to continue right now.");
      return;
    }

    setError(null);
    setContinuePickerSessionId(null);
    setContinueTaskDraft("");
    if (editingSessionId === session.id) {
      closeEditModal();
    }
    routeToDashboard();
  };

  const openReflectionModal = (session: StudySession) => {
    if (session.status !== "completed" || session.isActive === true) {
      setError("Stop the session before adding a reflection.");
      return;
    }

    const existingRating = session.reflectionRating ?? session.rating;
    const existingComment = (session.reflectionComment ?? session.reflection ?? "").slice(0, REFLECTION_COMMENT_MAX);

    setReflectionSessionId(session.id);
    setReflectionRatingDraft(existingRating);
    setReflectionCommentDraft(existingComment);
    setError(null);
  };

  const closeReflectionModal = () => {
    setReflectionSessionId(null);
    setReflectionRatingDraft(null);
    setReflectionCommentDraft("");
  };

  const saveReflection = () => {
    if (!reflectionSession || !reflectionRatingDraft) {
      setError("Choose a session rating before saving.");
      return;
    }

    saveSessionReflection(reflectionSession.id, reflectionRatingDraft, reflectionCommentDraft.slice(0, REFLECTION_COMMENT_MAX));
    closeReflectionModal();
    setError(null);
    showToast("Reflection saved");
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_170px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by task, subject, or reflection"
            />
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                <SelectItem value="none">No subject</SelectItem>
                {data.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
              {sessions.length} sessions
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
              No sessions match your filters yet.
            </p>
          ) : (
            sessions.map((session) => {
              const taskLabel = sessionTaskLabel(session);
              const seconds = toSessionSeconds(session);
              const status = sessionStatusLabel(session);
              const taskIds = resolveSessionTaskIds(session);
              const isEditable = session.isActive !== true && session.status === "completed";
              const isContinuable = liveSession !== null || (session.status === "completed" && taskIds.length > 0);
              const reflectionRating = session.reflectionRating ?? session.rating;
              const reflectionComment = (session.reflectionComment ?? session.reflection ?? "").trim();

              return (
                <Card
                  key={session.id}
                  className="rounded-2xl border-border/60 bg-card/85 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-medium"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold leading-relaxed">{taskLabel}</p>
                          <Badge className="rounded-full bg-primary/20 text-primary">{status}</Badge>
                          {reflectionRating ? (
                            <Badge className={cn("rounded-full border px-2.5 py-0.5", ratingMeta[reflectionRating].badgeTone)}>
                              {ratingMeta[reflectionRating].label}
                            </Badge>
                          ) : null}
                          {reflectionComment ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-help rounded-full border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                                  Note
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs whitespace-pre-wrap text-xs leading-relaxed">
                                {reflectionComment}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>

                        <p className="pt-1 text-sm font-medium tabular-nums">Total session time: {formatStudyTime(seconds)}</p>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Start: {formatStamp(session.startTime, session.startedAt)}</p>
                          <p>End: {session.status === "completed" ? formatStamp(session.endTime, session.endedAt) : "In progress"}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-xl transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-95"
                            onClick={() => handleContinue(session)}
                            disabled={!isContinuable}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Continue
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-xl transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-95"
                            onClick={() => beginContinueWithNewTask(session)}
                            disabled={!isContinuable}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Continue with New Task
                          </Button>
                          {!reflectionRating && session.status === "completed" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-xl border border-border/60 bg-background/60 px-3"
                              onClick={() => openReflectionModal(session)}
                            >
                              Add Reflection
                            </Button>
                          ) : null}
                        </div>

                        {continuePickerSessionId === session.id ? (
                          <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
                            <Label htmlFor={`continue-task-${session.id}`} className="text-xs text-muted-foreground">
                              Pick task to append
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <Select value={continueTaskDraft} onValueChange={setContinueTaskDraft}>
                                <SelectTrigger id={`continue-task-${session.id}`} className="h-10 rounded-xl border-border/60 bg-background/80 sm:flex-1">
                                  <SelectValue placeholder="Choose task" />
                                </SelectTrigger>
                                <SelectContent>
                                  {openTasks.map((task) => {
                                    const subjectName = task.subjectId ? subjectMap.get(task.subjectId)?.name ?? "Unknown" : "Unassigned";
                                    return (
                                      <SelectItem key={task.id} value={task.id}>
                                        {subjectName}: {task.title}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button size="sm" className="h-10 rounded-xl" onClick={() => confirmContinueWithNewTask(session)}>
                                  Continue
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-10 rounded-xl"
                                  onClick={() => {
                                    setContinuePickerSessionId(null);
                                    setContinueTaskDraft("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl border-border/60">
                          <DropdownMenuItem
                            disabled={!isEditable}
                            onSelect={(event) => {
                              event.preventDefault();
                              if (isEditable) {
                                openEditModal(session);
                              }
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={session.status !== "completed"}
                            onSelect={(event) => {
                              event.preventDefault();
                              if (session.status === "completed") {
                                openReflectionModal(session);
                              }
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Reflection
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => deleteSession(session.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={editingSession !== null} onOpenChange={(open) => (open ? undefined : closeEditModal())}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Edit Session</DialogTitle>
              <DialogDescription>Update completed session duration in minutes. Internal storage remains in seconds.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="session-minutes">Time (minutes)</Label>
              <Input
                id="session-minutes"
                type="number"
                inputMode="numeric"
                step={1}
                min={EDIT_MINUTES_MIN}
                max={EDIT_MINUTES_MAX}
                value={minutesDraft}
                onKeyDown={(event) => {
                  if (["e", "E", "+", "-", "."].includes(event.key)) {
                    event.preventDefault();
                  }
                }}
                onChange={(event) => {
                  setMinutesDraft(event.target.value);
                  setError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">Enter whole minutes between {EDIT_MINUTES_MIN} and {EDIT_MINUTES_MAX}.</p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={closeEditModal} disabled={isSavingEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reflectionSession !== null} onOpenChange={(open) => (open ? undefined : closeReflectionModal())}>
          <DialogContent className="rounded-3xl border-border/70 bg-card/95 p-0 shadow-medium sm:max-w-[540px]">
            <div className="space-y-5 p-6 sm:p-7">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-2xl font-semibold">How was this session?</DialogTitle>
                <DialogDescription>Your reflection helps improve your analytics.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {(Object.keys(ratingMeta) as SessionRating[]).map((rating) => {
                  const selected = reflectionRatingDraft === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setReflectionRatingDraft(rating)}
                      className={cn(
                        "min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all duration-150 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        ratingMeta[rating].tone,
                        selected && "scale-[1.03] shadow-[0_0_0_1px_hsl(var(--ring)/0.35),0_10px_24px_hsl(var(--foreground)/0.16)]",
                      )}
                    >
                      {ratingMeta[rating].label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="session-reflection-note" className="text-sm font-medium text-muted-foreground">
                    Add a note (optional)
                  </label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {reflectionCommentDraft.length}/{REFLECTION_COMMENT_MAX}
                  </span>
                </div>
                <textarea
                  id="session-reflection-note"
                  value={reflectionCommentDraft}
                  maxLength={REFLECTION_COMMENT_MAX}
                  onChange={(event) => setReflectionCommentDraft(event.target.value.slice(0, REFLECTION_COMMENT_MAX))}
                  placeholder="What went well? What distracted you?"
                  className="min-h-[108px] w-full resize-none rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5 text-sm leading-6 outline-none transition-colors duration-200 focus:border-ring"
                />
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="ghost" className="h-11 rounded-xl px-5" onClick={closeReflectionModal}>
                  Skip
                </Button>
                <Button className="h-11 rounded-xl px-5" onClick={saveReflection} disabled={!reflectionRatingDraft}>
                  Save Reflection
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {toastMessage ? (
          <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-xl border border-border/70 bg-card/95 px-4 py-2 text-sm shadow-medium motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
            {toastMessage}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}