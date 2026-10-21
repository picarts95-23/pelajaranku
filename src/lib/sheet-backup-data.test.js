import { expect, test } from "bun:test";
import { requireStoredSpreadsheet, buildGradeRecap } from "./sheet-backup-data";

test("grade backup reuses Pica's existing spreadsheet", () => {
  expect(requireStoredSpreadsheet({ spreadsheet_id: "186o1Jfsr05obbKjfd1C_X4W5DHRsAyvXrNquAlUATCk" }).spreadsheetId).toBe("186o1Jfsr05obbKjfd1C_X4W5DHRsAyvXrNquAlUATCk");
});
test("grade export without an existing spreadsheet fails rather than creating a file", () => {
  expect(() => requireStoredSpreadsheet(null)).toThrow();
});
test("recap includes saved manual grades in the weighted final", () => {
  const table = buildGradeRecap({ classes: [{ id: "c", name: "7B", subjects: ["Bahasa Indonesia"] }], enrollments: [{ class_id: "c", student_id: "s" }], profiles: [{ id: "s", full_name: "Siswa" }], attendance: [{ class_id: "c", student_id: "s", status: "hadir" }], adab: [{ class_id: "c", student_id: "s", subject: "Bahasa Indonesia", score: 80 }], assignments: [{ id: "a", class_id: "c", subject: "Bahasa Indonesia", exam_type: "uts", max_score: 100 }], submissions: [{ assignment_id: "a", student_id: "s", score: 90, status: "graded" }], mutabaah: [], materials: [] });
  expect(table[1].slice(3, 9)).toEqual(["100", "80", "0", "90", "0", "44"]);
});