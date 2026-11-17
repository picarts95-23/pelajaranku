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
