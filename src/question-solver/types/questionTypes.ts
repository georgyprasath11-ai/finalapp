export interface ExtractedNumber {
  value: number;
  unit: string;
}

export interface ExtractedQuestionPayload {
  extracted_text: string;
  numbers: ExtractedNumber[];
  diagram_description: string;
  labels: string[];
}

export interface QuestionRecord {
  id: string;
  image_url: string;
  extracted_question: ExtractedQuestionPayload;
  deepseek_answer: string;
  created_at: string;
  image_hash: string;
}

export interface QuestionListResponse {
  questions: QuestionRecord[];
}
