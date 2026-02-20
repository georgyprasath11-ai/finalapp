import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { formatDuration } from "@/utils/format";

const ratingOptions = [
  { value: "great", label: "Great" },
  { value: "good", label: "Good" },
  { value: "okay", label: "Okay" },
  { value: "distracted", label: "Distracted" },
] as const;

export function ReflectionDialog() {
  const { data, pendingReflection, dismissPendingReflection, saveSessionReflection } = useAppStore();
  const [rating, setRating] = useState<string>("good");
  const [reflection, setReflection] = useState("");

  const open = pendingReflection !== null;
  const subjectName =
    pendingReflection && data
      ? data.subjects.find((subject) => subject.id === pendingReflection.subjectId)?.name ?? "Unassigned"
      : "";

  const onClose = () => {
    setRating("good");
    setReflection("");
    dismissPendingReflection();
  };

  const submit = () => {
    if (!pendingReflection) {
      return;
    }
    saveSessionReflection(
      pendingReflection.sessionId,
      (rating as "great" | "good" | "okay" | "distracted") ?? null,
      reflection,
    );
    setRating("good");
    setReflection("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Reflection</DialogTitle>
          <DialogDescription>
            {pendingReflection
              ? `Saved ${formatDuration(pendingReflection.durationMs)} for ${subjectName}. Add a quick reflection.`
              : "Capture how this session went."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Focus rating</label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ratingOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">What worked / what to improve</label>
            <Textarea
              rows={4}
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="Notes, distractions, wins..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={submit}>Save Reflection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
