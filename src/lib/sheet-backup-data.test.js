import { expect, test } from "bun:test";
import { requireStoredSpreadsheet, buildGradeRecap } from "./sheet-backup-data";

test("grade backup reuses Pica's existing spreadsheet", () => {
  expect(requireStoredSpreadsheet({ spreadsheet_id: "186o1Jfsr05obbKjfd1C_X4W5DHRsAyvXrNquAlUATCk" }).spreadsheetId).toBe("186o1Jfsr05obbKjfd1C_X4W5DHRsAyvXrNquAlUATCk");
});
test("grade export without an existing spreadsheet fails rather than creating a file", () => {
  expect(() => requireStoredSpreadsheet(null)).toThrow();
});
test("recap uses TP grades and keeps AI practice as an additional grade outside the final", () => {
  const table = buildGradeRecap({
    classes: [{ id: "c", name: "7B", subjects: ["Bahasa Indonesia"] }],
    enrollments: [{ class_id: "c", student_id: "s" }], profiles: [{ id: "s", full_name: "Siswa" }],
    attendance: [{ class_id: "c", student_id: "s", status: "hadir" }],
    adab: [{ class_id: "c", student_id: "s", subject: "Bahasa Indonesia", score: 80 }],
    objectives: [{ id: "t1", class_id: "c", subject: "Bahasa Indonesia", code: "TP1", description: "Memahami teks" }],
    assignments: [{ id: "a", class_id: "c", subject: "Bahasa Indonesia", objective_id: "t1", max_score: 100 }],
    submissions: [{ assignment_id: "a", student_id: "s", score: 90, status: "graded" }],
    practiceAttempts: [{ class_id: "c", student_id: "s", subject: "Bahasa Indonesia", topic: "Teks", score: 20, feedback: "Ulangi konsep", created_at: "2026-01-01" }],
    materials: [], weights: { sumatif: 60, adab: 20, absensi: 20 },
  });
  expect(table[1][3]).toBe("TP1: 90");
  expect(table[1][7]).toBe("20");
  expect(table[1][8]).toBe("Ulangi konsep");
  expect(table[1][9]).toBe("90");
});

test("backup uses manual per-student TP grades and saved report descriptions", () => {
  const table = buildGradeRecap({
    classes: [{ id: "c", name: "7B", subjects: ["IPA"] }],
    enrollments: [{ class_id: "c", student_id: "s" }], profiles: [{ id: "s", full_name: "Siswa" }],
    attendance: [], adab: [], materials: [], weights: { sumatif: 100, adab: 0, absensi: 0 },
    objectives: [{ id: "t1", class_id: "c", subject: "IPA", code: "TP1", description: "Memahami energi" }],
    assignments: [{ id: "a", class_id: "c", subject: "IPA", objective_id: "t1", max_score: 100 }],
    submissions: [{ assignment_id: "a", student_id: "s", score: 70, status: "graded" }],
    progressRecords: [{ class_id: "c", subject: "IPA", student_id: "s", objective_scores: { t1: 95 }, report_description: "Perkembangan sangat baik." }],
  });
  expect(table[1][3]).toBe("TP1: 95");
  expect(table[1][9]).toBe("95");
  expect(table[1][11]).toBe("Perkembangan sangat baik.");
});
