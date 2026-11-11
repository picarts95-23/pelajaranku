import { expect, test } from "bun:test";
import { computeTpRecap } from "./tp-recap.ts";
import { applyStudentProgress, buildDevelopmentSummary, cleanObjectiveScores } from "./student-progress.ts";

const objectives = [{ id: "t1", code: "TP1", description: "Memahami pecahan" }, { id: "t2", code: "TP2", description: "Menghitung luas" }];
const base = computeTpRecap({
  students: [{ id: "s", full_name: "Ali" }], objectives,
  assignments: [
    { id: "a", objective_id: "t1", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 80, status: "graded" }] },
    { id: "b", objective_id: "t2", assessment_kind: "sumatif", max_score: 100, submissions: [{ student_id: "s", score: 60, status: "graded" }] },
  ],
  attendance: [{ student_id: "s", status: "hadir" }], adab: [], weights: { sumatif: 60, adab: 20, absensi: 20 },
})[0];

test("manual grade edits one student and one TP, then recalculates the final grade", () => {
  const edited = applyStudentProgress(base, objectives, { student_id: "s", objective_scores: { t2: 90 } }, { sumatif: 60, adab: 20, absensi: 20 });
  expect(edited.perTp).toEqual({ t1: 80, t2: 90 });
  expect(edited.sumatif).toBe(85);
  expect(edited.final).toBe(87.5);
  expect(edited.description).toContain("menghitung luas");
});

test("blank manual values remove only their overrides and zero remains valid", () => {
  expect(cleanObjectiveScores({ t1: "", t2: 0 })).toEqual({ t2: 0 });
});

test("saved report description replaces the generated description", () => {
  const edited = applyStudentProgress(base, objectives, { student_id: "s", report_description: "Berkembang sangat baik." }, { sumatif: 60, adab: 20, absensi: 20 });
  expect(edited.description).toBe("Berkembang sangat baik.");
});

test("development notes include other grades, formative feedback and AI practice reviews", () => {
  const notes = buildDevelopmentSummary({ ...base, formatif: { count: 2, avg: 78, lastFeedback: "Perbaiki langkah" } }, [{ topic: "Pecahan", score: 90, feedback: "Kuasai pembilang", created_at: "2026-11-11" }]);
  expect(notes).toContain("rata-rata sumatif TP 70");
  expect(notes).toContain("Asesmen formatif: 2");
  expect(notes).toContain("Pecahan (90/100): Kuasai pembilang");
});
