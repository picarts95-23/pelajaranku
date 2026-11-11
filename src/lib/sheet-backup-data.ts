import { computeTpRecap, type Objective, type Weights } from "./tp-recap";
import { applyStudentProgress, type ProgressRecord } from "./student-progress";

export function requireStoredSpreadsheet(state: { spreadsheet_id?: string | null; spreadsheet_url?: string | null } | null) {
  if (!state?.spreadsheet_id) throw new Error("Belum ada spreadsheet backup guru. Jalankan backup dari akun guru terlebih dahulu.");
  return { spreadsheetId: state.spreadsheet_id, url: state.spreadsheet_url ?? `https://docs.google.com/spreadsheets/d/${state.spreadsheet_id}/edit` };
}

type ClassRow = { id: string; name: string; subject?: string | null; subjects?: string[] | null };
type Assignment = {
  id: string; class_id?: string | null; subject?: string | null; exam_type?: string; max_score?: number;
  objective_id?: string | null; objective_weights?: Record<string, number> | null; assessment_kind?: string;
};
type Submission = { assignment_id: string; student_id: string; status: string; score: number | null; feedback?: string | null };
type PracticeAttempt = { class_id: string; student_id: string; subject: string; topic: string; score: number; feedback: string; created_at: string };
type RecapData = {
  classes: ClassRow[];
  enrollments: { class_id: string; student_id: string }[];
  profiles: { id: string; full_name: string }[];
  assignments: Assignment[];
  submissions: Submission[];
  attendance: { class_id: string; student_id: string; status: string }[];
  adab: { class_id: string; student_id: string; subject: string; score: number }[];
  materials: { class_id: string | null; subject: string | null }[];
  objectives?: (Objective & { class_id: string | null; subject: string })[];
  weights?: Weights;
  practiceAttempts?: PracticeAttempt[];
  progressRecords?: (ProgressRecord & { class_id: string; subject: string })[];
};

/** Spreadsheet recap mirrors the teacher UI: per-TP summative grades plus AI practice as an additional grade. */
export function buildGradeRecap(data: RecapData): string[][] {
  const out: string[][] = [["Kelas", "Mata Pelajaran", "Nama Siswa", "Nilai per TP", "Rata-rata Sumatif TP", "Adab", "Absensi", "Nilai Tambahan Latihan AI", "Umpan Balik Latihan AI Terbaru", "Nilai Akhir", "Predikat", "Deskripsi Rapor"]];
  const weights = data.weights ?? { sumatif: 60, adab: 20, absensi: 20 };
  for (const cls of [...data.classes].sort((a, b) => a.name.localeCompare(b.name))) {
    const assignments = data.assignments.filter((a) => a.class_id === cls.id);
    const subjects = new Set([...(cls.subjects ?? []), cls.subject, ...assignments.map((a) => a.subject), ...data.materials.filter((m) => m.class_id === cls.id).map((m) => m.subject)].filter((s): s is string => !!s));
    const students = data.enrollments.filter((e) => e.class_id === cls.id).map((e) => ({ id: e.student_id, full_name: data.profiles.find((p) => p.id === e.student_id)?.full_name ?? e.student_id }));
    for (const subject of [...subjects].sort()) {
      const objectives = (data.objectives ?? []).filter((o) => o.subject === subject && (o.class_id === null || o.class_id === cls.id));
      const subjectAssignments = assignments.filter((a) => a.subject === subject).map((a) => ({
        id: a.id,
        objective_id: a.objective_id ?? null,
        objective_weights: a.objective_weights ?? null,
        assessment_kind: a.assessment_kind ?? "sumatif",
        max_score: a.max_score ?? 100,
        submissions: data.submissions.filter((s) => s.assignment_id === a.id).map((s) => ({ student_id: s.student_id, score: s.score, status: s.status, feedback: s.feedback })),
      }));
      const recap = computeTpRecap({
        students, objectives, assignments: subjectAssignments,
        attendance: data.attendance.filter((a) => a.class_id === cls.id),
        adab: data.adab.filter((a) => a.class_id === cls.id && a.subject === subject), weights,
      });
      const rows = recap.map((baseRow) => {
        const record = (data.progressRecords ?? []).find((item) => item.class_id === cls.id && item.subject === subject && item.student_id === baseRow.student_id);
        const r = applyStudentProgress(baseRow, objectives, record, weights);
        const attempts = (data.practiceAttempts ?? []).filter((a) => a.class_id === cls.id && a.subject === subject && a.student_id === r.student_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const ai = attempts.length ? String(Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)) : "";
        const tp = objectives.map((o) => `${o.code}: ${r.perTp[o.id] ?? "—"}`).join(" | ");
        return [cls.name, subject, r.name, tp, String(r.sumatif ?? ""), String(r.adab ?? ""), String(r.absensi ?? ""), ai, attempts[0]?.feedback ?? "", String(r.final ?? ""), r.predikat, r.description];
      });
      out.push(...rows.sort((a, b) => Number(b[9] || -1) - Number(a[9] || -1) || a[2].localeCompare(b[2])));
    }
  }
  return out;
}
