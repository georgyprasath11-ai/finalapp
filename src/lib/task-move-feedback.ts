export type TaskMoveFeedbackDestination = "shortTerm" | "longTerm" | "daily";

interface RecentTaskMoveRecord {
  taskId: string;
  destination: TaskMoveFeedbackDestination;
  movedAt: number;
}

const RECENT_TASK_MOVE_KEY = "study-dashboard:recent-task-move";

const isRecentTaskMoveRecord = (value: unknown): value is RecentTaskMoveRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.taskId === "string" &&
    (candidate.destination === "shortTerm" || candidate.destination === "longTerm" || candidate.destination === "daily") &&
    typeof candidate.movedAt === "number" &&
    Number.isFinite(candidate.movedAt)
  );
};

export const recordRecentTaskMove = (record: RecentTaskMoveRecord): void => {
  try {
    window.sessionStorage.setItem(RECENT_TASK_MOVE_KEY, JSON.stringify(record));
  } catch {
    // Ignore browser storage limitations.
  }
};

export const readRecentTaskMove = (now = Date.now(), maxAgeMs = 12_000): RecentTaskMoveRecord | null => {
  try {
    const raw = window.sessionStorage.getItem(RECENT_TASK_MOVE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecentTaskMoveRecord(parsed)) {
      return null;
    }

    if (now - parsed.movedAt > maxAgeMs) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};
