import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/pages/AnalyticsPage";
import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { SessionRating, StudySession, UserData } from "@/types/models";
import { addDays, startOfWeek, toLocalIsoDate, todayIsoDate } from "@/utils/date";

function Harness({ onChange }: { onChange: (store: ReturnType<typeof useAppStore>) => void }) {
  const store = useAppStore();

  useEffect(() => {
    onChange(store);
  }, [store, onChange]);

  return null;
}

const buildCompletedSession = (
  taskId: string,
  subjectId: string,
  minutes: number,
  rating: SessionRating | null,
): StudySession => {
  const end = Date.now();
  const durationSeconds = minutes * 60;
  const start = end - durationSeconds * 1000;

  return {
    id: `session-${taskId}-${minutes}`,
    sessionId: `session-${taskId}-${minutes}`,
    subjectId,
    taskId,
    taskIds: [taskId],
    taskAllocations: { [taskId]: durationSeconds },
    activeTaskId: null,
    activeTaskStartedAt: null,
    tabId: "analytics-test",
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(end).toISOString(),
    durationMs: durationSeconds * 1000,
    startTime: start,
    endTime: end,
    durationSeconds,
    accumulatedTime: durationSeconds,
    status: "completed",
    lastStartTimestamp: null,
    isActive: false,
    mode: "stopwatch",
    phase: "manual",
    reflectionRating: rating,
    reflectionComment: "",
    reflectionTimestamp: rating ? end : null,
    rating,
    reflection: "",
    createdAt: new Date(end).toISOString(),
  };
};

const setupPage = async () => {
  let snapshot: ReturnType<typeof useAppStore> | null = null;

  render(
    <AppStoreProvider>
      <Harness onChange={(store) => {
        snapshot = store;
      }} />
      <AnalyticsPage />
    </AppStoreProvider>,
  );

  await waitFor(() => {
    expect(snapshot).not.toBeNull();
  });

  const get = () => {
    if (!snapshot) {
      throw new Error("Snapshot unavailable");
    }

    return snapshot;
  };

  await act(async () => {
    get().createProfile("Analytics Test");
  });

  await waitFor(() => {
    expect(get().activeProfile).not.toBeNull();
  });

  return { get };
};

const seedAnalyticsData = async (get: () => ReturnType<typeof useAppStore>, withReflections = true) => {
  await act(async () => {
    get().addSubject("Math", "#2563eb");
    get().addTask({
      title: "Algebra",
      description: "",
      subjectId: null,
      bucket: "daily",
      priority: "medium",
      dueDate: addDays(todayIsoDate(), 4),
    });
  });

  const task = get().data?.tasks[0];
  const subjectId = get().data?.subjects[0]?.id;
  if (!task || !subjectId || !get().data) {
    throw new Error("Failed to seed base analytics data");
  }

  const snapshot: UserData = {
    ...get().data,
    tasks: get().data.tasks.map((candidate) =>
      candidate.id === task.id
        ? {
            ...candidate,
            subjectId,
            completed: true,
            status: "completed",
            completedAt: new Date().toISOString(),
          }
        : candidate,
    ),
    sessions: [
      buildCompletedSession(task.id, subjectId, 45, withReflections ? "productive" : null),
      buildCompletedSession(task.id, subjectId, 30, withReflections ? "average" : null),
    ],
  };

  await act(async () => {
    get().restoreProfileDataSnapshot(snapshot);
  });
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

describe("AnalyticsPage expanded charts", () => {
  it("renders 13 charts including exactly 6 productivity charts", async () => {
    const { get } = await setupPage();
    await seedAnalyticsData(get, true);

    await waitFor(() => {
      expect(screen.getAllByTestId(/analytics-chart-/).length).toBe(13);
    });

    expect(screen.getAllByTestId(/analytics-chart-productivity-/).length).toBe(6);
  });

  it("updates range when switching presets", async () => {
    await setupPage();

    const startOfCurrentWeek = toLocalIsoDate(startOfWeek(new Date()));
    expect(screen.getByText(new RegExp(`Range: ${startOfCurrentWeek}`))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    const last30Start = addDays(todayIsoDate(), -29);
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Range: ${last30Start}`))).toBeInTheDocument();
    });
  });

  it("shows empty state safely with missing reflections", async () => {
    const { get } = await setupPage();
    await seedAnalyticsData(get, false);

    await waitFor(() => {
      expect(screen.getAllByTestId(/analytics-chart-/).length).toBe(13);
    });

    expect(screen.getByText(/Not enough data yet\. Start studying to unlock insights\./i)).toBeInTheDocument();
  });
});
