import { useCallback, useMemo, useState } from "react";
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
import { MAX_SESSION_MINUTES, resolveSessionTaskIds } from "@/lib/study-intelligence";
import { useAppStore } from "@/store/app-store";
import { StudySession } from "@/types/models";
import { formatStudyTime } from "@/utils/format";

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
  const { data, deleteSession, updateSessionDuration, continueSession, continueSessionWithTask } = useAppStore();
  const [subjectId, setSubjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [minutesDraft, setMinutesDraft] = useState("");
  const [continuePickerSessionId, setContinuePickerSessionId] = useState<string | null>(null);
  const [continueTaskDraft, setContinueTaskDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const taskMap = useMemo(() => new Map((data?.tasks ?? []).map((task) => [task.id, task])), [data?.tasks]);
  const subjectMap = useMemo(() => new Map((data?.subjects ?? []).map((subject) => [subject.id, subject])), [data?.subjects]);
  const openTasks = useMemo(
    () =>
      (data?.tasks ?? [])
        .filter((task) => !task.completed)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [data?.tasks],
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
          const text = `${taskText} ${subjectName} ${session.reflection}`.toLowerCase();
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

  if (!data) {
    return null;
  }

  const openEditModal = (session: StudySession) => {
    if (session.isActive === true || session.status !== "completed") {
      setError("Only completed sessions can be edited.");
      return;
    }

    const minutes = Math.round(toSessionSeconds(session) / 60);
    setEditingSessionId(session.id);
    setMinutesDraft(minutes.toString());
    setError(null);
  };

  const closeEditModal = () => {
    setEditingSessionId(null);
    setMinutesDraft("");
    setError(null);
  };

  const saveEdit = () => {
    if (!editingSession) {
      return;
    }

    if (minutesDraft.trim().length === 0) {
      setError("Duration (minutes) is required.");
      return;
    }

    const parsed = Number(minutesDraft);
    if (!Number.isFinite(parsed)) {
      setError("Duration (minutes) must be a valid number.");
      return;
    }

    if (parsed < 0) {
      setError("Duration (minutes) cannot be negative.");
      return;
    }

    const normalizedMinutes = Math.min(MAX_SESSION_MINUTES, Math.floor(parsed));
    const nextSeconds = normalizedMinutes * 60;

    const didUpdate = updateSessionDuration(editingSession.id, nextSeconds);
    if (!didUpdate) {
      setError("Could not update session duration.");
      return;
    }

    closeEditModal();
  };

  const handleContinue = (session: StudySession) => {
    const taskIds = resolveSessionTaskIds(session);
    if (taskIds.length === 0) {
      setError("Only task-linked sessions can be continued.");
      return;
    }

    const didContinue = continueSession(session.id);
    if (!didContinue) {
      setError("Could not continue this session.");
      return;
    }

    setError(null);
    setContinuePickerSessionId(null);
    setContinueTaskDraft("");
    if (editingSessionId === session.id) {
      closeEditModal();
    }
  };

  const beginContinueWithNewTask = (session: StudySession) => {
    const taskIds = resolveSessionTaskIds(session);
    if (taskIds.length === 0) {
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
      setError("Could not continue this session with the selected task.");
      return;
    }

    setError(null);
    setContinuePickerSessionId(null);
    setContinueTaskDraft("");
    if (editingSessionId === session.id) {
      closeEditModal();
    }
  };

  return (
    <div className="space-y-6">
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
            const isContinuable = session.status === "completed" && taskIds.length > 0;

            return (
              <Card key={session.id} className="rounded-2xl border-border/60 bg-card/85 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-relaxed">{taskLabel}</p>
                        <Badge className="rounded-full bg-primary/20 text-primary">{status}</Badge>
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
                          className="h-8 rounded-xl"
                          onClick={() => handleContinue(session)}
                          disabled={!isContinuable}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Continue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl"
                          onClick={() => beginContinueWithNewTask(session)}
                          disabled={!isContinuable}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Continue with New Task
                        </Button>
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

                      {session.reflection ? <p className="text-sm text-muted-foreground">{session.reflection}</p> : null}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 rounded-xl border-border/60">
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
            <Label htmlFor="session-minutes">Duration (minutes)</Label>
            <Input
              id="session-minutes"
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              max={MAX_SESSION_MINUTES}
              value={minutesDraft}
              onChange={(event) => {
                setMinutesDraft(event.target.value);
                setError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">Maximum: {MAX_SESSION_MINUTES} minutes</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
