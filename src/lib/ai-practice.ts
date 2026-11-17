// Browser-safe helpers for the AI practice (Latihan AI) feature.
export type PracticeLevel = "dasar" | "menengah" | "mahir";
export type PracticeQuestionType = "multiple_choice" | "complex_multiple_choice" | "statement_table";
export type PracticeFile = { name: string; mime: string; dataUrl: string };
export type PracticeInput = {
  subject: string; topic: string; count: number; level: PracticeLevel; notes?: string; file?: PracticeFile;
};
export type PracticeStatement = { text: string; answer: boolean };
export type PracticeAnswerValue = number | number[] | boolean[];
export type PracticeQuestion = {
  type: PracticeQuestionType;
  stimulus: string; question: string;
  options: string[]; correctIndex: number; correctIndices: number[];
  statements: PracticeStatement[];
  hints: string[]; explanation: string; steps: string[]; concept: string;
};

export const MAX_PRACTICE_COUNT = 20;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LEVEL_TO_DIFFICULTY = { dasar: "easy", menengah: "medium", mahir: "hard" } as const;
export const PRACTICE_TYPE_LABEL: Record<PracticeQuestionType, string> = {
  multiple_choice: "Pilihan Ganda",
  complex_multiple_choice: "Pilihan Ganda Kompleks",
  statement_table: "Tabel Pernyataan",
};

export function parsePracticeInput(input: unknown): PracticeInput {
  const d = (input ?? {}) as Partial<PracticeInput>;
  const subject = String(d.subject ?? "").trim().slice(0, 100);
  const topic = String(d.topic ?? "").trim().slice(0, 200);
  if (!subject || !topic) throw new Error("Mata pelajaran dan topik wajib diisi.");
  const count = Math.min(MAX_PRACTICE_COUNT, Math.max(1, Math.round(Number(d.count) || 5)));
  const level: PracticeLevel = d.level === "dasar" || d.level === "mahir" ? d.level : "menengah";
  const notes = d.notes ? String(d.notes).slice(0, 8000) : undefined;
  let file: PracticeFile | undefined;
  if (d.file && typeof d.file.dataUrl === "string") {
    const mime = String(d.file.mime ?? "");
    if (!/^image\/|^application\/pdf$/.test(mime)) throw new Error("Lampiran harus berupa gambar atau PDF.");
    if (d.file.dataUrl.length > MAX_FILE_BYTES * 1.4) throw new Error("Lampiran maksimal 5 MB.");
    file = { name: String(d.file.name ?? "materi").slice(0, 120), mime, dataUrl: d.file.dataUrl };
  }
  return { subject, topic, count, level, notes, file };
}

function text(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function validType(value: unknown): PracticeQuestionType {
  return value === "complex_multiple_choice" || value === "statement_table" ? value : "multiple_choice";
}

export function normalizePracticeQuestions(raw: unknown): PracticeQuestion[] {
  const list = (raw as { questions?: unknown[] })?.questions;
  if (!Array.isArray(list)) return [];
  const out: PracticeQuestion[] = [];
  for (const r of list as any[]) {
    const question = text(r?.question);
    if (!question) continue;
    const type = validType(r?.type);
    const options = Array.isArray(r?.options)
      ? r.options.map((o: unknown) => text(o, 1000)).filter(Boolean).slice(0, 8)
      : [];
    const common = {
      type,
      stimulus: text(r?.stimulus, 10000),
      question,
      hints: Array.isArray(r?.hints) ? r.hints.map((h: unknown) => text(h, 1000)).filter(Boolean).slice(0, 3) : [],
      explanation: text(r?.explanation, 6000),
      steps: Array.isArray(r?.steps) ? r.steps.map((s: unknown) => text(s, 2000)).filter(Boolean).slice(0, 6) : [],
      concept: text(r?.concept, 200),
    };

    if (type === "statement_table") {
      const statements = Array.isArray(r?.statements)
        ? r.statements.slice(0, 6).map((s: any) => ({
          text: text(s?.text ?? s?.statement, 2000),
          answer: typeof s?.answer === "boolean" ? s.answer : null,
        }))
        : [];
      if (statements.length < 2 || statements.some((s) => !s.text || typeof s.answer !== "boolean")) continue;
      out.push({ ...common, options: [], correctIndex: -1, correctIndices: [], statements: statements as PracticeStatement[] });
      continue;
    }

    if (options.length < 2) continue;
    if (type === "complex_multiple_choice") {
      const correctIndices = Array.isArray(r?.correctIndices)
        ? [...new Set(r.correctIndices.map(Number).filter((i: number) => Number.isInteger(i) && i >= 0 && i < options.length))].sort((a, b) => a - b)
        : [];
      if (correctIndices.length < 2) continue;
      out.push({ ...common, options, correctIndex: -1, correctIndices, statements: [] });
      continue;
    }

    const correctIndex = Number(r?.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) continue;
    out.push({ ...common, options, correctIndex, correctIndices: [correctIndex], statements: [] });
  }
  return out;
}

export function isPracticeAnswerComplete(question: PracticeQuestion, answer: unknown): answer is PracticeAnswerValue {
  if (question.type === "multiple_choice") {
    return Number.isInteger(answer) && Number(answer) >= 0 && Number(answer) < question.options.length;
  }
  if (question.type === "complex_multiple_choice") {
    return Array.isArray(answer) && answer.length > 0
      && answer.every((i) => Number.isInteger(i) && i >= 0 && i < question.options.length)
      && new Set(answer).size === answer.length;
  }
  return Array.isArray(answer) && answer.length === question.statements.length
    && answer.every((value) => typeof value === "boolean");
}

export function isPracticeAnswerCorrect(question: PracticeQuestion, answer: unknown): boolean {
  if (!isPracticeAnswerComplete(question, answer)) return false;
  if (question.type === "multiple_choice") return answer === question.correctIndex;
  if (question.type === "complex_multiple_choice") {
    const chosen = [...(answer as number[])].sort((a, b) => a - b);
    return chosen.length === question.correctIndices.length
      && chosen.every((value, index) => value === question.correctIndices[index]);
  }
  return (answer as boolean[]).every((value, index) => value === question.statements[index].answer);
}

export function practiceCorrectAnswer(question: PracticeQuestion): string {
  if (question.type === "multiple_choice") {
    return `${String.fromCharCode(65 + question.correctIndex)}. ${question.options[question.correctIndex]}`;
  }
  if (question.type === "complex_multiple_choice") {
    return question.correctIndices.map((index) => `${String.fromCharCode(65 + index)}. ${question.options[index]}`).join("; ");
  }
  return question.statements.map((statement, index) => `${index + 1}: ${statement.answer ? "Benar" : "Salah"}`).join("; ");
}

/** Score earned for one question: hints used reduce the points (100 → 75 → 50 → 25), wrong = 0. */
export function practicePoints(correct: boolean, hintsUsed: number): number {
  if (!correct) return 0;
  return Math.max(25, 100 - 25 * Math.max(0, hintsUsed));
}
