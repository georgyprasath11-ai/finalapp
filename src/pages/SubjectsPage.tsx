import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { SubjectDialog } from "@/components/subjects/SubjectDialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { recordRecentTaskMove } from "@/lib/task-move-feedback";
import { useDailyTaskStore } from "@/store/daily-task-store";
import { useAppStore } from "@/store/app-store";
import { Subject, Task } from "@/types/models";
import { formatDuration } from "@/utils/format";

type MoveDestination = "shortTerm" | "longTerm" | "daily";

interface ToastState {
  id: number;
  tone: "success" | "error";
  message: string;
}

const toastToneClass: Record<ToastState["tone"], string> = {
  success: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-500/35 bg-rose-500/15 text-rose-100",
};

const moveSuccessMessage = (destination: MoveDestination): string => {
  if (destination === "shortTerm") {
    return "Moved to Short-Term Tasks";
  }

  if (destination === "longTerm") {
    return "Moved to Long-Term Tasks";
  }

  return "Moved to Daily Tasks (time reset)";
};

export default function SubjectsPage() {
  const { data, addSubject, updateSubject, deleteSubject, addSubjectTask, tasksForSubject } = useAppStore();
  const { moveSubjectTask, todayIso } = useDailyTaskStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [movingTaskIds, setMovingTaskIds] = useState<Record<string, true>>({});
  const [leavingTaskId, setLeavingTaskId] = useState<string | null>(null);
  const [pendingDailyMoveTaskId, setPendingDailyMoveTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [subjectTaskTitle, setSubjectTaskTitle] = useState("");

  const lastMoveAttemptRef = useRef<Record<string, number>>({});

  const totalsBySubject = useMemo(() => {
    if (!data) {
      return new Map<string, number>();
    }

    const map = new Map<string, number>();
    data.sessions.forEach((session) => {
      if (!session.subjectId) {
        return;
      }

      map.set(session.subjectId, (map.get(session.subjectId) ?? 0) + session.durationMs);
    });
    return map;
  }, [data]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3_400);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!data) {
    return null;
  }

  const sortedSubjects = [...data.subjects].sort((a, b) => a.name.localeCompare(b.name));
  const selectedSubject = sortedSubjects.find((subject) => subject.id === selectedSubjectId) ?? sortedSubjects[0] ?? null;

  const relatedTasks = selectedSubject ? tasksForSubject(selectedSubject.id) : [];
  const relatedTaskById = new Map(relatedTasks.map((task) => [task.id, task]));
  const pendingDailyMoveTask = pendingDailyMoveTaskId ? relatedTaskById.get(pendingDailyMoveTaskId) ?? null : null;

  const editingSubject = editingSubjectId
    ? sortedSubjects.find((subject) => subject.id === editingSubjectId)
    : undefined;

  const openCreate = () => {
    setEditingSubjectId(null);
    setDialogOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditingSubjectId(subject.id);
    setDialogOpen(true);
  };

  const showToast = (message: string, tone: ToastState["tone"]) => {
    setToast({
      id: Date.now(),
      tone,
      message,
    });
  };

  const handleAddSubjectTask = () => {
    if (!selectedSubject) {
      return;
    }

    const title = subjectTaskTitle.trim();
    if (!title) {
      showToast("Enter a task title first.", "error");
      return;
    }

    addSubjectTask({
      title,
      subjectId: selectedSubject.id,
      priority: "medium",
    });

    setSubjectTaskTitle("");
    showToast("Subject task created. You can move it now.", "success");
  };

  const executeMove = async (task: Task, destination: MoveDestination) => {
    const now = Date.now();
    const previousAttempt = lastMoveAttemptRef.current[task.id] ?? 0;
    if (now - previousAttempt < 500) {
      return;
    }

    if (movingTaskIds[task.id]) {
      return;
    }

    lastMoveAttemptRef.current[task.id] = now;

    setMovingTaskIds((previous) => ({
      ...previous,
      [task.id]: true,
    }));
    setLeavingTaskId(task.id);

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 180);
    });

    const result = moveSubjectTask(task.id, destination, {
      scheduledFor: todayIso,
    });

    if (!result.ok) {
      setLeavingTaskId((current) => (current === task.id ? null : current));
      showToast(result.error ?? "Unable to move task.", "error");
      setMovingTaskIds((previous) => {
        const next = { ...previous };
        delete next[task.id];
        return next;
      });
      return;
    }

    const movedTaskId = destination === "daily"
      ? (result.createdDailyTaskId ?? task.id)
      : (result.movedTaskId ?? task.id);

    recordRecentTaskMove({
      taskId: movedTaskId,
      destination,
      movedAt: Date.now(),
    });

    showToast(moveSuccessMessage(destination), "success");

    setMovingTaskIds((previous) => {
      const next = { ...previous };
      delete next[task.id];
      return next;
    });

    setLeavingTaskId((current) => (current === task.id ? null : current));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Subjects</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create subjects to start timer-linked tracking.</p>
          ) : (
            sortedSubjects.map((subject) => {
              const totalMs = totalsBySubject.get(subject.id) ?? 0;
              const selected = selectedSubject?.id === subject.id;

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(subject.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                        <p className="text-sm font-semibold">{subject.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDuration(totalMs)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(subject);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSubject(subject.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Subject Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedSubject ? (
            <p className="text-sm text-muted-foreground">Select a subject to view tasks and time.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedSubject.color }} />
                <p className="text-lg font-semibold">{selectedSubject.name}</p>
                <Badge variant="secondary" className="rounded-full">
                  <Clock3 className="mr-1 h-3.5 w-3.5" />
                  {formatDuration(totalsBySubject.get(selectedSubject.id) ?? 0)}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subject Tasks
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Move any subject task into Short-Term, Long-Term, or Daily Tasks.
                </p>
              </div>

              <form
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAddSubjectTask();
                }}
              >
                <Input
                  value={subjectTaskTitle}
                  onChange={(event) => setSubjectTaskTitle(event.target.value)}
                  placeholder="Add a subject task"
                  aria-label="New subject task title"
                />
                <Button type="submit" className="sm:min-w-[170px]">
                  Add Subject Task
                </Button>
              </form>

              <div className="space-y-2">
                {relatedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subject tasks available to move.</p>
                ) : (
                  relatedTasks.map((task) => {
                    const moving = movingTaskIds[task.id] === true;
                    const leaving = leavingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border border-border/60 bg-background/70 p-3 transition-all duration-200 ${
                          leaving
                            ? "animate-out fade-out slide-out-to-right-4 duration-200"
                            : "animate-in fade-in"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant="outline" className="rounded-full text-[11px]">
                                {task.priority}
                              </Badge>
                              <Badge variant="outline" className="rounded-full text-[11px]">
                                {task.timeSpent ?? task.totalTimeSpent ?? 0}s tracked
                              </Badge>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={moving}
                                aria-label={`Move ${task.title}`}
                                className="h-8 w-8 rounded-xl"
                              >
                                {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                disabled={moving}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  void executeMove(task, "shortTerm");
                                }}
                              >
                                Move to Short-Term
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={moving}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  void executeMove(task, "longTerm");
                                }}
                              >
                                Move to Long-Term
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={moving}
                                className="text-rose-300 focus:text-rose-100"
                                onSelect={(event) => {
                                  event.preventDefault();
                                  setPendingDailyMoveTaskId(task.id);
                                }}
                              >
                                Move to Daily
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SubjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialSubject={editingSubject}
        onSubmit={(name, color) => {
          if (editingSubject) {
            updateSubject(editingSubject.id, name, color);
          } else {
            addSubject(name, color);
          }
        }}
      />

      <AlertDialog
        open={pendingDailyMoveTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDailyMoveTaskId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Progress?</AlertDialogTitle>
            <AlertDialogDescription>
              Moving this task to Daily Tasks will reset its tracked time and progress. Saved time data may be permanently
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!pendingDailyMoveTask) {
                  setPendingDailyMoveTaskId(null);
                  return;
                }

                setPendingDailyMoveTaskId(null);
                void executeMove(pendingDailyMoveTask, "daily");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50">
          <div className={`rounded-xl border px-4 py-3 text-sm shadow-soft ${toastToneClass[toast.tone]}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}


