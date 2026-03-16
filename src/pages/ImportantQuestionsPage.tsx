import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import {
  BookMarked,
  CheckCircle2,
  Circle,
  Edit,
  Pin,
  PinOff,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useImportantQuestionsStore } from "@/store/zustand/useImportantQuestionsStore";
import { ImportantQuestion, QuestionDifficulty, QuestionStatus } from "@/types/models";
import { ConfettiBurst } from "@/components/common/ConfettiBurst";
import { cn } from "@/lib/utils";

const difficultyOptions: Array<{ value: QuestionDifficulty; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const statusOptions: Array<{ value: QuestionStatus; label: string }> = [
  { value: "unsolved", label: "Unsolved" },
  { value: "attempted", label: "Attempted" },
  { value: "solved", label: "Solved" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alpha", label: "A–Z" },
  { value: "difficulty", label: "Difficulty" },
  { value: "status", label: "Status" },
] as const;

type SortOption = typeof sortOptions[number]["value"];

const difficultyWeight: Record<QuestionDifficulty, number> = {
  hard: 0,
  medium: 1,
  easy: 2,
};

const statusWeight: Record<QuestionStatus, number> = {
  unsolved: 0,
  attempted: 1,
  solved: 2,
};

const difficultyBadgeClass: Record<QuestionDifficulty, string> = {
  easy: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  medium: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  hard: "border-rose-400/40 bg-rose-500/15 text-rose-200",
};

const statusBadgeClass: Record<QuestionStatus, string> = {
  unsolved: "border-border/60 bg-background/70 text-muted-foreground",
  attempted: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  solved: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
};

const buildCsvRow = (values: string[]): string =>
  values
    .map((value) => `"${value.replace(/"/g, "\"\"")}"`)
    .join(",");

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const initialDraft = {
  questionText: "",
  subject: "",
  topic: "",
  difficulty: "medium" as QuestionDifficulty,
  notes: "",
  tagsInput: "",
};

export default function ImportantQuestionsPage() {
  const shouldReduceMotion = useReducedMotion();
  const { questions, addQuestion, updateQuestion, deleteQuestion, togglePin, setStatus } = useImportantQuestionsStore();

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pinPulseId, setPinPulseId] = useState<string | null>(null);
  const [statusPulseId, setStatusPulseId] = useState<string | null>(null);
  const [confettiId, setConfettiId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    questions.forEach((question) => {
      if (question.subject.trim()) {
        subjects.add(question.subject.trim());
      }
    });
    return Array.from(subjects).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const filtersActive = useMemo(
    () =>
      debouncedSearch.trim().length > 0 ||
      subjectFilter !== "all" ||
      difficultyFilter !== "all" ||
      statusFilter !== "all" ||
      sortOption !== "newest",
    [debouncedSearch, difficultyFilter, sortOption, statusFilter, subjectFilter],
  );

  const applyFilters = useCallback(
    (list: ImportantQuestion[]) => {
      const query = debouncedSearch.trim().toLowerCase();
      return list.filter((question) => {
        if (subjectFilter !== "all" && question.subject !== subjectFilter) {
          return false;
        }
        if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) {
          return false;
        }
        if (statusFilter !== "all" && question.status !== statusFilter) {
          return false;
        }
        if (query.length === 0) {
          return true;
        }
        const haystack = `${question.questionText} ${question.subject} ${question.topic} ${question.tags.join(" ")}`.toLowerCase();
        return haystack.includes(query);
      });
    },
    [debouncedSearch, difficultyFilter, statusFilter, subjectFilter],
  );

  const sortQuestions = useCallback(
    (list: ImportantQuestion[]) => {
      const sorted = [...list];
      sorted.sort((a, b) => {
        if (sortOption === "oldest") {
          return a.createdAt.localeCompare(b.createdAt);
        }
        if (sortOption === "alpha") {
          return a.questionText.localeCompare(b.questionText);
        }
        if (sortOption === "difficulty") {
          return difficultyWeight[a.difficulty] - difficultyWeight[b.difficulty];
        }
        if (sortOption === "status") {
          return statusWeight[a.status] - statusWeight[b.status];
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
      return sorted;
    },
    [sortOption],
  );

  const filteredQuestions = useMemo(() => sortQuestions(applyFilters(questions)), [applyFilters, questions, sortQuestions]);

  const pinnedQuestions = filteredQuestions.filter((question) => question.isPinned);
  const unpinnedQuestions = filteredQuestions.filter((question) => !question.isPinned);

  const openNewDialog = () => {
    setEditingId(null);
    setDraft(initialDraft);
    setErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (question: ImportantQuestion) => {
    setEditingId(question.id);
    setDraft({
      questionText: question.questionText,
      subject: question.subject,
      topic: question.topic,
      difficulty: question.difficulty,
      notes: question.notes,
      tagsInput: question.tags.join(", "),
    });
    setErrors({});
    setDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateTagsInput = (value: string) => {
    setDraft((prev) => ({ ...prev, tagsInput: value }));
  };

  const parsedTags = useMemo(() => {
    const tags = draft.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 10)
      .map((tag) => tag.slice(0, 30));
    return Array.from(new Set(tags));
  }, [draft.tagsInput]);

  const removeTag = (tag: string) => {
    const next = parsedTags.filter((item) => item !== tag);
    updateTagsInput(next.join(", "));
  };

  const validateDraft = () => {
    const nextErrors: Record<string, string> = {};
    if (!draft.questionText.trim()) {
      nextErrors.questionText = "Question text is required.";
    }
    if (!draft.subject.trim()) {
      nextErrors.subject = "Subject is required.";
    }
    if (!draft.topic.trim()) {
      nextErrors.topic = "Topic is required.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveDraft = () => {
    if (!validateDraft()) {
      return;
    }

    const payload = {
      questionText: draft.questionText.trim(),
      subject: draft.subject.trim(),
      topic: draft.topic.trim(),
      difficulty: draft.difficulty,
      notes: draft.notes.trim(),
      tags: parsedTags,
    };

    if (editingId) {
      updateQuestion(editingId, payload);
    } else {
      addQuestion(payload);
    }

    setDialogOpen(false);
  };

  const handleSetStatus = (questionId: string, status: QuestionStatus) => {
    setStatus(questionId, status);
    setStatusPulseId(questionId);
    if (status === "solved") {
      setConfettiId(questionId);
    }
    window.setTimeout(() => setStatusPulseId((current) => (current === questionId ? null : current)), 400);
  };

  const handlePinToggle = (questionId: string) => {
    togglePin(questionId);
    setPinPulseId(questionId);
    window.setTimeout(() => setPinPulseId((current) => (current === questionId ? null : current)), 400);
  };

  const exportQuestions = (format: "json" | "csv") => {
    const exportList = filtersActive ? filteredQuestions : questions;
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const payload = {
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        questions: exportList,
      };
      downloadFile(JSON.stringify(payload, null, 2), `important-questions-${date}.json`, "application/json");
      return;
    }

    const header = [
      "id",
      "questionText",
      "subject",
      "topic",
      "difficulty",
      "status",
      "notes",
      "isPinned",
      "tags",
      "createdAt",
      "updatedAt",
      "solvedAt",
    ];

    const rows = exportList.map((question) =>
      buildCsvRow([
        question.id,
        question.questionText,
        question.subject,
        question.topic,
        question.difficulty,
        question.status,
        question.notes,
        String(question.isPinned),
        question.tags.join("|"),
        question.createdAt,
        question.updatedAt,
        question.solvedAt ?? "",
      ]),
    );

    const csv = [buildCsvRow(header), ...rows].join("\n");
    downloadFile(csv, `important-questions-${date}.csv`, "text/csv");
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Important Questions</h1>
          <p className="text-sm text-muted-foreground">Capture and organize your most important problems.</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(160px,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions…"
            className="pl-9"
          />
        </div>

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {uniqueSubjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {difficultyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sort</span>
        <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
          <SelectTrigger className="max-w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {questions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/50 p-10 text-center"
        >
          <div className="rounded-2xl bg-muted/60 p-4">
            <BookMarked className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No questions saved yet</p>
          <p className="text-xs text-muted-foreground/70">Add your first important question to begin.</p>
          <Button onClick={openNewDialog} className="mt-2">
            Add Question
          </Button>
        </motion.div>
      ) : (
        <>
          {pinnedQuestions.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pinned
              </div>
              <motion.div
                layout={!shouldReduceMotion}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-4 md:grid-cols-2 thin-scrollbar"
              >
                {pinnedQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    expanded={expandedIds.has(question.id)}
                    onToggleExpand={() => toggleExpanded(question.id)}
                    onEdit={() => openEditDialog(question)}
                    onDelete={() => deleteQuestion(question.id)}
                    onTogglePin={() => handlePinToggle(question.id)}
                    onSetStatus={handleSetStatus}
                    pinPulse={pinPulseId === question.id}
                    statusPulse={statusPulseId === question.id}
                    confettiActive={confettiId === question.id}
                    onConfettiDone={() => setConfettiId((current) => (current === question.id ? null : current))}
                    variants={itemVariants}
                    reduceMotion={shouldReduceMotion}
                  />
                ))}
              </motion.div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              All Questions
            </div>
            <motion.div
              layout={!shouldReduceMotion}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 md:grid-cols-2 thin-scrollbar"
            >
              {unpinnedQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  expanded={expandedIds.has(question.id)}
                  onToggleExpand={() => toggleExpanded(question.id)}
                  onEdit={() => openEditDialog(question)}
                  onDelete={() => deleteQuestion(question.id)}
                  onTogglePin={() => handlePinToggle(question.id)}
                  onSetStatus={handleSetStatus}
                  pinPulse={pinPulseId === question.id}
                  statusPulse={statusPulseId === question.id}
                  confettiActive={confettiId === question.id}
                  onConfettiDone={() => setConfettiId((current) => (current === question.id ? null : current))}
                  variants={itemVariants}
                  reduceMotion={shouldReduceMotion}
                />
              ))}
            </motion.div>
          </section>
        </>
      )}

      {questions.length > 0 ? (
        <section className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Export</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            >
              <Button variant="outline" onClick={() => exportQuestions("json")}>
                Export as JSON
              </Button>
            </motion.div>
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            >
              <Button variant="outline" onClick={() => exportQuestions("csv")}>
                Export as CSV
              </Button>
            </motion.div>
          </div>
        </section>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>{editingId ? "Update Question" : "Save Question"}</DialogTitle>
            <DialogDescription>
              Capture the question, its context, and your notes so you can revisit later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Question Text
              </label>
              <Textarea
                rows={5}
                value={draft.questionText}
                onChange={(event) => setDraft((prev) => ({ ...prev, questionText: event.target.value }))}
                maxLength={2000}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{errors.questionText}</span>
                <span>{draft.questionText.length}/2000</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Subject
                </label>
                <Input
                  value={draft.subject}
                  onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                  maxLength={80}
                />
                <span className="text-xs text-rose-300">{errors.subject}</span>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Topic
                </label>
                <Input
                  value={draft.topic}
                  onChange={(event) => setDraft((prev) => ({ ...prev, topic: event.target.value }))}
                  maxLength={80}
                />
                <span className="text-xs text-rose-300">{errors.topic}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Difficulty
              </label>
              <Select
                value={draft.difficulty}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, difficulty: value as QuestionDifficulty }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {difficultyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Tags
              </label>
              <Input
                value={draft.tagsInput}
                onChange={(event) => updateTagsInput(event.target.value)}
                placeholder="comma-separated tags"
                maxLength={320}
              />
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {parsedTags.map((tag) => (
                    <motion.span
                      key={tag}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                        ×
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Notes
              </label>
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                maxLength={1000}
              />
              <div className="flex items-center justify-end text-xs text-muted-foreground">
                <span>{draft.notes.length}/1000</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>{editingId ? "Update Question" : "Save Question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionCard({
  question,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onTogglePin,
  onSetStatus,
  pinPulse,
  statusPulse,
  confettiActive,
  onConfettiDone,
  variants,
  reduceMotion,
}: {
  question: ImportantQuestion;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSetStatus: (id: string, status: QuestionStatus) => void;
  pinPulse: boolean;
  statusPulse: boolean;
  confettiActive: boolean;
  onConfettiDone: () => void;
  variants: Record<string, unknown>;
  reduceMotion: boolean;
}) {
  const StatusIcon = question.status === "solved" ? CheckCircle2 : Circle;
  const pinIcon = question.isPinned ? PinOff : Pin;

  return (
    <motion.div
      layout={!reduceMotion}
      layoutId={reduceMotion ? undefined : `question-${question.id}`}
      variants={variants}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl border border-border/60 bg-card/85 p-4 shadow-soft"
    >
      <ConfettiBurst trigger={confettiActive} onComplete={onConfettiDone} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onTogglePin} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <motion.span
            animate={pinPulse && !reduceMotion ? { rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}
            className="inline-flex items-center justify-center rounded-full border border-border/60 p-1"
          >
            {pinIcon === PinOff ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </motion.span>
          <span className="text-xs">{question.subject} · {question.topic}</span>
        </button>
      </div>

      <motion.div
        animate={{ height: expanded ? "auto" : "4.5rem" }}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ overflow: "hidden" }}
        className="mt-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <p className={`text-sm leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{question.questionText}</p>
      </motion.div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-xs", difficultyBadgeClass[question.difficulty])}>
          {question.difficulty}
        </Badge>
        <motion.span
          animate={statusPulse && !reduceMotion ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
          <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-xs inline-flex items-center gap-1", statusBadgeClass[question.status])}>
            <StatusIcon className="h-3 w-3" />
            {question.status}
          </Badge>
        </motion.span>
        {question.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="rounded-full border-border/60 bg-background/70 px-2 py-0.5 text-xs">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSetStatus(question.id, "attempted")}
        >
          Mark Attempted
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSetStatus(question.id, "solved")}
        >
          Mark Solved
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Edit className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </motion.div>
  );
}
