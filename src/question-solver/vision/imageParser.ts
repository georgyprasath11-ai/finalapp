import type { ExtractedNumber, ExtractedQuestionPayload } from "@/question-solver/types/questionTypes";

const UNIT_PATTERN = /(ohm|Ω|volt|v|amp|a|kg|g|m|cm|mm|km|s|ms|hz|°c|°f|%|w|j|n|pa|kpa)/i;

const extractNumbersWithUnits = (text: string): ExtractedNumber[] => {
  const results: ExtractedNumber[] = [];
  const regex = /(-?\d+(?:\.\d+)?)(?:\s*([a-zA-ZΩ°%]+))?/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(text)) !== null) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) {
      continue;
    }
    const rawUnit = match[2] ?? "";
    const unit = UNIT_PATTERN.test(rawUnit) ? rawUnit : "";
    results.push({ value, unit });
  }
  return results;
};

const extractLabels = (text: string): string[] => {
  const labels = new Set<string>();
  const labelRegex = /\b([A-Z]{1,3}\d?)\b/g;
  let match: RegExpExecArray | null = null;
  while ((match = labelRegex.exec(text)) !== null) {
    labels.add(match[1]);
  }
  return Array.from(labels);
};

const inferDiagramDescription = (text: string): string => {
  const lower = text.toLowerCase();
  const clues = [];
  if (lower.includes("circuit") || lower.includes("resistor") || lower.includes("ohm")) {
    clues.push("an electrical circuit");
  }
  if (lower.includes("graph") || lower.includes("plot")) {
    clues.push("a plotted graph");
  }
  if (lower.includes("diagram") || lower.includes("figure")) {
    clues.push("a labeled diagram");
  }
  if (lower.includes("triangle") || lower.includes("angle")) {
    clues.push("a geometric diagram");
  }
  if (clues.length === 0) {
    return "No explicit diagram description detected from text.";
  }
  return `The prompt references ${clues.join(", ")}. Labels and values appear in the extracted text.`;
};

export const parseTextToQuestionPayload = (text: string): ExtractedQuestionPayload => {
  const extractedText = text.trim();
  return {
    extracted_text: extractedText,
    numbers: extractNumbersWithUnits(extractedText),
    diagram_description: inferDiagramDescription(extractedText),
    labels: extractLabels(extractedText),
  };
};

export const parseImageFile = async (file: File): Promise<ExtractedQuestionPayload> => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(file);
    const extractedText = result.data.text ?? "";
    if (!extractedText.trim()) {
      throw new Error("Unable to extract text from image. Please upload a clearer screenshot.");
    }
    return parseTextToQuestionPayload(extractedText);
  } finally {
    await worker.terminate();
  }
};
