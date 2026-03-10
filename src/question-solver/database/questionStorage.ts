import type { QuestionListResponse } from "@/question-solver/types/questionTypes";

export async function fetchQuestions(profileId: string): Promise<QuestionListResponse> {
  const response = await fetch(`/api/questions?profileId=${encodeURIComponent(profileId)}`);
  if (!response.ok) {
    return { questions: [] };
  }
  return (await response.json()) as QuestionListResponse;
}

export async function exportAllQuestions(profileId: string): Promise<Blob | null> {
  const response = await fetch(`/api/export-data?profileId=${encodeURIComponent(profileId)}`);
  if (!response.ok) {
    return null;
  }
  return await response.blob();
}
