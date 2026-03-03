import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStoreProvider, useAppStore } from "@/store/app-store";
import { TaskType, UserData } from "@/types/models";
import { addDays, todayIsoDate } from "@/utils/date";

function Harness({ onChange }: { onChange: (store: ReturnType<typeof useAppStore>) => void }) {
  const store = useAppStore();

  useEffect(() => {
    onChange(store);
  }, [store, onChange]);

  return null;
}

const setupStore = async () => {
  let snapshot: ReturnType<typeof useAppStore> | null = null;

  render(
    <AppStoreProvider>
      <Harness onChange={(store) => {
        snapshot = store;
      }} />
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
    get().createProfile("Task Categories Test");
  });

  await waitFor(() => {
    expect(get().activeProfile).not.toBeNull();
  });

  return { get };
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

describe("task category management", () => {
  it("seeds only Assignments and Revision defaults on first load", async () => {
    const { get } = await setupStore();

    const names = (get().data?.categories ?? [])
      .filter((category) => !category.id.includes("_system"))
      .map((category) => category.name);

    expect(names).toEqual(["Assignments", "Revision"]);
  });

  it("reorders custom categories", async () => {
    const { get } = await setupStore();
    const categories = (get().data?.categories ?? []).filter((category) => !category.id.includes("_system"));

    const first = categories[0];
    const second = categories[1];
    if (!first || !second) {
      throw new Error("Expected default categories");
    }

    await act(async () => {
      get().reorderTaskCategory(second.id, first.id);
    });

    const reordered = (get().data?.categories ?? [])
      .filter((category) => !category.id.includes("_system"))
      .map((category) => category.id);

    expect(reordered[0]).toBe(second.id);
    expect(reordered[1]).toBe(first.id);
  });

  it("moves tasks when deleting a category with move strategy", async () => {
    const { get } = await setupStore();
    const categories = (get().data?.categories ?? []).filter((category) => !category.id.includes("_system"));
    const source = categories[0];
    const target = categories[1];
    if (!source || !target) {
      throw new Error("Expected source and target categories");
    }

    await act(async () => {
      get().addTask({
        title: "Move me",
        description: "",
        subjectId: null,
        bucket: "daily",
        priority: "medium",
        categoryId: source.id,
        dueDate: addDays(todayIsoDate(), 4),
      });
    });

    const taskId = get().data?.tasks.find((task) => task.title === "Move me")?.id;
    if (!taskId) {
      throw new Error("Expected seeded task");
    }

    let result;
    await act(async () => {
      result = get().deleteTaskCategory(source.id, { strategy: "move", targetCategoryId: target.id });
    });

    expect(result?.ok).toBe(true);
    expect(get().data?.tasks.find((task) => task.id === taskId)?.categoryId).toBe(target.id);
  });

  it("deletes linked tasks when deleting a category with delete strategy", async () => {
    const { get } = await setupStore();
    const category = (get().data?.categories ?? []).find((item) => !item.id.includes("_system"));
    if (!category) {
      throw new Error("Expected category");
    }

    await act(async () => {
      get().addTask({
        title: "Delete with tab",
        description: "",
        subjectId: null,
        bucket: "daily",
        priority: "medium",
        categoryId: category.id,
        dueDate: addDays(todayIsoDate(), 5),
      });
    });

    const taskId = get().data?.tasks.find((task) => task.title === "Delete with tab")?.id;
    if (!taskId) {
      throw new Error("Expected task");
    }

    let result;
    await act(async () => {
      result = get().deleteTaskCategory(category.id, { strategy: "delete" });
    });

    expect(result?.ok).toBe(true);
    expect(get().data?.tasks.some((task) => task.id === taskId)).toBe(false);
  });

  it("keeps tasks categorized when adding/updating with null category", async () => {
    const { get } = await setupStore();

    await act(async () => {
      get().addTask({
        title: "Null category",
        description: "",
        subjectId: null,
        bucket: "daily",
        priority: "medium",
        categoryId: null,
        dueDate: addDays(todayIsoDate(), 6),
      });
    });

    const created = get().data?.tasks.find((task) => task.title === "Null category");
    if (!created) {
      throw new Error("Expected created task");
    }

    expect(typeof created.categoryId).toBe("string");

    await act(async () => {
      get().updateTask(created.id, {
        categoryId: null,
      });
    });

    expect(typeof get().data?.tasks.find((task) => task.id === created.id)?.categoryId).toBe("string");
  });

  it("prevents deleting the final custom category", async () => {
    const { get } = await setupStore();

    const first = (get().data?.categories ?? []).find((category) => !category.id.includes("_system"));
    const second = (get().data?.categories ?? []).find((category) => !category.id.includes("_system") && category.id !== first?.id);
    if (!first || !second) {
      throw new Error("Expected default categories");
    }

    await act(async () => {
      get().deleteTaskCategory(second.id, { strategy: "delete" });
    });

    let result;
    await act(async () => {
      result = get().deleteTaskCategory(first.id, { strategy: "delete" });
    });

    expect(result?.ok).toBe(false);
    expect(result?.error).toContain("At least one category");
  });

  it("preserves duration type and completion metadata during toggles", async () => {
    const { get } = await setupStore();

    await act(async () => {
      get().addTask({
        title: "Toggle metadata",
        description: "",
        subjectId: null,
        bucket: "daily",
        priority: "medium",
        dueDate: addDays(todayIsoDate(), 20),
      });
    });

    const created = get().data?.tasks.find((task) => task.title === "Toggle metadata");
    if (!created) {
      throw new Error("Task missing");
    }

    const initialType = created.type;

    await act(async () => {
      get().toggleTask(created.id, true);
    });

    const completed = get().data?.tasks.find((task) => task.id === created.id);
    expect(completed?.completed).toBe(true);
    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).not.toBeNull();
    expect(completed?.type).toBe(initialType);

    await act(async () => {
      get().toggleTask(created.id, false);
    });

    const reopened = get().data?.tasks.find((task) => task.id === created.id) as UserData["tasks"][number];
    expect(reopened.completed).toBe(false);
    expect(reopened.status).toBe("active");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.type).toBe(initialType);
  });
});
