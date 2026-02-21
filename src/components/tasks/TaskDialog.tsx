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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Subject, Task, TaskBucket, TaskCategory, TaskPriority } from "@/types/models";

interface TaskFormValue {
  title: string;
  description: string;
  subjectId: string | null;
  categoryId: string | null;
  bucket: TaskBucket;
  priority: TaskPriority;
  estimatedMinutes: number | null;
  dueDate: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  categories: TaskCategory[];
  activeCategoryId: string | null;
  initialTask?: Task;
  defaultBucket?: TaskBucket;
  onSubmit: (value: TaskFormValue) => void;
}

const emptyValue: TaskFormValue = {
  title: "",
  description: "",
  subjectId: null,
  categoryId: null,
  bucket: "daily",
  priority: "medium",
  estimatedMinutes: null,
  dueDate: null,
};

export function TaskDialog({
  open,
  onOpenChange,
  subjects,
  categories,
  activeCategoryId,
  initialTask,
  defaultBucket = "daily",
  onSubmit,
}: TaskDialogProps) {
  const [value, setValue] = useState<TaskFormValue>(emptyValue);

  useEffect(() => {
    if (!open) {
      return;
    }

    const fallbackCategoryId = activeCategoryId ?? categories[0]?.id ?? null;

    if (initialTask) {
      setValue({
        title: initialTask.title,
        description: initialTask.description,
        subjectId: initialTask.subjectId,
        categoryId: initialTask.categoryId ?? fallbackCategoryId,
        bucket: "daily",
        priority: initialTask.priority,
        estimatedMinutes: initialTask.estimatedMinutes,
        dueDate: initialTask.dueDate,
      });
    } else {
      setValue({
        ...emptyValue,
        categoryId: fallbackCategoryId,
        bucket: defaultBucket,
        dueDate: new Date().toISOString().split("T")[0],
      });
    }
  }, [activeCategoryId, categories, defaultBucket, initialTask, open]);

  const submit = () => {
    if (!value.title.trim()) {
      return;
    }
    onSubmit({
      ...value,
      bucket: "daily",
      categoryId: value.categoryId ?? activeCategoryId ?? categories[0]?.id ?? null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialTask ? "Edit Task" : "Add Task"}</DialogTitle>
          <DialogDescription>
            Manage daily work with category, priority, estimate, and subject tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Input
            value={value.title}
            onChange={(event) => setValue((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Task title"
            autoFocus
          />

          <Textarea
            rows={3}
            value={value.description}
            onChange={(event) => setValue((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Optional notes"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={value.categoryId ?? "none"}
              onValueChange={(categoryId) => setValue((prev) => ({ ...prev, categoryId: categoryId === "none" ? null : categoryId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={value.priority}
              onValueChange={(priority) => setValue((prev) => ({ ...prev, priority: priority as TaskPriority }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={value.subjectId ?? "none"}
              onValueChange={(subjectId) => setValue((prev) => ({ ...prev, subjectId: subjectId === "none" ? null : subjectId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
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

            <Input
              type="number"
              min={0}
              value={value.estimatedMinutes ?? ""}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                setValue((prev) => ({
                  ...prev,
                  estimatedMinutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                }));
              }}
              placeholder="Estimated minutes"
            />
          </div>

          <Input
            type="date"
            value={value.dueDate ?? ""}
            onChange={(event) =>
              setValue((prev) => ({
                ...prev,
                dueDate: event.target.value ? event.target.value : null,
              }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!value.title.trim()}>
            {initialTask ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { TaskFormValue };