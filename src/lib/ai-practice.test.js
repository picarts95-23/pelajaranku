import { test, expect } from "bun:test";
import { parsePracticeInput, normalizePracticeQuestions, practicePoints, isPracticeAnswerComplete, isPracticeAnswerCorrect } from "./ai-practice.ts";

test("question count is capped at 20 and defaults level to menengah", () => {
  const r = parsePracticeInput({ subject: "IPA", topic: "Fotosintesis", count: 99, level: "x" });
  expect(r.count).toBe(20);
  expect(r.level).toBe("menengah");
});

test("subject and topic are required", () => {
  expect(() => parsePracticeInput({ subject: "", topic: "a" })).toThrow();
});

test("questions with an invalid answer index are dropped", () => {
  const out = normalizePracticeQuestions({ questions: [
    { question: "a", options: ["1", "2"], correctIndex: 5 },
    { question: "b", options: ["1", "2"], correctIndex: 1, hints: ["h1", "h2", "h3", "h4"] },
  ] });
  expect(out.length).toBe(1);
  expect(out[0].hints.length).toBe(3);
});

test("each hint used lowers the points; wrong answers score 0", () => {
  expect(practicePoints(true, 0)).toBe(100);
  expect(practicePoints(true, 2)).toBe(50);
  expect(practicePoints(true, 3)).toBe(25);
  expect(practicePoints(false, 0)).toBe(0);
});

const literacyQuestions = normalizePracticeQuestions({ questions: [
  { type: "multiple_choice", question: "Satu jawaban", options: ["A", "B", "C", "D"], correctIndex: 2 },
  { type: "complex_multiple_choice", question: "Lebih dari satu jawaban", options: ["A", "B", "C", "D"], correctIndices: [0, 3] },
  { type: "statement_table", question: "Nilai setiap pernyataan", statements: [{ text: "Pernyataan satu", answer: true }, { text: "Pernyataan dua", answer: false }, { text: "Pernyataan tiga", answer: true }] },
] });

test("all three Literacy forms survive AI response normalization", () => {
  expect(literacyQuestions.map((q) => q.type)).toEqual(["multiple_choice", "complex_multiple_choice", "statement_table"]);
  expect(literacyQuestions[2].statements.length).toBe(3);
});

test("complex multiple choice requires every correct option and no extra option", () => {
  const question = literacyQuestions[1];
  expect(isPracticeAnswerCorrect(question, [3, 0])).toBe(true);
  expect(isPracticeAnswerCorrect(question, [0])).toBe(false);
  expect(isPracticeAnswerCorrect(question, [0, 1, 3])).toBe(false);
});

test("statement tables require one Benar/Salah choice for every row", () => {
  const question = literacyQuestions[2];
  expect(isPracticeAnswerComplete(question, [true, false])).toBe(false);
  expect(isPracticeAnswerComplete(question, [true, null, true])).toBe(false);
  expect(isPracticeAnswerComplete(question, [true, false, true])).toBe(true);
  expect(isPracticeAnswerCorrect(question, [true, false, true])).toBe(true);
  expect(isPracticeAnswerCorrect(question, [true, true, true])).toBe(false);
});

test("complex questions need at least two valid correct indices", () => {
  const result = normalizePracticeQuestions({ questions: [
    { type: "complex_multiple_choice", question: "Tidak valid", options: ["A", "B"], correctIndices: [1] },
  ] });
  expect(result).toEqual([]);
});
