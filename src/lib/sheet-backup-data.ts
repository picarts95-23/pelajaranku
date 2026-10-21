import { HALAQOH_WEIGHTS, isHalaqohSubject } from "./mutabaah";

export function requireStoredSpreadsheet(state: { spreadsheet_id?: string | null; spreadsheet_url?: string | null } | null) {
  if (!state?.spreadsheet_id) throw new Error("Belum ada spreadsheet backup guru. Jalankan backup dari akun guru terlebih dahulu.");
  return { spreadsheetId: state.spreadsheet_id, url: state.spreadsheet_url ?? `https://docs.google.com/spreadsheets/d/${state.spreadsheet_id}/edit` };
}

type ClassRow = { id: string; name: string; subject?: string | null; subjects?: string[] | null };
type Assignment = { id: string; class_id?: string | null; subject?: string | null; exam_type?: string; max_score?: number; halaqoh_kind?: string | null };
type Submission = { assignment_id: string; student_id: string; status: string; score: number | null };
type Attendance = { class_id: string; student_id: string; status: string };
type Adab = { class_id: string; student_id: string; subject: string; score: number };
type Mutabaah = { class_id: string; student_id: string; session_type: string; total_score: number | null };
type RecapData = {
  classes: ClassRow[];
  enrollments: { class_id: string; student_id: string }[];
  profiles: { id: string; full_name: string }[];
  assignments: Assignment[];
  submissions: Submission[];
  attendance: Attendance[];
  adab: Adab[];
  mutabaah: Mutabaah[];
  materials: { class_id: string | null; subject: string | null }[];
};

/** Uses the saved teacher recap sources, including manual/group assignments. */
export function buildGradeRecap(data: RecapData): string[][] {
  const out: string[][] = [["Kelas", "Mata Pelajaran", "Nama Siswa", "Kehadiran (10%)", "Adab (20%)", "Harian (20%)", "UTS (20%)", "UAS (30%)", "Nilai Akhir", "Predikat"]];
  const attWeights: Record<string, number> = { hadir: 100, izin: 60, sakit: 60, alpa: 0 };
  for (const cls of [...data.classes].sort((a, b) => a.name.localeCompare(b.name))) {
    const assignments = data.assignments.filter((a) => a.class_id === cls.id);
    const subjects = new Set([...(cls.subjects ?? []), cls.subject, ...assignments.map((a) => a.subject), ...data.materials.filter((m) => m.class_id === cls.id).map((m) => m.subject)].filter((s): s is string => !!s));
    const students = new Set(data.enrollments.filter((e) => e.class_id === cls.id).map((e) => e.student_id));
    for (const subject of [...subjects].sort()) {
      const rows: string[][] = [];
      for (const studentId of students) {
        const att = data.attendance.filter((a) => a.class_id === cls.id && a.student_id === studentId);
        const kehadiran = att.length ? att.reduce((n, a) => n + (attWeights[a.status] ?? 0), 0) / att.length : 0;
        const average = (values: number[]) => values.length ? values.reduce((n, v) => n + v, 0) / values.length : 0;
        const graded = (a: Assignment) => data.submissions.find((s) => s.assignment_id === a.id && s.student_id === studentId && s.status === "graded" && s.score != null);
        const percent = (a: Assignment, s: Submission) => a.max_score && a.max_score > 0 ? Number(s.score) / a.max_score * 100 : 0;
        const avgPct = (exam: string) => average(assignments.filter((a) => a.subject === subject && a.exam_type === exam).flatMap((a) => { const s = graded(a); return s ? [percent(a, s)] : []; }));
        let harian = avgPct("harian");
        if (isHalaqohSubject(subject)) {
          const buckets: Record<keyof typeof HALAQOH_WEIGHTS, number[]> = { ziyadah: [], murojaah: [], tilawah: [] };
          for (const m of data.mutabaah.filter((m) => m.class_id === cls.id && m.student_id === studentId && m.total_score != null)) {
            const raw = (m.session_type ?? "").toLowerCase();
            const kind = raw.startsWith("muroj") || raw.startsWith("muraj") ? "murojaah" : raw.startsWith("tilawah") ? "tilawah" : "ziyadah";
            buckets[kind].push(Number(m.total_score));
          }
          for (const a of assignments) {
            const kind = (a.halaqoh_kind ?? "").toLowerCase();
            const s = graded(a);
            if (s && (kind === "ziyadah" || kind === "murojaah" || kind === "tilawah")) buckets[kind].push(percent(a, s));
          }
          let weighted = 0, weight = 0;
          for (const kind of ["ziyadah", "murojaah", "tilawah"] as const) {
            if (!buckets[kind].length) continue;
            weighted += average(buckets[kind]) * HALAQOH_WEIGHTS[kind];
            weight += HALAQOH_WEIGHTS[kind];
          }
          harian = weight ? Math.round(weighted / weight) : 0;
        }
        const adab = Math.max(0, Math.min(100, Number(data.adab.find((a) => a.class_id === cls.id && a.student_id === studentId && a.subject === subject)?.score ?? 0)));
        const uts = avgPct("uts"), uas = avgPct("uas");
        const final = Math.round(kehadiran * .1 + adab * .2 + harian * .2 + uts * .2 + uas * .3);
        const name = data.profiles.find((p) => p.id === studentId)?.full_name ?? studentId;
        rows.push([cls.name, subject, name, ...[kehadiran, adab, harian, uts, uas].map((n) => String(Math.round(n))), String(final), final >= 90 ? "A" : final >= 80 ? "B" : final >= 70 ? "C" : "Perlu Perbaikan"]);
      }
      out.push(...rows.sort((a, b) => Number(b[8]) - Number(a[8]) || a[2].localeCompare(b[2])));
    }
  }
  return out;
}