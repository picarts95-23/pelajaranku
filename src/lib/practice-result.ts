import { practicePoints, type PracticeLevel, type PracticeQuestion } from "./ai-practice";

export type PracticeAnswer = { chosen: number; correct: boolean; hints: number };
export type PracticeResultInput = {
  clientId: string;
  classId: string;
  subject: string;
  topic: string;
  level: PracticeLevel;
  questions: PracticeQuestion[];
  results: PracticeAnswer[];
};

export function buildPracticeResult(questions: PracticeQuestion[], results: PracticeAnswer[]) {
  if (!questions.length || questions.length > 20 || results.length !== questions.length) {
    throw new Error("Jawaban latihan belum lengkap.");
  }
  results.forEach((r, i) => {
    if (!Number.isInteger(r.chosen) || r.chosen < 0 || r.chosen >= questions[i].options.length) throw new Error("Pilihan jawaban tidak valid.");
    if (!Number.isInteger(r.hints) || r.hints < 0 || r.hints > 3) throw new Error("Jumlah petunjuk tidak valid.");
    if (r.correct !== (r.chosen === questions[i].correctIndex)) throw new Error("Hasil jawaban tidak valid.");
  });
  const total = results.reduce((sum, r) => sum + practicePoints(r.correct, r.hints), 0);
  const score = Math.round(total / questions.length);
  const correctCount = results.filter((r) => r.correct).length;
  const weakConcepts = [...new Set(questions.filter((_, i) => !results[i].correct).map((q) => q.concept.trim()).filter(Boolean))];
  const hintsUsed = results.reduce((sum, r) => sum + r.hints, 0);
  const feedback = weakConcepts.length
    ? `Latihan selesai dengan ${correctCount}/${questions.length} jawaban benar. Konsep yang perlu diulang: ${weakConcepts.join(", ")}. Gunakan pembahasan langkah demi langkah, lalu coba latihan serupa.`
    : `Latihan selesai dengan ${correctCount}/${questions.length} jawaban benar. Semua konsep pada latihan ini sudah dikuasai dengan baik.`;
  const answers = questions.map((q, i) => ({
    question: q.question,
    concept: q.concept,
    chosen: results[i].chosen,
    correct: results[i].correct,
    hints: results[i].hints,
    explanation: q.explanation,
    steps: q.steps,
  }));
  return { score, correctCount, weakConcepts, hintsUsed, feedback, answers };
}
