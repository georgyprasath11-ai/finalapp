import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { formatDuration } from "@/utils/format";

export default function SessionsPage() {
  const { data, deleteSession } = useAppStore();
  const [subjectId, setSubjectId] = useState("all");
  const [query, setQuery] = useState("");

  const sessions = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalized = query.trim().toLowerCase();

    return [...data.sessions]
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
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
          const text = `${session.reflection}`.toLowerCase();
          if (!text.includes(normalized)) {
            return false;
          }
        }

        return true;
      });
  }, [data, query, subjectId]);

  if (!data) {
    return null;
  }

  const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]));

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Session History</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reflections" />
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

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
            No sessions match your filters yet.
          </p>
        ) : (
          sessions.map((session) => {
            const subjectName = session.subjectId ? subjectMap.get(session.subjectId)?.name ?? "Unknown" : "Unassigned";
            const ended = new Date(session.endedAt);

            return (
              <Card key={session.id} className="rounded-2xl border-border/60 bg-card/85 shadow-soft">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{subjectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {ended.toLocaleDateString()} at {ended.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-1 text-sm">{formatDuration(session.durationMs)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Rating: {session.rating ?? "not set"}</p>
                      {session.reflection ? <p className="mt-2 text-sm text-muted-foreground">{session.reflection}</p> : null}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteSession(session.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
