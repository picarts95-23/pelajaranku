import { test, expect } from "bun:test";
import { normalizePracticeQuestions } from "./ai-practice.ts";
import { buildPracticeResult } from "./practice-result.ts";

const questions = normalizePracticeQuestions({ questions: [
  { type: "multiple_choice", question: "Pilih ibu kota Indonesia", options: ["Bandung", "Jakarta", "Surabaya", "Medan"], correctIndex: 1, concept: "Geografi" },
  { type: "complex_multiple_choice", question: "Pilih semua bilangan genap", options: ["2", "3", "4", "5"], correctIndices: [0, 2], concept: "Bilangan" },
  { type: "statement_table", question: "Tentukan Benar atau Salah", statements: [{ text: "Matahari terbit dari timur", answer: true }, { text: "Air membeku pada 100°C", answer: false }], concept: "IPA" },
] });

test("complex multiple choice accepts the complete key regardless of selection order", () => {
  const result = buildPracticeResult(questions, [
    { chosen: 1, correct: true, hints: 0 },
    { chosen: [2, 0], correct: true, hints: 0 },
    { chosen: [true, false], correct: true, hints: 0 },
  ]);
  expect(result.score).toBe(100);
  expect(result.correctCount).toBe(3);
  expect(result.answers[1].chosen).toEqual([2, 0]);
  expect(result.answers[2].type).toBe("statement_table");
});

test("an incomplete complex answer cannot be submitted as correct", () => {
  expect(() => buildPracticeResult(questions, [
    { chosen: 1, correct: true, hints: 0 },
    { chosen: [0], correct: true, hints: 0 },
    { chosen: [true, false], correct: true, hints: 0 },
  ])).toThrow("Hasil jawaban tidak valid");
});

test("every statement table row must have a boolean answer", () => {
  expect(() => buildPracticeResult(questions, [
    { chosen: 1, correct: true, hints: 0 },
    { chosen: [0, 2], correct: true, hints: 0 },
    { chosen: [true, null], correct: false, hints: 0 },
  ])).toThrow("Pilihan jawaban tidak valid atau belum lengkap");
});

test("a forged correct flag is rejected by server-side answer validation", () => {
  expect(() => buildPracticeResult(questions, [
    { chosen: 0, correct: true, hints: 0 },
    { chosen: [0, 2], correct: true, hints: 0 },
    { chosen: [true, false], correct: true, hints: 0 },
  ])).toThrow("Hasil jawaban tidak valid");
});
