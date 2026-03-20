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
import { subjectNameSchema } from "@/lib/validators";
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
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialSubject) {
      setName(initialSubject.name);
      setColor(initialSubject.color);
      setNameError("");
    } else {
      setName("");
      setColor(SUBJECT_COLOR_OPTIONS[0]);
      setNameError("");
    }
  }, [initialSubject, open]);

  const submit = () => {
    const parsedName = subjectNameSchema.safeParse(name);
    if (!parsedName.success) {
      setNameError(parsedName.error.issues[0]?.message ?? "Name is required");
      return;
    }
    setNameError("");
    onSubmit(parsedName.data, color);
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
          <div className="space-y-1.5">
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="Subject name"
              autoFocus
            />
            {nameError ? (
              <p className="text-xs text-rose-400" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

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
