import { format } from "date-fns";

export type AssignmentRequest = {
  id: string;
  student_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  subject: string | null;
  desired_due_at: string | null;
  status: string;
  assignment_id: string | null;
};

export function canCreateRequestedAssignment(request: AssignmentRequest) {
  return !request.assignment_id && ["pending", "accepted", "converted"].includes(request.status);
}

export function requestedAssignmentDefaults(request: AssignmentRequest) {
  return {
    title: request.title,
    description: request.description ?? "",
    subject: request.subject ?? "",
    class_id: request.class_id ?? "",
    assigned_student_id: request.student_id,
    due_at: request.desired_due_at ? format(new Date(request.desired_due_at), "yyyy-MM-dd'T'HH:mm") : "",
  };
}