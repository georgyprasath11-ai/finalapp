import type { ExtractedQuestionPayload, QuestionRecord } from "@/question-solver/types/questionTypes";

export interface SolveQuestionResponse {
  ok: boolean;
  error?: string;
  answer?: string;
  record?: QuestionRecord;
  cached?: boolean;
}

export async function solveQuestion(
  profileId: string,
  extracted: ExtractedQuestionPayload,
  imageUrl: string,
  imageHash: string,
): Promise<SolveQuestionResponse> {
  const response = await fetch("/api/solve-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, extracted, imageUrl, imageHash }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as SolveQuestionResponse | null;
    return payload ?? { ok: false, error: "Unable to solve the question right now." };
  }

  return (await response.json()) as SolveQuestionResponse;
}
