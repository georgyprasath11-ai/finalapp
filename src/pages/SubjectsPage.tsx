import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { SubjectDialog } from "@/components/subjects/SubjectDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { progressColor } from "@/lib/progress-color";
import { useAppStore } from "@/store/app-store";
import { Subject, Task } from "@/types/models";
import { formatDuration } from "@/utils/format";

export default function SubjectsPage() {
  const { data, addSubject, updateSubject, deleteSubject, tasksForSubject } = useAppStore();
  const reduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] } },
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<"all" | "pending" | "completed">("all");

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

  if (!data) {
    return null;
  }

  const sortedSubjects = [...data.subjects].sort((a, b) => a.name.localeCompare(b.name));
  const selectedSubject = sortedSubjects.find((subject) => subject.id === selectedSubjectId) ?? sortedSubjects[0] ?? null;

  useEffect(() => {
    setSubjectFilter("all");
  }, [selectedSubjectId]);

  const relatedTasks = selectedSubject ? tasksForSubject(selectedSubject.id) : [];
  const filteredTasks = useMemo(() => {
    if (subjectFilter === "pending") return relatedTasks.filter((t) => !t.completed);
    if (subjectFilter === "completed") return relatedTasks.filter((t) => t.completed);
    return relatedTasks;
  }, [relatedTasks, subjectFilter]);
  const taskGroups = useMemo(() => {
    const groups: Record<string, { label: string; tasks: Task[] }> = {
      shortTerm: { label: "Short-Term Tasks", tasks: [] },
      longTerm: { label: "Long-Term Tasks", tasks: [] },
      other: { label: "Other Tasks", tasks: [] },
    };

    for (const task of filteredTasks) {
      if (task.category === "shortTerm") {
        groups.shortTerm.tasks.push(task);
      } else if (task.category === "longTerm") {
        groups.longTerm.tasks.push(task);
      } else {
        // Tasks with category "subject" (legacy) fall through to "other"
        groups.other.tasks.push(task);
      }
    }

    // Only return groups that have at least one task
    return Object.values(groups).filter((group) => group.tasks.length > 0);
  }, [filteredTasks]);

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

  return (
    <div className="relative">
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
            >
              <div className="rounded-2xl bg-muted/60 p-4">
                <Clock3 className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Create subjects to start timer-linked tracking.</p>
              <p className="text-xs text-muted-foreground/70">Add a subject to organize sessions and tasks.</p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
              {sortedSubjects.map((subject) => {
                const totalMs = totalsBySubject.get(subject.id) ?? 0;
                const selected = selectedSubject?.id === subject.id;

                return (
                  <motion.button
                    key={subject.id}
                    type="button"
                    variants={itemVariants}
                    onClick={() => {
                      setSelectedSubjectId(subject.id);
                      setMobileDetailOpen(true);
                    }}
                    className={`subject-card group w-full rounded-xl border p-3 text-left transition ${selected ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/70"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                            <span className="absolute h-4 w-4 rounded-full opacity-0 group-hover:opacity-100 motion-safe:animate-pulse-glow" />
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                          </span>
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
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <div className="hidden lg:block">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Subject Detail</CardTitle>
            {selectedSubject && (
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                {selectedSubject.name}
              </span>
            )}
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
            {!selectedSubject ? (
              <motion.div
                key="empty-subject"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
              >
                <div className="rounded-2xl bg-muted/60 p-4">
                  <Clock3 className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Select a subject to view tasks and time.</p>
                <p className="text-xs text-muted-foreground/70">Pick a subject from the left to manage tasks.</p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedSubject.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: "hidden" }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedSubject.color }} />
                  <p className="text-lg font-semibold">{selectedSubject.name}</p>
                  <Badge variant="secondary" className="rounded-full">
                    <Clock3 className="mr-1 h-3.5 w-3.5" />
                    {formatDuration(totalsBySubject.get(selectedSubject.id) ?? 0)}
                  </Badge>
                </div>

                {/* Summary bar */}
                <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{relatedTasks.length}</span> task{relatedTasks.length !== 1 ? "s" : ""} total
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-emerald-400">
                      {relatedTasks.filter((t) => t.completed).length}
                    </span>{" "}
                    completed
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {relatedTasks.filter((t) => !t.completed).length}
                    </span>{" "}
                    pending
                  </span>
                </div>

                {relatedTasks.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={subjectFilter === "all" ? "default" : "outline"}
                      onClick={() => setSubjectFilter("all")}
                      className="rounded-full text-xs h-7 px-3"
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant={subjectFilter === "pending" ? "default" : "outline"}
                      onClick={() => setSubjectFilter("pending")}
                      className="rounded-full text-xs h-7 px-3"
                    >
                      Pending
                    </Button>
                    <Button
                      size="sm"
                      variant={subjectFilter === "completed" ? "default" : "outline"}
                      onClick={() => setSubjectFilter("completed")}
                      className="rounded-full text-xs h-7 px-3"
                    >
                      Completed
                    </Button>
                  </div>
                )}

                {/* Progress bar */}
                {relatedTasks.length > 0 ? (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
                      {(() => {
                        const completedCount = relatedTasks.filter((t) => t.completed).length;
                        const pct = relatedTasks.length > 0
                          ? Math.round((completedCount / relatedTasks.length) * 100)
                          : 0;
                        return (
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: progressColor(pct),
                              transition: "width 0.5s ease, background-color 0.3s ease",
                            }}
                          />
                        );
                      })()}
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {(() => {
                        const completedCount = relatedTasks.filter((t) => t.completed).length;
                        return relatedTasks.length > 0
                          ? `${Math.round((completedCount / relatedTasks.length) * 100)}% complete`
                          : "0% complete";
                      })()}
                    </p>
                  </div>
                ) : null}

                {/* Grouped task list or empty state */}
                {relatedTasks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.35 }}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
                  >
                    <div className="rounded-2xl bg-muted/60 p-4">
                      <Clock3 className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No tasks linked to this subject.</p>
                    <p className="text-xs text-muted-foreground/70">
                      Tasks assigned to this subject from any list will appear here.
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-5">
                    {taskGroups.map((group) => (
                      <div key={group.label} className="space-y-2">
                        {/* Section heading */}
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {group.label}
                          <span className="ml-2 font-normal normal-case tracking-normal">
                            ({group.tasks.filter((t) => t.completed).length}/{group.tasks.length})
                          </span>
                        </p>

                        <AnimatePresence initial={false}>
                          {group.tasks.map((task) => {
                            const trackedMs = ((task.timeSpent ?? 0) + (task.totalTimeSpent ?? 0)) * 1000;
                            // Note: timeSpent and totalTimeSpent are in seconds; formatDuration expects ms

                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                                className="rounded-xl border border-border/60 bg-background/70 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-sm font-medium leading-snug ${
                                        task.completed ? "text-muted-foreground line-through" : ""
                                      }`}
                                    >
                                      {task.title}
                                    </p>

                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {/* Priority badge */}
                                      <Badge
                                        variant="outline"
                                        className={`rounded-full text-[11px] ${
                                          task.priority === "high"
                                            ? "border-rose-500/40 text-rose-300"
                                            : task.priority === "medium"
                                            ? "border-amber-500/40 text-amber-300"
                                            : "border-border/60 text-muted-foreground"
                                        }`}
                                      >
                                        {task.priority}
                                      </Badge>

                                      {/* Completion status badge */}
                                      <Badge
                                        variant="outline"
                                        className={`rounded-full text-[11px] ${
                                          task.completed
                                            ? "border-emerald-500/40 text-emerald-300"
                                            : "border-border/60 text-muted-foreground"
                                        }`}
                                      >
                                        {task.completed ? "Done" : "In Progress"}
                                      </Badge>

                                      {/* Tracked time badge - only show if time > 0 */}
                                      {trackedMs > 0 ? (
                                        <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                                          <Clock3 className="mr-1 h-3 w-3" />
                                          {formatDuration(trackedMs)}
                                        </Badge>
                                      ) : null}

                                      {/* Due date badge - only show if present */}
                                      {task.dueDate ? (
                                        <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                                          Due {task.dueDate}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* MOBILE DETAIL OVERLAY - only shown on < lg screens when a subject is selected */}
      <AnimatePresence>
        {mobileDetailOpen && selectedSubject && (
          <motion.div
            key="mobile-subject-detail"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-10 lg:hidden"
          >
            <Card className="h-full rounded-2xl border-border/70 bg-card/85 shadow-soft overflow-auto">
              <CardHeader className="flex flex-row items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label="Back to subjects"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-base">Subject Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {!selectedSubject ? (
                    <motion.div
                      key="empty-subject"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: reduceMotion ? 0 : 0.25 }}
                      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
                    >
                      <div className="rounded-2xl bg-muted/60 p-4">
                        <Clock3 className="h-8 w-8 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Select a subject to view tasks and time.</p>
                      <p className="text-xs text-muted-foreground/70">Pick a subject from the left to manage tasks.</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={selectedSubject.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden" }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedSubject.color }} />
                        <p className="text-lg font-semibold">{selectedSubject.name}</p>
                        <Badge variant="secondary" className="rounded-full">
                          <Clock3 className="mr-1 h-3.5 w-3.5" />
                          {formatDuration(totalsBySubject.get(selectedSubject.id) ?? 0)}
                        </Badge>
                      </div>

                      {/* Summary bar */}
                      <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{relatedTasks.length}</span> task{relatedTasks.length !== 1 ? "s" : ""} total
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-emerald-400">
                            {relatedTasks.filter((t) => t.completed).length}
                          </span>{" "}
                          completed
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {relatedTasks.filter((t) => !t.completed).length}
                          </span>{" "}
                          pending
                        </span>
                      </div>

                      {relatedTasks.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant={subjectFilter === "all" ? "default" : "outline"}
                            onClick={() => setSubjectFilter("all")}
                            className="rounded-full text-xs h-7 px-3"
                          >
                            All
                          </Button>
                          <Button
                            size="sm"
                            variant={subjectFilter === "pending" ? "default" : "outline"}
                            onClick={() => setSubjectFilter("pending")}
                            className="rounded-full text-xs h-7 px-3"
                          >
                            Pending
                          </Button>
                          <Button
                            size="sm"
                            variant={subjectFilter === "completed" ? "default" : "outline"}
                            onClick={() => setSubjectFilter("completed")}
                            className="rounded-full text-xs h-7 px-3"
                          >
                            Completed
                          </Button>
                        </div>
                      )}

                      {/* Progress bar */}
                      {relatedTasks.length > 0 ? (
                        <div className="space-y-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
                            {(() => {
                              const completedCount = relatedTasks.filter((t) => t.completed).length;
                              const pct = relatedTasks.length > 0
                                ? Math.round((completedCount / relatedTasks.length) * 100)
                                : 0;
                              return (
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: progressColor(pct),
                                    transition: "width 0.5s ease, background-color 0.3s ease",
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <p className="text-right text-xs text-muted-foreground">
                            {(() => {
                              const completedCount = relatedTasks.filter((t) => t.completed).length;
                              return relatedTasks.length > 0
                                ? `${Math.round((completedCount / relatedTasks.length) * 100)}% complete`
                                : "0% complete";
                            })()}
                          </p>
                        </div>
                      ) : null}

                      {/* Grouped task list or empty state */}
                      {relatedTasks.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: reduceMotion ? 0 : 0.35 }}
                          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
                        >
                          <div className="rounded-2xl bg-muted/60 p-4">
                            <Clock3 className="h-8 w-8 text-muted-foreground/60" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No tasks linked to this subject.</p>
                          <p className="text-xs text-muted-foreground/70">
                            Tasks assigned to this subject from any list will appear here.
                          </p>
                        </motion.div>
                      ) : (
                        <div className="space-y-5">
                          {taskGroups.map((group) => (
                            <div key={group.label} className="space-y-2">
                              {/* Section heading */}
                              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {group.label}
                                <span className="ml-2 font-normal normal-case tracking-normal">
                                  ({group.tasks.filter((t) => t.completed).length}/{group.tasks.length})
                                </span>
                              </p>

                              <AnimatePresence initial={false}>
                                {group.tasks.map((task) => {
                                  const trackedMs = ((task.timeSpent ?? 0) + (task.totalTimeSpent ?? 0)) * 1000;
                                  // Note: timeSpent and totalTimeSpent are in seconds; formatDuration expects ms

                                  return (
                                    <motion.div
                                      key={task.id}
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -8 }}
                                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                                      className="rounded-xl border border-border/60 bg-background/70 p-3"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className={`text-sm font-medium leading-snug ${
                                              task.completed ? "text-muted-foreground line-through" : ""
                                            }`}
                                          >
                                            {task.title}
                                          </p>

                                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {/* Priority badge */}
                                            <Badge
                                              variant="outline"
                                              className={`rounded-full text-[11px] ${
                                                task.priority === "high"
                                                  ? "border-rose-500/40 text-rose-300"
                                                  : task.priority === "medium"
                                                  ? "border-amber-500/40 text-amber-300"
                                                  : "border-border/60 text-muted-foreground"
                                              }`}
                                            >
                                              {task.priority}
                                            </Badge>

                                            {/* Completion status badge */}
                                            <Badge
                                              variant="outline"
                                              className={`rounded-full text-[11px] ${
                                                task.completed
                                                  ? "border-emerald-500/40 text-emerald-300"
                                                  : "border-border/60 text-muted-foreground"
                                              }`}
                                            >
                                              {task.completed ? "Done" : "In Progress"}
                                            </Badge>

                                            {/* Tracked time badge - only show if time > 0 */}
                                            {trackedMs > 0 ? (
                                              <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                                                <Clock3 className="mr-1 h-3 w-3" />
                                                {formatDuration(trackedMs)}
                                              </Badge>
                                            ) : null}

                                            {/* Due date badge - only show if present */}
                                            {task.dueDate ? (
                                              <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                                                Due {task.dueDate}
                                              </Badge>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject Dialog (unchanged position) */}
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
    </div>
  );
}


