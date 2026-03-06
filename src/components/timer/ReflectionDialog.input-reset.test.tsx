import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReflectionDialog } from "@/components/timer/ReflectionDialog";
import { useAppStore } from "@/store/app-store";

vi.mock("@/store/app-store", () => ({
  useAppStore: vi.fn(),
}));

const mockedUseAppStore = vi.mocked(useAppStore);

const createStoreValue = (overrides?: Record<string, unknown>) => ({
  data: {
    subjects: [{ id: "subject-1", name: "Math" }],
    sessions: [
      {
        id: "session-1",
        reflectionRating: null,
        rating: null,
        reflectionComment: "",
        reflection: "",
      },
    ],
  },
  pendingReflection: {
    sessionId: "session-1",
    subjectId: "subject-1",
    durationMs: 3_600_000,
  },
  dismissPendingReflection: vi.fn(),
  saveSessionReflection: vi.fn(),
  ...overrides,
});

describe("ReflectionDialog input stability", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
  });

  it("keeps typed comment when store data updates for the same pending session", () => {
    const firstStore = createStoreValue();
    mockedUseAppStore.mockReturnValue(firstStore as never);

    const view = render(<ReflectionDialog />);

    const commentArea = screen.getByPlaceholderText("What went well? What distracted you?") as HTMLTextAreaElement;
    fireEvent.change(commentArea, { target: { value: "Strong focus with no distractions." } });
    expect(commentArea.value).toBe("Strong focus with no distractions.");

    const secondStore = createStoreValue({
      data: {
        subjects: [{ id: "subject-1", name: "Math" }],
        sessions: [
          {
            id: "session-1",
            reflectionRating: null,
            rating: null,
            reflectionComment: "",
            reflection: "",
          },
        ],
      },
    });
    mockedUseAppStore.mockReturnValue(secondStore as never);

    view.rerender(<ReflectionDialog />);

    expect((screen.getByPlaceholderText("What went well? What distracted you?") as HTMLTextAreaElement).value).toBe(
      "Strong focus with no distractions.",
    );
  });
});
