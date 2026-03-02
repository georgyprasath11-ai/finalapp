import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SubjectsPage from "@/pages/SubjectsPage";
import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { DailyTaskProvider, useDailyTaskStore } from "@/store/daily-task-store";
import { TaskType, UserData } from "@/types/models";
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

const setupSubjectsPage = async () => {
  let snapshot: StoreSnapshot | null = null;

  const view = render(
    <AppStoreProvider>
      <DailyTaskProvider>
        <StoreHarness onChange={(next) => {
          snapshot = next;
        }} />
        <SubjectsPage />
      </DailyTaskProvider>
    </AppStoreProvider>,
  );

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
    get().app.createProfile("UI Test Profile");
  });

  await waitFor(() => {
    expect(get().app.activeProfile).not.toBeNull();
  });

  return {
    ...view,
    get,
  };
};

const seedSubjectTaskForUi = async (get: () => StoreSnapshot, title = "Modal Task") => {
  await act(async () => {
    get().app.addSubject("Physics", "#16a34a");
  });

  const subjectId = get().app.data?.subjects[0]?.id;
  if (!subjectId) {
    throw new Error("Subject seed failed");
  }

  await act(async () => {
    get().app.addTask({
      title,
      description: "prepare for UI test",
      subjectId,
      bucket: "daily",
      priority: "high",
      dueDate: addDays(todayIsoDate(), 4),
    });
  });

  const createdTask = get().app.data?.tasks.find((task) => task.title === title);
  if (!createdTask || !get().app.data) {
    throw new Error("Task seed failed");
  }

  const snapshot: UserData = {
    ...get().app.data,
    tasks: get().app.data.tasks.map((task) =>
      task.id === createdTask.id
        ? {
            ...task,
            category: "subject",
            type: TaskType.SHORT_TERM,
            timeSpent: 600,
            totalTimeSpent: 600,
            totalTimeSeconds: 600,
          }
        : task,
    ),
  };

  await act(async () => {
    get().app.restoreProfileDataSnapshot(snapshot);
  });

  await waitFor(() => {
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  return createdTask.id;
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

describe("SubjectsPage daily move warning", () => {
  it("shows warning modal before moving task to Daily", async () => {
    const { get } = await setupSubjectsPage();
    await seedSubjectTaskForUi(get, "Warning Task");

    const trigger = await screen.findByLabelText("Move Warning Task");
    fireEvent.click(trigger);

    const dailyMenuItem = await screen.findByText("Move to Daily");
    fireEvent.click(dailyMenuItem);

    expect(await screen.findByText("Reset Progress?")).toBeInTheDocument();
    expect(screen.getByText(/Moving this task to Daily Tasks will reset its tracked time and progress\./i)).toBeInTheDocument();
    expect(screen.getByText(/Saved time data may be permanently lost\./i)).toBeInTheDocument();
  });

  it("Cancel keeps task in Subjects and prevents move", async () => {
    const { get } = await setupSubjectsPage();
    const taskId = await seedSubjectTaskForUi(get, "Cancel Task");

    const trigger = await screen.findByLabelText("Move Cancel Task");
    fireEvent.click(trigger);

    const dailyMenuItem = await screen.findByText("Move to Daily");
    fireEvent.click(dailyMenuItem);

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancel);

    await waitFor(() => {
      expect(screen.queryByText("Reset Progress?")).not.toBeInTheDocument();
    });

    expect(get().app.data?.tasks.some((task) => task.id === taskId)).toBe(true);
    expect(get().daily.dailyTasks.some((task) => task.title === "Cancel Task")).toBe(false);
  });
});

