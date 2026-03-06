import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskDialog } from "@/components/tasks/TaskDialog";

describe("TaskDialog input stability", () => {
  it("keeps title input value when parent rerenders with equivalent categories", () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(() => null);
    const categories = [{ id: "category-1", name: "Revision", createdAt: Date.now() }];

    const view = render(
      <TaskDialog
        open
        onOpenChange={onOpenChange}
        subjects={[]}
        categories={categories}
        activeCategoryId="category-1"
        defaultBucket="daily"
        minDueDate="2026-03-08"
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByPlaceholderText("Task title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Physics revision" } });
    expect(titleInput.value).toBe("Physics revision");

    view.rerender(
      <TaskDialog
        open
        onOpenChange={onOpenChange}
        subjects={[]}
        categories={[...categories]}
        activeCategoryId="category-1"
        defaultBucket="daily"
        minDueDate="2026-03-08"
        onSubmit={onSubmit}
      />,
    );

    expect((screen.getByPlaceholderText("Task title") as HTMLInputElement).value).toBe("Physics revision");
  });
});
