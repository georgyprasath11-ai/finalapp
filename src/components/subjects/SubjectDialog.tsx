import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUBJECT_COLOR_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Subject } from "@/types/models";

interface SubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSubject?: Subject;
  onSubmit: (name: string, color: string) => void;
}

export function SubjectDialog({ open, onOpenChange, initialSubject, onSubmit }: SubjectDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBJECT_COLOR_OPTIONS[0]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialSubject) {
      setName(initialSubject.name);
      setColor(initialSubject.color);
    } else {
      setName("");
      setColor(SUBJECT_COLOR_OPTIONS[0]);
    }
  }, [initialSubject, open]);

  const submit = () => {
    if (!name.trim()) {
      return;
    }
    onSubmit(name.trim(), color);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
          <DialogDescription>Assign a color so analytics and tasks remain visually distinct.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Subject name" autoFocus />

          <div className="grid grid-cols-5 gap-2">
            {SUBJECT_COLOR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  "h-9 rounded-xl border-2 transition",
                  color === option ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                aria-label={`Select ${option} color`}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            {initialSubject ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
