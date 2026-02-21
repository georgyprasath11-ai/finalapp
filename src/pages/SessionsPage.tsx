import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_SESSION_MINUTES } from "@/lib/study-intelligence";
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
  const { data, deleteSession, updateSessionDuration } = useAppStore();
  const [subjectId, setSubjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [minutesDraft, setMinutesDraft] = useState("");
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
            const seconds = toSessionSeconds(session);
            const status = sessionStatusLabel(session);
            const isEditable = session.isActive !== true && session.status === "completed";

            return (
              <Card key={session.id} className="rounded-2xl border-border/60 bg-card/85 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{taskName}</p>
                        <Badge className="rounded-full bg-primary/20 text-primary">{status}</Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">Subject: {subjectName}</p>
                      <p className="text-xs text-muted-foreground">Start: {formatStamp(session.startTime, session.startedAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        End: {session.status === "completed" ? formatStamp(session.endTime, session.endedAt) : "In progress"}
                      </p>

                      <p className="pt-1 text-sm font-medium tabular-nums">Duration: {formatStudyTime(seconds)}</p>
                      {session.reflection ? <p className="text-sm text-muted-foreground">{session.reflection}</p> : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        disabled={!isEditable}
                        onClick={() => openEditModal(session)}
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