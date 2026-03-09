import { describe, expect, it } from "vitest";
import {
  applyNewFeaturesImport,
  buildNewFeaturesExport,
  parseNewFeaturesImport,
} from "@/lib/new-features-export";
import { Habit, Note, WeeklyReview } from "@/types/models";

const sampleNotes = (): Note[] => [
  {
    id: "note-1",
    title: "Physics Formula",
    content: "F=ma",
    subjectId: null,
    isPinned: false,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  },
];

const sampleHabits = (): Habit[] => [
  {
    id: "habit-1",
    name: "Read",
    emoji: "📚",
    color: "#14b8a6",
    completions: ["2026-03-01"],
    createdAt: "2026-03-01T10:00:00.000Z",
    archivedAt: null,
  },
];

const sampleReviews = (): WeeklyReview[] => [
  {
    id: "review-1",
    weekStartIso: "2026-03-02",
    reflection: "Stayed consistent",
    savedAt: "2026-03-08T20:00:00.000Z",
  },
];

describe("new-features-export", () => {
  it("builds and parses export bundle", () => {
    const serialized = buildNewFeaturesExport(sampleNotes(), sampleHabits(), sampleReviews());
    const parsed = parseNewFeaturesImport(serialized);

    expect(parsed.exportVersion).toBe(1);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.habits).toHaveLength(1);
    expect(parsed.weeklyReviews).toHaveLength(1);
  });

  it("throws for malformed bundle", () => {
    expect(() => parseNewFeaturesImport("{bad json")).toThrowError(/Invalid JSON/i);
    expect(() => parseNewFeaturesImport(JSON.stringify({ exportVersion: 2 }))).toThrowError(/Unrecognised/i);
  });

  it("merges by skipping duplicate ids", () => {
    const bundle = parseNewFeaturesImport(buildNewFeaturesExport(sampleNotes(), sampleHabits(), sampleReviews()));

    let notes = sampleNotes();
    let habits = [] as Habit[];
    let weeklyReviews = [] as WeeklyReview[];

    const result = applyNewFeaturesImport(
      bundle,
      "merge",
      {
        notes,
        habits,
        weeklyReviews,
      },
      {
        setNotes: (next) => {
          notes = next;
        },
        setHabits: (next) => {
          habits = next;
        },
        setWeeklyReviews: (next) => {
          weeklyReviews = next;
        },
      },
    );

    expect(result).toEqual({ notesAdded: 0, habitsAdded: 1, reviewsAdded: 1 });
    expect(notes).toHaveLength(1);
    expect(habits).toHaveLength(1);
    expect(weeklyReviews).toHaveLength(1);
  });

  it("replaces local data when strategy is replace", () => {
    const bundle = parseNewFeaturesImport(buildNewFeaturesExport(sampleNotes(), sampleHabits(), sampleReviews()));

    let notes = [] as Note[];
    let habits = [] as Habit[];
    let weeklyReviews = [] as WeeklyReview[];

    const result = applyNewFeaturesImport(
      bundle,
      "replace",
      {
        notes: [
          {
            id: "old-note",
            title: "Old",
            content: "Old",
            subjectId: null,
            isPinned: false,
            createdAt: "2026-03-01T10:00:00.000Z",
            updatedAt: "2026-03-01T10:00:00.000Z",
          },
        ],
        habits: [],
        weeklyReviews: [],
      },
      {
        setNotes: (next) => {
          notes = next;
        },
        setHabits: (next) => {
          habits = next;
        },
        setWeeklyReviews: (next) => {
          weeklyReviews = next;
        },
      },
    );

    expect(result).toEqual({ notesAdded: 1, habitsAdded: 1, reviewsAdded: 1 });
    expect(notes[0]?.id).toBe("note-1");
    expect(habits[0]?.id).toBe("habit-1");
    expect(weeklyReviews[0]?.id).toBe("review-1");
  });
});
