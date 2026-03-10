import type { ExtractedQuestionPayload, QuestionRecord } from "@/question-solver/types/questionTypes";

export interface ExtractQuestionResponse {
  ok: boolean;
  error?: string;
  imageUrl?: string;
  imageHash?: string;
  extracted?: ExtractedQuestionPayload;
  cachedQuestion?: QuestionRecord | null;
}

export async function extractQuestion(
  profileId: string,
  imageDataUrl: string,
  fileName: string,
  contentType: string,
): Promise<ExtractQuestionResponse> {
  const response = await fetch("/api/extract-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, imageDataUrl, fileName, contentType }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ExtractQuestionResponse | null;
    return payload ?? { ok: false, error: "Unable to extract text from image. Please upload a clearer screenshot." };
  }

  return (await response.json()) as ExtractQuestionResponse;
}
