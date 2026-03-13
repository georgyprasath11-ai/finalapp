import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskPriority } from "@/types/models";

export interface BulkConfirmPayload {
  priority: TaskPriority;
  scheduledFor: string;
  bucket: "daily" | "backlog";
  subjectId: string | null;
  dueDate: string | null;
}

export interface BulkAddTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (titles: string[], shared: BulkConfirmPayload) => void;
  mode: "daily" | "timed";
  todayIso: string;
  subjects?: Array<{ id: string; name: string; color: string }>;
  categories?: Array<{ id: string; name: string }>;
}

const labelClassName = "text-xs uppercase tracking-[0.12em] text-muted-foreground";

export function BulkAddTasksDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  todayIso,
  subjects = [],
}: BulkAddTasksDialogProps) {
  const [baseName, setBaseName] = useState("");
  const [count, setCount] = useState<number | "">(5);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [scheduledFor, setScheduledFor] = useState(todayIso);
  const [bucket, setBucket] = useState<"daily" | "backlog">("daily");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (wasOpen || !open) {
      return;
    }

    setBaseName("");
    setCount(5);
    setPriority("medium");
    setScheduledFor(todayIso);
    setBucket("daily");
    setSubjectId(null);
    setDueDate("");
    setError("");
  }, [open, todayIso]);

  const trimmedBaseName = baseName.trim();
  const countIsNumber = typeof count === "number" && Number.isFinite(count);
  const countIsInteger = countIsNumber && Number.isInteger(count);
  const isValidCount = countIsInteger && count >= 1 && count <= 99;
  const countLabel = countIsNumber ? count : 0;
  const canPreview = trimmedBaseName.length > 0 && isValidCount;

  const previewTitles = useMemo(() => {
    if (!canPreview) {
      return [];
    }

    const total = count as number;
    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => `${trimmedBaseName} ${index + 1}`);
    }

    return [
      `${trimmedBaseName} 1`,
      `${trimmedBaseName} 2`,
      `${trimmedBaseName} 3`,
      "...",
      `${trimmedBaseName} ${total}`,
    ];
  }, [canPreview, count, trimmedBaseName]);

  const handleConfirm = () => {
    const trimmed = baseName.trim();
    if (!trimmed) {
      setError("Please enter a base name for the tasks.");
      return;
    }

    if (trimmed.length > 80) {
      setError("Base name must be 80 characters or fewer.");
      return;
    }

    const numericCount = typeof count === "number" ? count : NaN;
    if (!Number.isInteger(numericCount)) {
      setError("Please enter a count.");
      return;
    }

    if (numericCount < 1) {
      setError("Count must be at least 1.");
      return;
    }

    if (numericCount > 99) {
      setError("Count must be 99 or fewer.");
      return;
    }

    const titles = Array.from({ length: numericCount }, (_, index) => `${trimmed} ${index + 1}`);
    onConfirm(titles, {
      priority,
      scheduledFor,
      bucket,
      subjectId,
      dueDate: dueDate ? dueDate : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Multiple Tasks</DialogTitle>
          <DialogDescription>Create a numbered sequence of tasks.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label className={labelClassName}>Base name</Label>
            <Input
              value={baseName}
              onChange={(event) => {
                setBaseName(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Chapter"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              e.g. "Chapter" -&gt; Chapter 1, Chapter 2, ...
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={labelClassName}>Count (1 - 99)</Label>
              <Input
                type="number"
                min={1}
                max={99}
                step={1}
                value={count}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === "") {
                    setCount("");
                    if (error) {
                      setError("");
                    }
                    return;
                  }

                  const parsed = Number(nextValue);
                  setCount(Number.isFinite(parsed) ? parsed : "");
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClassName}>Priority</Label>
              <Select
                value={priority}
                onValueChange={(next) => {
                  setPriority(next as TaskPriority);
                  if (error) {
                    setError("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "daily" ? (
            <div className="space-y-1.5">
              <Label className={labelClassName}>Scheduled for</Label>
              <Input
                type="date"
                value={scheduledFor}
                onChange={(event) => {
                  setScheduledFor(event.target.value);
                  if (error) {
                    setError("");
                  }
                }}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Type</Label>
                  <Select
                    value={bucket}
                    onValueChange={(next) => {
                      setBucket(next as "daily" | "backlog");
                      if (error) {
                        setError("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Short-term</SelectItem>
                      <SelectItem value="backlog">Long-term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClassName}>Subject (optional)</Label>
                  <Select
                    value={subjectId ?? "none"}
                    onValueChange={(next) => {
                      setSubjectId(next === "none" ? null : next);
                      if (error) {
                        setError("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClassName}>Due date (optional)</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => {
                    setDueDate(event.target.value);
                    if (error) {
                      setError("");
                    }
                  }}
                />
              </div>
            </>
          )}

          {canPreview ? (
            <div className="rounded-xl border border-border/60 bg-background/65 px-3 py-3 text-sm">
              <p className="font-medium">
                Will create {count} task{count === 1 ? "" : "s"}:
              </p>
              <p className="text-muted-foreground">{previewTitles.join(", ")}</p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={trimmedBaseName.length === 0 || !isValidCount}
          >
            Create {countLabel} Task{countLabel === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
