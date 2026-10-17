import { describe, expect, test } from "bun:test";
import { isActiveStudentWork } from "./student-work";

describe("student active work", () => {
  const now = Date.parse("2026-10-15T14:53:00Z");
  test("expired work is not active", () => {
    expect(isActiveStudentWork({ due_at: "2026-10-15T14:53:00Z" }, "student", now)).toBe(false);
    expect(isActiveStudentWork({ due_at: "2026-10-15T14:54:00Z" }, "student", now)).toBe(true);
  });
  test("submitted and graded work is not active", () => {
    for (const status of ["submitted", "graded"]) {
      expect(isActiveStudentWork({ submissions: [{ student_id: "student", status }] }, "student", now)).toBe(false);
    }
  });
  test("another student's submission does not hide active work", () => {
    expect(isActiveStudentWork({ submissions: [{ student_id: "other", status: "graded" }] }, "student", now)).toBe(true);
  });
});