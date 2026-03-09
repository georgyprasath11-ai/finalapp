import { FormEvent, useMemo, useState } from "react";
import { FileText, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAppStore } from "@/store/app-store";
import { useNotesStore } from "@/store/zustand";
import { Note } from "@/types/models";
import { dayDiff, toLocalIsoDate } from "@/utils/date";

type SubjectFilter = "all" | string;

interface NoteDraft {
  title: string;
  content: string;
  subjectId: string | null;
}

const emptyDraft: NoteDraft = {
  title: "",
  content: "",
  subjectId: null,
};

const relativeUpdatedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.round(diffMs / minuteMs));
    return `${minutes} min ago`;
  }

  if (diffMs < 24 * hourMs) {
    const hours = Math.max(1, Math.round(diffMs / hourMs));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = dayDiff(toLocalIsoDate(date), toLocalIsoDate(now));
  if (days === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export default function NotesPage() {
  const { data } = useAppStore();
  const notes = useNotesStore((state) => state.notes);
  const addNote = useNotesStore((state) => state.addNote);
  const updateNote = useNotesStore((state) => state.updateNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const subjects = data?.subjects ?? [];
  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );

  const filteredNotes = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return notes.filter((note) => {
      if (subjectFilter !== "all" && note.subjectId !== subjectFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    });
  }, [debouncedSearch, notes, subjectFilter]);

  const pinnedNotes = filteredNotes.filter((note) => note.isPinned);
  const regularNotes = filteredNotes.filter((note) => !note.isPinned);

  const openCreateDialog = () => {
    setEditingNoteId(null);
    setDraft(emptyDraft);
    setIsDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setEditingNoteId(note.id);
    setDraft({
      title: note.title,
      content: note.content,
      subjectId: note.subjectId,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingNoteId(null);
    setDraft(emptyDraft);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      return;
    }

    if (editingNoteId) {
      updateNote(editingNoteId, {
        title,
        content: draft.content,
        subjectId: draft.subjectId,
      });
      closeDialog();
      return;
    }

    addNote({
      title,
      content: draft.content,
      subjectId: draft.subjectId,
    });
    closeDialog();
  };

  return (
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-1.5">
            <label htmlFor="notes-search" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Search
            </label>
            <Input
              id="notes-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or content"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Subject</label>
            <Select value={subjectFilter} onValueChange={(value) => setSubjectFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredNotes.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/70 bg-card/70">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No notes yet. Create your first note.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pinnedNotes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Pinned</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pinnedNotes.map((note) => (
                  <Card
                    key={note.id}
                    className="rounded-[20px] border-border/60 border-t-2 border-t-amber-400/60 bg-card/90"
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{note.title}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Unpin note"
                          onClick={() => updateNote(note.id, { isPinned: false })}
                        >
                          <PinOff className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">{note.content || "No content"}</p>

                      <div className="flex items-center justify-between gap-2">
                        {note.subjectId && subjectMap.has(note.subjectId) ? (
                          <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/65 px-2.5">
                            <span
                              className="mr-2 h-2 w-2 rounded-full"
                              style={{ backgroundColor: subjectMap.get(note.subjectId)?.color }}
                            />
                            {subjectMap.get(note.subjectId)?.name}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <span className="text-xs text-muted-foreground">{relativeUpdatedAt(note.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit note" onClick={() => openEditDialog(note)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete note"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(note)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {regularNotes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {regularNotes.map((note) => (
                  <Card key={note.id} className="rounded-[20px] border-border/60 bg-card/90">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{note.title}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Pin note"
                          onClick={() => updateNote(note.id, { isPinned: true })}
                        >
                          <Pin className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">{note.content || "No content"}</p>

                      <div className="flex items-center justify-between gap-2">
                        {note.subjectId && subjectMap.has(note.subjectId) ? (
                          <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/65 px-2.5">
                            <span
                              className="mr-2 h-2 w-2 rounded-full"
                              style={{ backgroundColor: subjectMap.get(note.subjectId)?.color }}
                            />
                            {subjectMap.get(note.subjectId)?.name}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <span className="text-xs text-muted-foreground">{relativeUpdatedAt(note.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit note" onClick={() => openEditDialog(note)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete note"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(note)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-2xl border-border/70 bg-card/90">
          <DialogHeader>
            <DialogTitle>{editingNoteId ? "Edit Note" : "New Note"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="note-title" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Title
              </label>
              <Input
                id="note-title"
                value={draft.title}
                onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="note-content" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Content
              </label>
              <Textarea
                id="note-content"
                rows={4}
                value={draft.content}
                onChange={(event) => setDraft((previous) => ({ ...previous, content: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Subject</label>
              <Select
                value={draft.subjectId ?? "none"}
                onValueChange={(value) =>
                  setDraft((previous) => ({ ...previous, subjectId: value === "none" ? null : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.title.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }
                deleteNote(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
