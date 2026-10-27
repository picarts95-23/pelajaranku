import { describe, expect, test } from "bun:test";
import { canCreateRequestedAssignment, requestedAssignmentDefaults } from "./assignment-request";

const request = { id: "request-1", student_id: "student-1", class_id: "class-1", title: "Latihan pecahan", description: "Kerjakan 5 soal", subject: "Matematika", desired_due_at: null, status: "pending", assignment_id: null };

describe("assignments from requests", () => {
  test("carries the requested title, description and subject into the editable form", () => {
    expect(requestedAssignmentDefaults(request)).toMatchObject({ title: "Latihan pecahan", description: "Kerjakan 5 soal", subject: "Matematika", assigned_student_id: "student-1" });
  });
  test("does not create a second assignment after conversion", () => {
    expect(canCreateRequestedAssignment({ ...request, status: "converted", assignment_id: "assignment-1" })).toBe(false);
    expect(canCreateRequestedAssignment(request)).toBe(true);
  });
  test("accepted requests can still become assignments", () => {
    expect(canCreateRequestedAssignment({ ...request, status: "accepted" })).toBe(true);
  });
  test("declined and cancelled requests cannot become assignments", () => {
    expect(canCreateRequestedAssignment({ ...request, status: "declined" })).toBe(false);
    expect(canCreateRequestedAssignment({ ...request, status: "cancelled" })).toBe(false);
  });
});