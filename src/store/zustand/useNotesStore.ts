import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Note } from "@/types/models";
import { createId } from "@/utils/id";

interface NotesState {
  notes: Note[];
  addNote: (draft: Pick<Note, "title" | "content" | "subjectId">) => void;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content" | "subjectId" | "isPinned">>) => void;
  deleteNote: (id: string) => void;
  setNotes: (notes: Note[]) => void;
}

interface PersistedNotesState {
  notes: Note[];
}

const STORE_KEY = "app:notes";
const STORE_VERSION = 1;

const sortNotes = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });

const initialPersistedState: PersistedNotesState = {
  notes: [],
};

const coercePersistedState = (value: unknown): PersistedNotesState => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedNotesState>;
  return {
    notes: Array.isArray(record.notes) ? sortNotes(record.notes as Note[]) : [],
  };
};

const nextId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createId();
};

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      addNote: (draft) => {
        const nowIso = new Date().toISOString();
        const note: Note = {
          id: nextId(),
          title: draft.title.trim(),
          content: draft.content,
          subjectId: draft.subjectId,
          isPinned: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        set((state) => ({
          notes: sortNotes([...state.notes, note]),
        }));
      },
      updateNote: (id, patch) =>
        set((state) => ({
          notes: sortNotes(
            state.notes.map((note) =>
              note.id === id
                ? {
                    ...note,
                    ...patch,
                    updatedAt: new Date().toISOString(),
                  }
                : note,
            ),
          ),
        })),
      deleteNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        })),
      setNotes: (notes) =>
        set({
          notes: sortNotes(notes),
        }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notes: state.notes,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
