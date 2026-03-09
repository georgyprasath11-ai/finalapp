import { Habit, NewFeaturesExportBundle, Note, WeeklyReview } from "@/types/models";

export type ImportStrategy = "merge" | "replace";

export interface ImportResult {
  notesAdded: number;
  habitsAdded: number;
  reviewsAdded: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Serialize all new-feature data to a downloadable JSON string */
export function buildNewFeaturesExport(
  notes: Note[],
  habits: Habit[],
  weeklyReviews: WeeklyReview[],
): string {
  const bundle: NewFeaturesExportBundle = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    notes,
    habits,
    weeklyReviews,
  };

  return JSON.stringify(bundle, null, 2);
}

/** Parse and validate an import JSON string.
 *  Returns the bundle on success, or throws a descriptive Error on failure. */
export function parseNewFeaturesImport(raw: string): NewFeaturesExportBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON — the file could not be parsed.");
  }

  if (!isRecord(parsed) || parsed.exportVersion !== 1) {
    throw new Error(
      "Unrecognised file format. Make sure you are importing a file exported from this app.",
    );
  }

  const bundle = parsed as NewFeaturesExportBundle;

  if (!Array.isArray(bundle.notes)) {
    throw new Error("Missing or invalid 'notes' array.");
  }

  if (!Array.isArray(bundle.habits)) {
    throw new Error("Missing or invalid 'habits' array.");
  }

  if (!Array.isArray(bundle.weeklyReviews)) {
    throw new Error("Missing or invalid 'weeklyReviews' array.");
  }

  return bundle;
}

/** Trigger a browser file download with the given content */
export function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Apply an import bundle to the current store states using the chosen strategy.
 *  Calls the provided setter callbacks - does NOT directly access any store. */
export function applyNewFeaturesImport(
  bundle: NewFeaturesExportBundle,
  strategy: ImportStrategy,
  current: { notes: Note[]; habits: Habit[]; weeklyReviews: WeeklyReview[] },
  setters: {
    setNotes: (notes: Note[]) => void;
    setHabits: (habits: Habit[]) => void;
    setWeeklyReviews: (reviews: WeeklyReview[]) => void;
  },
): ImportResult {
  if (strategy === "replace") {
    setters.setNotes(bundle.notes);
    setters.setHabits(bundle.habits);
    setters.setWeeklyReviews(bundle.weeklyReviews);

    return {
      notesAdded: bundle.notes.length,
      habitsAdded: bundle.habits.length,
      reviewsAdded: bundle.weeklyReviews.length,
    };
  }

  const existingNoteIds = new Set(current.notes.map((item) => item.id));
  const existingHabitIds = new Set(current.habits.map((item) => item.id));
  const existingReviewIds = new Set(current.weeklyReviews.map((item) => item.id));

  const newNotes = bundle.notes.filter((note) => !existingNoteIds.has(note.id));
  const newHabits = bundle.habits.filter((habit) => !existingHabitIds.has(habit.id));
  const newReviews = bundle.weeklyReviews.filter((review) => !existingReviewIds.has(review.id));

  setters.setNotes([...current.notes, ...newNotes]);
  setters.setHabits([...current.habits, ...newHabits]);
  setters.setWeeklyReviews([...current.weeklyReviews, ...newReviews]);

  return {
    notesAdded: newNotes.length,
    habitsAdded: newHabits.length,
    reviewsAdded: newReviews.length,
  };
}
