import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Subject, TaskPriority } from "@/types/models";
import { cn } from "@/lib/utils";

interface TaskFiltersValue {
  search: string;
  subjectId: string;
  status: "all" | "open" | "done";
  priority: "all" | TaskPriority;
  statusFilter?: "all" | "active" | "backlog";
}

interface TaskFiltersProps {
  value: TaskFiltersValue;
  onChange: (next: TaskFiltersValue) => void;
  subjects: Subject[];
  showStatus?: boolean;
  searchInputId?: string;
}

export function TaskFilters({ value, onChange, subjects, showStatus = true, searchInputId }: TaskFiltersProps) {
  const statusFilter = value.statusFilter ?? "all";

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex items-center rounded-xl border border-border/60 bg-background/60 p-1">
          {(["all", "active", "backlog"] as const).map((segment) => (
            <button
              key={segment}
              type="button"
              onClick={() => onChange({ ...value, statusFilter: segment })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === segment
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={`Show ${segment} tasks`}
            >
              {segment === "all" ? "All" : segment === "active" ? "Active" : "Backlog"}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${showStatus ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Input
          id={searchInputId}
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          placeholder="Search tasks"
          aria-label="Search tasks"
        />

        <Select value={value.subjectId} onValueChange={(subjectId) => onChange({ ...value, subjectId })}>
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="none">No subject</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showStatus ? (
          <Select value={value.status} onValueChange={(status) => onChange({ ...value, status: status as TaskFiltersValue["status"] })}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={value.priority}
          onValueChange={(priority) => onChange({ ...value, priority: priority as TaskFiltersValue["priority"] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export type { TaskFiltersValue };
