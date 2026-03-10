import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, RefreshCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { ExportDataButton } from "@/components/ExportDataButton";
import { extractQuestion } from "@/question-solver/api/extract-question";
import { solveQuestion } from "@/question-solver/api/solve-question";
import { fetchQuestions } from "@/question-solver/database/questionStorage";
import type { ExtractedQuestionPayload, QuestionRecord } from "@/question-solver/types/questionTypes";

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read image."));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });

export function QuestionSolver() {
  const { activeProfile } = useAppStore();
  const profileId = activeProfile?.id ?? "default";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedQuestionPayload | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [error, setError] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    fetchQuestions(profileId).then((payload) => {
      if (mounted) {
        setQuestions(payload.questions);
      }
    });
    return () => {
      mounted = false;
    };
  }, [profileId]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelected = useCallback(
    (file: File | null) => {
      if (!file) {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        setExtracted(null);
        setAnswer("");
        setError("");
        setImageHash(null);
        setImageUrl(null);
        return;
      }
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtracted(null);
      setAnswer("");
      setError("");
      setImageHash(null);
      setImageUrl(null);
    },
    [previewUrl],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFileSelected(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleSolve = async () => {
    if (!activeProfile) {
      setError("Please select a profile first.");
      return;
    }

    setError("");
    setIsExtracting(true);

    try {
      let extractedPayload = extracted;
      let currentImageUrl = imageUrl;
      let currentImageHash = imageHash;

      if (!extractedPayload) {
        if (!selectedFile) {
          setError("Upload a screenshot to solve.");
          return;
        }
        const dataUrl = await readFileAsDataUrl(selectedFile);
        const result = await extractQuestion(
          profileId,
          dataUrl,
          selectedFile.name,
          selectedFile.type || "image/png",
        );
        if (!result.ok) {
          setError(result.error ?? "Unable to extract text from image. Please upload a clearer screenshot.");
          return;
        }
        extractedPayload = result.extracted ?? null;
        currentImageUrl = result.imageUrl ?? null;
        currentImageHash = result.imageHash ?? null;

        if (result.cachedQuestion) {
          setExtracted(result.cachedQuestion.extracted_question);
          setAnswer(result.cachedQuestion.deepseek_answer);
          setImageHash(result.cachedQuestion.image_hash);
          setImageUrl(result.cachedQuestion.image_url);
          return;
        }

        setExtracted(extractedPayload);
        setImageHash(currentImageHash);
        setImageUrl(currentImageUrl);
      }

      if (!extractedPayload || !currentImageUrl || !currentImageHash) {
        setError("Unable to solve without extracted question data.");
        return;
      }

      setIsSolving(true);
      const solved = await solveQuestion(profileId, extractedPayload, currentImageUrl, currentImageHash);
      if (!solved.ok) {
        setError(solved.error ?? "Unable to solve the question right now.");
        return;
      }

      if (solved.record) {
        setAnswer(solved.record.deepseek_answer);
      } else if (solved.answer) {
        setAnswer(solved.answer);
      }

      const refreshed = await fetchQuestions(profileId);
      setQuestions(refreshed.questions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to solve the question right now.";
      setError(message);
    } finally {
      setIsExtracting(false);
      setIsSolving(false);
    }
  };

  const handleRedo = (question: QuestionRecord) => {
    setSelectedFile(null);
    setPreviewUrl(question.image_url);
    setExtracted(question.extracted_question);
    setAnswer("");
    setError("");
    setImageHash(question.image_hash);
    setImageUrl(question.image_url);
  };

  const toggleAnswer = (id: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const previousQuestions = useMemo(
    () => questions.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [questions],
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4" />
            Screenshot Question Solver
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-2xl border border-dashed border-border/70 bg-background/65 p-6 text-center text-sm text-muted-foreground"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <p className="mb-2">Drag and drop a screenshot here</p>
            <Button type="button" variant="outline" onClick={() => document.getElementById("question-upload")?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Screenshot
            </Button>
            <input
              id="question-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
            />
          </div>

          {previewUrl ? (
            <div className="rounded-2xl border border-border/60 bg-background/65 p-3">
              <img src={previewUrl} alt="Uploaded preview" className="max-h-[320px] w-full rounded-xl object-contain" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSolve} disabled={isExtracting || isSolving}>
              {isExtracting || isSolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSolving ? "Solving..." : "Solve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleFileSelected(null)}
              disabled={!selectedFile && !extracted}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Detected Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {extracted ? (
              <>
                <p className="whitespace-pre-wrap text-foreground">{extracted.extracted_text}</p>
                <div className="rounded-xl border border-border/60 bg-background/65 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Diagram</p>
                  <p className="mt-1 text-sm text-foreground">{extracted.diagram_description}</p>
                </div>
              </>
            ) : (
              <p>No question extracted yet. Upload a screenshot and click Solve.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">AI Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {answer ? <p className="whitespace-pre-wrap text-foreground">{answer}</p> : <p>No answer yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Previous Questions</CardTitle>
          <ExportDataButton profileId={profileId} />
        </CardHeader>
        <CardContent className="space-y-3">
          {previousQuestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              No solved questions yet.
            </p>
          ) : (
            previousQuestions.map((question) => (
              <div key={question.id} className="rounded-xl border border-border/60 bg-background/65 p-3">
                <p className="text-sm font-medium text-foreground">{question.extracted_question.extracted_text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleRedo(question)}>
                    Redo Question
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAnswer(question.id)}>
                    {revealedAnswers.has(question.id) ? "Hide Answer" : "Show Answer"}
                  </Button>
                </div>
                {revealedAnswers.has(question.id) ? (
                  <div className="mt-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground">
                    {question.deepseek_answer}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
