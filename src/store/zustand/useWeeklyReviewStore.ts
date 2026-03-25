import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { WeeklyReview } from "@/types/models";
import { createId } from "@/utils/id";

interface WeeklyReviewState {
  reviews: WeeklyReview[];
  saveReview: (weekStartIso: string, reflection: string) => void;
  getReviewForWeek: (weekStartIso: string) => WeeklyReview | undefined;
  setWeeklyReviews: (reviews: WeeklyReview[]) => void;
}

interface PersistedWeeklyReviewState {
  reviews: WeeklyReview[];
}

const STORE_KEY = "app:weeklyReviews";
const STORE_VERSION = 1;

const initialPersistedState: PersistedWeeklyReviewState = {
  reviews: [],
};

const sortReviews = (reviews: WeeklyReview[]): WeeklyReview[] =>
  [...reviews].sort((a, b) => b.weekStartIso.localeCompare(a.weekStartIso));

const coercePersistedState = (value: unknown): PersistedWeeklyReviewState => {
  if (!value || typeof value !== "object") {
    return { ...initialPersistedState };
  }

  const record = value as Partial<PersistedWeeklyReviewState>;
  return {
    reviews: Array.isArray(record.reviews) ? sortReviews(record.reviews as WeeklyReview[]) : [],
  };
};

const nextId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createId();
};

export const useWeeklyReviewStore = create<WeeklyReviewState>()(
  persist(
    (set, get) => ({
      ...initialPersistedState,
      saveReview: (weekStartIso, reflection) => {
        const savedAt = new Date().toISOString();

        set((state) => {
          const existing = state.reviews.find((review) => review.weekStartIso === weekStartIso);
          if (existing) {
            return {
              reviews: sortReviews(
                state.reviews.map((review) =>
                  review.weekStartIso === weekStartIso
                    ? {
                        ...review,
                        reflection,
                        savedAt,
                      }
                    : review,
                ),
              ),
            };
          }

          const next: WeeklyReview = {
            id: nextId(),
            weekStartIso,
            reflection,
            savedAt,
          };

          return {
            reviews: sortReviews([...state.reviews, next]),
          };
        });
      },
      getReviewForWeek: (weekStartIso) => get().reviews.find((review) => review.weekStartIso === weekStartIso),
      setWeeklyReviews: (reviews) =>
        set({
          reviews: sortReviews(reviews),
        }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        reviews: state.reviews,
      }),
      migrate: (persistedState) => coercePersistedState(persistedState),
    },
  ),
);
