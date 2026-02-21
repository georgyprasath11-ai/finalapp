import { useMemo, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_SESSION_SECONDS } from "@/lib/study-intelligence";
import { useAppStore } from "@/store/app-store";
import { formatStudyTime } from "@/utils/format";

const toSessionSeconds = (durationMs: number, durationSeconds: number | undefined): number => {
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.max(0, Math.floor(durationSeconds));
  }

  return Math.max(0, Math.floor(durationMs / 1000));
};

const formatStamp = (value: number | undefined, fallbackIso: string): string => {
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

export default function SessionsPage() {
  const { data, deleteSession, updateSessionDuration } = useAppStore();
  const [subjectId, setSubjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const taskMap = useMemo(() => new Map((data?.tasks ?? []).map((task) => [task.id, task])), [data?.tasks]);
  const subjectMap = useMemo(() => new Map((data?.subjects ?? []).map((subject) => [subject.id, subject])), [data?.subjects]);

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
          const taskName = session.taskId ? taskMap.get(session.taskId)?.title ?? "" : "";
          const subjectName = session.subjectId ? subjectMap.get(session.subjectId)?.name ?? "" : "";
          const text = `${taskName} ${subjectName} ${session.reflection}`.toLowerCase();
          if (!text.includes(normalized)) {
            return false;
          }
        }

        return true;
      });
  }, [data, query, subjectId, subjectMap, taskMap]);

  if (!data) {
    return null;
  }

  const startEdit = (sessionId: string, durationSeconds: number) => {
    setEditingSessionId(sessionId);
    setDurationDraft(durationSeconds.toString());
    setError(null);
  };

  const cancelEdit = () => {
    setEditingSessionId(null);
    setDurationDraft("");
    setError(null);
  };

  const saveEdit = (sessionId: string) => {
    const parsed = Number(durationDraft);
    const nextDuration = Math.floor(parsed);

    if (!Number.isFinite(nextDuration) || nextDuration < 0 || nextDuration > MAX_SESSION_SECONDS) {
      setError(`Duration must be between 0 and ${MAX_SESSION_SECONDS} seconds.`);
      return;
    }

    const didUpdate = updateSessionDuration(sessionId, nextDuration);
    if (!didUpdate) {
      setError("Could not update session duration.");
      return;
    }

    cancelEdit();
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
            const taskName = session.taskId ? taskMap.get(session.taskId)?.title ?? "Unknown task" : "No task";
            const subjectName = session.subjectId ? subjectMap.get(session.subjectId)?.name ?? "Unknown" : "Unassigned";
            const seconds = toSessionSeconds(session.durationMs, session.durationSeconds);
            const isActive = session.isActive === true;
            const isEditing = editingSessionId === session.id;

            return (
              <Card key={session.id} className="rounded-2xl border-border/60 bg-card/85 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{taskName}</p>
                        {isActive ? <Badge className="rounded-full bg-primary/20 text-primary">Active</Badge> : null}
                      </div>

                      <p className="text-xs text-muted-foreground">Subject: {subjectName}</p>
                      <p className="text-xs text-muted-foreground">Start: {formatStamp(session.startTime, session.startedAt)}</p>
                      <p className="text-xs text-muted-foreground">End: {isActive ? "In progress" : formatStamp(session.endTime ?? undefined, session.endedAt)}</p>

                      <div className="pt-1 text-sm">
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="h-9 w-40"
                              type="number"
                              min={0}
                              max={MAX_SESSION_SECONDS}
                              value={durationDraft}
                              onChange={(event) => setDurationDraft(event.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">seconds</span>
                            <Button size="sm" className="h-9 rounded-xl" onClick={() => saveEdit(session.id)}>
                              <Check className="h-4 w-4" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="font-medium tabular-nums">Duration: {formatStudyTime(seconds)}</p>
                        )}
                      </div>

                      {session.reflection ? <p className="text-sm text-muted-foreground">{session.reflection}</p> : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        disabled={isActive}
                        onClick={() => startEdit(session.id, seconds)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => deleteSession(session.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}