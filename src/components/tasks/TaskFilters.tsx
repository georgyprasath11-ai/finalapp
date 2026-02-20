import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Subject, TaskPriority } from "@/types/models";

interface TaskFiltersValue {
  search: string;
  subjectId: string;
  status: "all" | "open" | "done";
  priority: "all" | TaskPriority;
}

interface TaskFiltersProps {
  value: TaskFiltersValue;
  onChange: (next: TaskFiltersValue) => void;
  subjects: Subject[];
}

export function TaskFilters({ value, onChange, subjects }: TaskFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Input
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        placeholder="Search tasks"
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
  );
}

export type { TaskFiltersValue };
