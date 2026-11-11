import { test, expect } from "bun:test";
import { adabRowsFromDraft, computeTpRecap, finalScore, validateWeights } from "./tp-recap.ts";

const adabFixture = {
  students: [{ id: "s", full_name: "Ali" }],
  objectives: [{ id: "t", code: "TP1", description: "Memahami materi" }],
  assignments: [{ id: "a", objective_id: "t", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 90, status: "graded" }] }],
  attendance: [{ student_id: "s", status: "hadir" }],
  weights: { sumatif: 60, adab: 20, absensi: 20 },
};

test("missing or blank teacher Adab is omitted from recap and save rows", () => {
  for (const draft of [{}, { s: "" }]) {
    const adab = adabRowsFromDraft(adabFixture.students, draft);
    expect(adab).toEqual([]);
    const teacher = computeTpRecap({ ...adabFixture, adab })[0];
    expect(teacher.adab).toBe(null);
    expect(teacher.final).toBe(92.5);
    expect(teacher.predikat).toBe("A");
    expect(teacher).toEqual(computeTpRecap({ ...adabFixture, adab: [] })[0]);
  }
});

test("explicit Adab zero remains a scored component", () => {
  const adab = adabRowsFromDraft(adabFixture.students, { s: 0 });
  expect(adab).toEqual([{ student_id: "s", score: 0 }]);
  const row = computeTpRecap({ ...adabFixture, adab })[0];
  expect(row.adab).toBe(0);
  expect(row.final).toBe(74);
  expect(row.predikat).toBe("C");
});

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

import { tpShares, validateTpWeights } from "./tp-recap.ts";
test("multi-TP UTS splits proportionally into each TP", () => {
  expect(tpShares({ objective_id: "t1", objective_weights: { t1: 40, t2: 60 } })).toEqual({ t1: 0.4, t2: 0.6 });
  expect(validateTpWeights({ t1: 40, t2: 50 })).not.toBe(null);
  const rows = computeTpRecap({
    students: [{ id: "s", full_name: "A" }],
    objectives: [{ id: "t1", code: "1", description: "X" }, { id: "t2", code: "2", description: "Y" }],
    assignments: [
      { id: "h", objective_id: "t1", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 100, status: "graded" }] },
      { id: "u", objective_id: "t1", objective_weights: { t1: 25, t2: 75 }, assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 60, status: "graded" }] },
    ],
    attendance: [], adab: [], weights: { sumatif: 100, adab: 0, absensi: 0 },
  });
  expect(rows[0].perTp.t1).toBe(92); // (100*1 + 60*0.25)/1.25
  expect(rows[0].perTp.t2).toBe(60);
});
