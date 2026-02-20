import { useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubjectDialog } from "@/components/subjects/SubjectDialog";
import { useAppStore } from "@/store/app-store";
import { Subject } from "@/types/models";
import { formatDuration } from "@/utils/format";

export default function SubjectsPage() {
  const { data, addSubject, updateSubject, deleteSubject, tasksForSubject } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

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

  const relatedTasks = selectedSubject ? tasksForSubject(selectedSubject.id) : [];
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
                  Linked Tasks (Daily + Backlog)
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This view intentionally includes backlog tasks for the selected subject.
                </p>
              </div>

              <div className="space-y-2">
                {relatedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks linked to this subject yet.</p>
                ) : (
                  relatedTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            {task.bucket}
                          </Badge>
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
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
    </div>
  );
}
