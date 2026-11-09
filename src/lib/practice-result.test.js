import { describe, expect, it } from "bun:test";
import { buildPracticeResult } from "./practice-result";

const questions = [
  { stimulus: "", question: "2+2?", options: ["3", "4"], correctIndex: 1, hints: [], explanation: "Jumlahkan.", steps: [], concept: "Penjumlahan" },
  { stimulus: "", question: "5-3?", options: ["2", "3"], correctIndex: 0, hints: [], explanation: "Kurangkan.", steps: [], concept: "Pengurangan" },
];

describe("AI practice result", () => {
  it("stores the calculated score and feedback instead of trusting a client score", () => {
    const result = buildPracticeResult(questions, [{ chosen: 1, correct: true, hints: 0 }, { chosen: 1, correct: false, hints: 1 }]);
    expect(result.score).toBe(50);
    expect(result.correctCount).toBe(1);
    expect(result.weakConcepts).toEqual(["Pengurangan"]);
    expect(result.feedback).toContain("Konsep yang perlu diulang: Pengurangan");
  });

  it("rejects incomplete attempts so no partial grade or journal is saved", () => {
    expect(() => buildPracticeResult(questions, [{ chosen: 1, correct: true, hints: 0 }])).toThrow("Jawaban latihan belum lengkap.");
  });
});
