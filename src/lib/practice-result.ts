import {
  isPracticeAnswerComplete,
  isPracticeAnswerCorrect,
  practiceCorrectAnswer,
  practicePoints,
  type PracticeAnswerValue,
  type PracticeLevel,
  type PracticeQuestion,
} from "./ai-practice";

export type PracticeAnswer = { chosen: PracticeAnswerValue; correct: boolean; hints: number };
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
  results.forEach((result, index) => {
    const question = questions[index];
    if (!isPracticeAnswerComplete(question, result.chosen)) throw new Error("Pilihan jawaban tidak valid atau belum lengkap.");
    if (!Number.isInteger(result.hints) || result.hints < 0 || result.hints > 3) throw new Error("Jumlah petunjuk tidak valid.");
    if (result.correct !== isPracticeAnswerCorrect(question, result.chosen)) throw new Error("Hasil jawaban tidak valid.");
  });
  const total = results.reduce((sum, result) => sum + practicePoints(result.correct, result.hints), 0);
  const score = Math.round(total / questions.length);
  const correctCount = results.filter((result) => result.correct).length;
  const weakConcepts = [...new Set(questions.filter((_, index) => !results[index].correct).map((question) => question.concept.trim()).filter(Boolean))];
  const hintsUsed = results.reduce((sum, result) => sum + result.hints, 0);
  const feedback = weakConcepts.length
    ? `Latihan selesai dengan ${correctCount}/${questions.length} jawaban benar. Konsep yang perlu diulang: ${weakConcepts.join(", ")}. Gunakan pembahasan langkah demi langkah, lalu coba latihan serupa.`
    : `Latihan selesai dengan ${correctCount}/${questions.length} jawaban benar. Semua konsep pada latihan ini sudah dikuasai dengan baik.`;
  const answers = questions.map((question, index) => ({
    type: question.type,
    question: question.question,
    concept: question.concept,
    chosen: results[index].chosen,
    correctAnswer: practiceCorrectAnswer(question),
    statements: question.type === "statement_table" ? question.statements : undefined,
    correct: results[index].correct,
    hints: results[index].hints,
    explanation: question.explanation,
    steps: question.steps,
  }));
  return { score, correctCount, weakConcepts, hintsUsed, feedback, answers };
}
