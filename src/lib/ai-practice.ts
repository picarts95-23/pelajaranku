// Browser-safe helpers for the AI practice (Latihan AI) feature.
export type PracticeLevel = "dasar" | "menengah" | "mahir";
export type PracticeFile = { name: string; mime: string; dataUrl: string };
export type PracticeInput = {
  subject: string; topic: string; count: number; level: PracticeLevel; notes?: string; file?: PracticeFile;
};
export type PracticeQuestion = {
  stimulus: string; question: string; options: string[]; correctIndex: number;
  hints: string[]; explanation: string; steps: string[]; concept: string;
};

export const MAX_PRACTICE_COUNT = 20;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LEVEL_TO_DIFFICULTY = { dasar: "easy", menengah: "medium", mahir: "hard" } as const;

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

export function normalizePracticeQuestions(raw: unknown): PracticeQuestion[] {
  const list = (raw as { questions?: unknown[] })?.questions;
  if (!Array.isArray(list)) return [];
  const out: PracticeQuestion[] = [];
  for (const r of list as any[]) {
    const options = Array.isArray(r?.options) ? r.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    const ci = Number(r?.correctIndex);
    if (!r?.question || options.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= options.length) continue;
    out.push({
      stimulus: String(r.stimulus ?? "").trim(),
      question: String(r.question).trim(),
      options,
      correctIndex: ci,
      hints: Array.isArray(r.hints) ? r.hints.map(String).filter(Boolean).slice(0, 3) : [],
      explanation: String(r.explanation ?? "").trim(),
      steps: Array.isArray(r.steps) ? r.steps.map(String).filter(Boolean) : [],
      concept: String(r.concept ?? "").trim(),
    });
  }
  return out;
}

/** Score earned for one question: hints used reduce the points (100 → 75 → 50 → 25), wrong = 0. */
export function practicePoints(correct: boolean, hintsUsed: number): number {
  if (!correct) return 0;
  return Math.max(25, 100 - 25 * Math.max(0, hintsUsed));
}
