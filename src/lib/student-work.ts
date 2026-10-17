type Work = { due_at?: string | null; submissions?: { student_id: string; status: string }[] | null };

export function isActiveStudentWork(work: Work, studentId: string, now = Date.now()) {
  if (work.due_at && new Date(work.due_at).getTime() <= now) return false;
  return !work.submissions?.some((submission) => submission.student_id === studentId && (submission.status === "submitted" || submission.status === "graded"));
}