import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ImportantQuestion, QuestionStatus } from "@/types/models";
import { createId } from "@/utils/id";
import { idbStorage } from "@/store/zustand/idbStorage";

interface ImportantQuestionsState {
  questions: ImportantQuestion[];
  addQuestion: (
    draft: Pick<
      ImportantQuestion,
      "questionText" | "subject" | "topic" | "difficulty" | "notes" | "tags"
    >,
  ) => void;
  updateQuestion: (
    id: string,
    patch: Partial<
      Pick<
        ImportantQuestion,
        "questionText" | "subject" | "topic" | "difficulty" | "status" | "notes" | "isPinned" | "tags"
      >
    >,
  ) => void;
  deleteQuestion: (id: string) => void;
  togglePin: (id: string) => void;
  setStatus: (id: string, status: QuestionStatus) => void;
  setQuestions: (questions: ImportantQuestion[]) => void;
}

interface PersistedImportantQuestionsState {
  questions: ImportantQuestion[];
}

const STORE_KEY = "app:importantQuestions";
const STORE_VERSION = 1;

const initialPersistedState: PersistedImportantQuestionsState = {
  questions: [],
};

const nextId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createId();
};

const resolveSolvedAt = (status: QuestionStatus, nowIso: string): string | null =>
  status === "solved" ? nowIso : null;

export const useImportantQuestionsStore = create<ImportantQuestionsState>()(
  persist(
    (set, get) => ({
      ...initialPersistedState,
      addQuestion: (draft) => {
        const now = new Date().toISOString();
        const next: ImportantQuestion = {
          id: nextId(),
          questionText: draft.questionText,
          subject: draft.subject,
          topic: draft.topic,
          difficulty: draft.difficulty,
          status: "unsolved",
          notes: draft.notes,
          isPinned: false,
          tags: draft.tags,
          createdAt: now,
          updatedAt: now,
          solvedAt: null,
        };

        set((state) => ({
          questions: [next, ...state.questions],
        }));
      },
      updateQuestion: (id, patch) => {
        const now = new Date().toISOString();
        set((state) => ({
          questions: state.questions.map((question) => {
            if (question.id !== id) {
              return question;
            }
            const nextStatus = patch.status ?? question.status;
            const shouldUpdateStatus = typeof patch.status !== "undefined";
            return {
              ...question,
              ...patch,
              status: nextStatus,
              solvedAt: shouldUpdateStatus ? resolveSolvedAt(nextStatus, now) : question.solvedAt,
              updatedAt: now,
            };
          }),
        }));
      },
      deleteQuestion: (id) =>
        set((state) => ({
          questions: state.questions.filter((question) => question.id !== id),
        })),
      togglePin: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          questions: state.questions.map((question) =>
            question.id === id ? { ...question, isPinned: !question.isPinned, updatedAt: now } : question,
          ),
        }));
      },
      setStatus: (id, status) => {
        const now = new Date().toISOString();
        set((state) => ({
          questions: state.questions.map((question) =>
            question.id === id
              ? {
                  ...question,
                  status,
                  solvedAt: resolveSolvedAt(status, now),
                  updatedAt: now,
                }
              : question,
          ),
        }));
      },
      setQuestions: (questions) => set({ questions }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ questions: state.questions }),
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return { ...initialPersistedState };
        }
        const record = persistedState as Partial<PersistedImportantQuestionsState>;
        return {
          questions: Array.isArray(record.questions) ? (record.questions as ImportantQuestion[]) : [],
        };
      },
    },
  ),
);
