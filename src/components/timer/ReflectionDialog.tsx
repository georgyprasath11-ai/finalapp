import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/app-store";
import { SessionRating } from "@/types/models";
import { cn } from "@/lib/utils";
import { formatStudyTime } from "@/utils/format";

const MAX_COMMENT_LENGTH = 300;

const ratingOptions: Array<{
  value: SessionRating;
  label: string;
  tone: string;
}> = [
  {
    value: "productive",
    label: "Productive",
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15",
  },
  {
    value: "average",
    label: "Average",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:border-amber-300/50 hover:bg-amber-500/15",
  },
  {
    value: "distracted",
    label: "Distracted",
    tone: "border-rose-400/30 bg-rose-500/10 text-rose-200 hover:border-rose-300/50 hover:bg-rose-500/15",
  },
];

export function ReflectionDialog() {
  const { data, pendingReflection, dismissPendingReflection, saveSessionReflection } = useAppStore();
  const [selectedRating, setSelectedRating] = useState<SessionRating | null>(null);
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const open = pendingReflection !== null;

  const activeSession = useMemo(() => {
    if (!pendingReflection || !data) {
      return null;
    }

    return data.sessions.find((session) => session.id === pendingReflection.sessionId) ?? null;
  }, [data, pendingReflection]);

  const subjectName =
    pendingReflection && data
      ? data.subjects.find((subject) => subject.id === pendingReflection.subjectId)?.name ?? "Unassigned"
      : "Unassigned";

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialRating = activeSession?.reflectionRating ?? activeSession?.rating ?? null;
    const initialComment = activeSession?.reflectionComment ?? activeSession?.reflection ?? "";
    setSelectedRating(initialRating);
    setComment(initialComment.slice(0, MAX_COMMENT_LENGTH));
  }, [activeSession, open]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "0px";
    element.style.height = `${Math.min(220, element.scrollHeight)}px`;
  }, [comment, open]);

  const closeModal = () => {
    setSelectedRating(null);
    setComment("");
    dismissPendingReflection();
  };

  const saveReflection = () => {
    if (!pendingReflection || !selectedRating) {
      return;
    }

    saveSessionReflection(pendingReflection.sessionId, selectedRating, comment.slice(0, MAX_COMMENT_LENGTH));
    setSelectedRating(null);
    setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? closeModal() : undefined)}>
      <DialogContent className="w-[min(92vw,560px)] rounded-3xl border-border/70 bg-card/95 p-0 shadow-medium">
        <div className="space-y-5 p-6 sm:p-7">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl font-semibold">How was this session?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your reflection helps improve your analytics.
            </DialogDescription>
            {pendingReflection ? (
              <p className="text-xs text-muted-foreground">
                Logged {formatStudyTime(Math.max(0, Math.floor(pendingReflection.durationMs / 1000)))} for {subjectName}
              </p>
            ) : null}
          </DialogHeader>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {ratingOptions.map((option) => {
              const selected = selectedRating === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRating(option.value)}
                  className={cn(
                    "min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all duration-150 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    option.tone,
                    selected && "scale-[1.03] shadow-[0_0_0_1px_hsl(var(--ring)/0.35),0_10px_24px_hsl(var(--foreground)/0.16)]",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="reflection-note" className="text-sm font-medium text-muted-foreground">
                Add a note (optional)
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">{comment.length}/{MAX_COMMENT_LENGTH}</span>
            </div>
            <textarea
              id="reflection-note"
              ref={textareaRef}
              value={comment}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
              placeholder="What went well? What distracted you?"
              className="min-h-[108px] w-full resize-none rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5 text-sm leading-6 outline-none transition-colors duration-200 focus:border-ring"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="ghost" className="h-11 rounded-xl px-5" onClick={closeModal}>
              Skip
            </Button>
            <Button className="h-11 rounded-xl px-5" onClick={saveReflection} disabled={!selectedRating}>
              Save Reflection
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}