import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { DailyTaskProvider, useDailyTaskStore } from "@/store/daily-task-store";
import { StudySession, Task, TaskType, TimerSnapshot, UserData } from "@/types/models";
import { addDays, todayIsoDate } from "@/utils/date";

interface StoreSnapshot {
  app: ReturnType<typeof useAppStore>;
  daily: ReturnType<typeof useDailyTaskStore>;
}

function StoreHarness({ onChange }: { onChange: (snapshot: StoreSnapshot) => void }) {
  const app = useAppStore();
  const daily = useDailyTaskStore();

  useEffect(() => {
    onChange({ app, daily });
  }, [app, daily, onChange]);

  return null;
}

const withStores = (onChange: (snapshot: StoreSnapshot) => void) => (
  <AppStoreProvider>
    <DailyTaskProvider>
      <StoreHarness onChange={onChange} />
    </DailyTaskProvider>
  </AppStoreProvider>
);

const createCompletedSession = (taskId: string, subjectId: string, seconds: number): StudySession => {
  const endTime = Date.now();
  const startTime = endTime - seconds * 1000;

  return {
    id: `session-${taskId}`,
    sessionId: `session-${taskId}`,
    subjectId,
    taskId,
    taskIds: [taskId],
    taskAllocations: { [taskId]: seconds },
    activeTaskId: null,
    activeTaskStartedAt: null,
    tabId: "test-tab",
    startedAt: new Date(startTime).toISOString(),
    endedAt: new Date(endTime).toISOString(),
    durationMs: seconds * 1000,
    startTime,
    endTime,
    durationSeconds: seconds,
    accumulatedTime: seconds,
    status: "completed",
    lastStartTimestamp: null,
    isActive: false,
    mode: "stopwatch",
    phase: "manual",
    reflectionRating: null,
    reflectionComment: "",
    reflectionTimestamp: null,
    rating: null,
    reflection: "",
    createdAt: new Date(endTime).toISOString(),
  };
};

const ensureSubjectTask = (
  data: UserData,
  taskId: string,
  options?: {
    totalSeconds?: number;
    sessions?: StudySession[];
    timer?: Partial<TimerSnapshot>;
  },
): UserData => {
  const totalSeconds = options?.totalSeconds ?? 1800;
  const nowMs = Date.now();

  return {
    ...data,
    tasks: data.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            category: "subject",
            type: TaskType.SHORT_TERM,
            timeSpent: totalSeconds,
            totalTimeSpent: totalSeconds,
            totalTimeSeconds: totalSeconds,
            sessionCount: Math.max(1, options?.sessions?.length ?? 1),
            lastWorkedAt: nowMs,
          }
        : task,
    ),
    sessions: options?.sessions ?? data.sessions,
    timer: {
      ...data.timer,
      ...(options?.timer ?? {}),
    },
  };
};

const setupStores = async () => {
  let snapshot: StoreSnapshot | null = null;

  const view = render(withStores((next) => {
    snapshot = next;
  }));

  await waitFor(() => {
    expect(snapshot).not.toBeNull();
  });

  const get = (): StoreSnapshot => {
    if (!snapshot) {
      throw new Error("Store snapshot unavailable");
    }

    return snapshot;
  };

  await act(async () => {
    get().app.createProfile("Test Profile");
  });

  await waitFor(() => {
    expect(get().app.activeProfile).not.toBeNull();
  });

  return {
    ...view,
    get,
  };
};

const seedSubjectTask = async (
  get: () => StoreSnapshot,
  title = "Algebra Revision",
): Promise<{ taskId: string; subjectId: string }> => {
  await act(async () => {
    get().app.addSubject("Math", "#2563eb");
  });

  const subjectId = get().app.data?.subjects[0]?.id;
  if (!subjectId) {
    throw new Error("Subject seed failed");
  }

  await act(async () => {
    get().app.addTask({
      title,
      description: "Review chapter 1",
      subjectId,
      bucket: "daily",
      priority: "high",
      dueDate: addDays(todayIsoDate(), 5),
    });
  });

  const createdTask = get().app.data?.tasks.find((task) => task.title === title);
  if (!createdTask) {
    throw new Error("Task seed failed");
  }

  const session = createCompletedSession(createdTask.id, subjectId, 1800);
  const snapshot = ensureSubjectTask(get().app.data as UserData, createdTask.id, {
    totalSeconds: 1800,
    sessions: [session],
  });

  await act(async () => {
    get().app.restoreProfileDataSnapshot(snapshot);
  });

  return {
    taskId: createdTask.id,
    subjectId,
  };
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("task migration store flows", () => {
  it("move to Short-Term preserves time and progress fields", async () => {
    const { get } = await setupStores();
    const { taskId } = await seedSubjectTask(get, "Short move task");

    let result;
    await act(async () => {
      result = get().daily.moveSubjectTask(taskId, "shortTerm");
    });

    expect(result?.ok).toBe(true);

    const moved = get().app.data?.tasks.find((task) => task.id === taskId) as Task;
    expect(moved).toBeDefined();
    expect(moved.category).toBe("shortTerm");
    expect(moved.type).toBe(TaskType.SHORT_TERM);
    expect(moved.totalTimeSeconds).toBe(1800);
    expect(moved.timeSpent).toBe(1800);
    expect(moved.sessionCount).toBeGreaterThan(0);
  });

  it("move to Long-Term preserves time and progress fields", async () => {
    const { get } = await setupStores();
    const { taskId } = await seedSubjectTask(get, "Long move task");

    let result;
    await act(async () => {
      result = get().daily.moveSubjectTask(taskId, "longTerm");
    });

    expect(result?.ok).toBe(true);

    const moved = get().app.data?.tasks.find((task) => task.id === taskId) as Task;
    expect(moved).toBeDefined();
    expect(moved.category).toBe("longTerm");
    expect(moved.type).toBe(TaskType.LONG_TERM);
    expect(moved.totalTimeSeconds).toBe(1800);
    expect(moved.timeSpent).toBe(1800);
    expect(moved.sessionCount).toBeGreaterThan(0);
  });

  it("move to Daily resets tracked progress and removes timed task", async () => {
    const { get } = await setupStores();
    const { taskId } = await seedSubjectTask(get, "Daily reset task");

    let result;
    await act(async () => {
      result = get().daily.moveSubjectTask(taskId, "daily", {
        scheduledFor: get().daily.todayIso,
      });
    });

    expect(result?.ok).toBe(true);

    const removed = get().app.data?.tasks.find((task) => task.id === taskId);
    expect(removed).toBeUndefined();

    const daily = get().daily.dailyTasks.find((task) => task.title === "Daily reset task");
    expect(daily).toBeDefined();
    expect(daily?.timeSpent).toBe(0);
    expect(daily?.completed).toBe(false);

    const stillLinkedToRemovedTask = get().app.data?.sessions.some((session) => {
      if (session.taskId === taskId) {
        return true;
      }

      return (session.taskIds ?? []).includes(taskId);
    });

    expect(stillLinkedToRemovedTask).toBe(false);
  });

  it("blocks move when destination already has duplicate", async () => {
    const { get } = await setupStores();
    const { taskId, subjectId } = await seedSubjectTask(get, "Duplicate title task");

    await act(async () => {
      get().app.addTask({
        title: "Duplicate title task",
        description: "destination duplicate",
        subjectId,
        bucket: "daily",
        priority: "medium",
        dueDate: addDays(todayIsoDate(), 6),
      });
    });

    let result;
    await act(async () => {
      result = get().daily.moveSubjectTask(taskId, "shortTerm");
    });

    expect(result?.ok).toBe(false);
    expect(result?.error).toContain("already exists");

    const source = get().app.data?.tasks.find((task) => task.id === taskId);
    expect(source?.category).toBe("subject");
  });

  it("auto-stops running timer before move", async () => {
    const { get } = await setupStores();
    const { taskId, subjectId } = await seedSubjectTask(get, "Timer migration task");

    const nowMs = Date.now();
    const snapshot = ensureSubjectTask(get().app.data as UserData, taskId, {
      totalSeconds: 300,
      sessions: [],
      timer: {
        mode: "stopwatch",
        phase: "focus",
        isRunning: true,
        startedAtMs: nowMs - 45_000,
        accumulatedMs: 0,
        phaseStartedAtMs: nowMs - 45_000,
        phaseAccumulatedMs: 0,
        cycleCount: 0,
        subjectId,
        taskId,
      },
    });

    await act(async () => {
      get().app.restoreProfileDataSnapshot(snapshot);
    });

    let result;
    await act(async () => {
      result = get().daily.moveSubjectTask(taskId, "longTerm");
    });

    expect(result?.ok).toBe(true);
    expect(result?.timerStopped).toBe(true);

    const timer = get().app.data?.timer;
    expect(timer?.isRunning).toBe(false);
    expect(timer?.taskId).toBeNull();
  });

  it("persists migrated state after provider remount", async () => {
    const first = await setupStores();
    const { taskId } = await seedSubjectTask(first.get, "Persisted move task");

    await act(async () => {
      first.get().daily.moveSubjectTask(taskId, "daily", {
        scheduledFor: first.get().daily.todayIso,
      });
    });

    first.unmount();

    const second = await setupStores();

    await waitFor(() => {
      expect(second.get().daily.dailyTasks.some((task) => task.title === "Persisted move task")).toBe(true);
    });

    expect(second.get().app.data?.tasks.some((task) => task.id === taskId)).toBe(false);
  });
});
