import { test, expect } from "bun:test";
import { computeTpRecap, finalScore, validateWeights } from "./tp-recap.ts";

test("weights must total 100, no fixed 70/20/10", () => {
  expect(validateWeights({ sumatif: 50, adab: 25, absensi: 25 })).toBe(null);
  expect(validateWeights({ sumatif: 70, adab: 20, absensi: 20 })).not.toBe(null);
});

test("final score uses school weights", () => {
  expect(finalScore({ sumatif: 80, adab: 100, absensi: 60 }, { sumatif: 50, adab: 25, absensi: 25 })).toBe(80);
});

test("formatif never enters final grade; sumatif averaged per TP", () => {
  const rows = computeTpRecap({
    students: [{ id: "s", full_name: "Ali" }],
    objectives: [{ id: "t1", code: "TP1", description: "Menjelaskan fotosintesis" }, { id: "t2", code: "TP2", description: "Menghitung luas" }],
    assignments: [
      { id: "a", objective_id: "t1", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 90, status: "graded" }] },
      { id: "b", objective_id: "t1", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 70, status: "graded" }] },
      { id: "c", objective_id: "t2", assessment_kind: "sumatif", max_score: 50, submissions: [{ student_id: "s", score: 30, status: "graded" }] },
      { id: "d", objective_id: "t2", assessment_kind: "formatif", max_score: 100, submissions: [{ student_id: "s", score: 0, status: "graded", feedback: "Ulangi" }] },
    ],
    attendance: [], adab: [], weights: { sumatif: 60, adab: 20, absensi: 20 },
  });
  expect(rows[0].perTp).toEqual({ t1: 80, t2: 60 });
  expect(rows[0].sumatif).toBe(70);
  expect(rows[0].final).toBe(70);
  expect(rows[0].formatif.lastFeedback).toBe("Ulangi");
  expect(rows[0].description).toContain("perlu bimbingan dalam menghitung luas");
});
