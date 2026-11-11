// Browser-safe helpers for the per-TP (Tujuan Pembelajaran) summative recap.
// Formative assessments are feedback only and never enter the final grade.

export type Weights = { sumatif: number; adab: number; absensi: number };

/** Only entered Adab scores become recap/save rows; an explicit zero is valid. */
export function adabRowsFromDraft(students: { id: string }[], draft: Record<string, number | "">) {
  return students.flatMap((student) => {
    const score = draft[student.id];
    if (typeof score !== "number" || !Number.isFinite(score)) return [];
    return [{ student_id: student.id, score: Math.max(0, Math.min(100, score)) }];
  });
}
export type Objective = { id: string; code: string; description: string };
export type TpAssignment = {
  id: string; objective_id: string | null; objective_weights?: Record<string, number> | null; assessment_kind: string; max_score: number;
  submissions: { student_id: string; score: number | null; status: string; feedback?: string | null }[];
};

export const ATTENDANCE_SCORE: Record<string, number> = { hadir: 100, izin: 60, sakit: 60, alpa: 0 };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number) => Math.round(n * 10) / 10;

/** Proportional share of an assessment per TP (shares sum to 1). Multi-TP (e.g. UTS/UAS) uses objective_weights. */
export function tpShares(a: Pick<TpAssignment, "objective_id" | "objective_weights">): Record<string, number> {
  const w = Object.entries(a.objective_weights ?? {}).filter(([, v]) => Number(v) > 0);
  const total = w.reduce((t, [, v]) => t + Number(v), 0);
  if (total > 0) return Object.fromEntries(w.map(([k, v]) => [k, Number(v) / total]));
  return a.objective_id ? { [a.objective_id]: 1 } : {};
}

export function validateTpWeights(w: Record<string, number>): string | null {
  const vals = Object.values(w);
  if (vals.length < 2) return null;
  if (vals.some((v) => !Number.isFinite(v) || v <= 0)) return "Porsi tiap TP harus lebih dari 0.";
  if (Math.round(vals.reduce((a, b) => a + b, 0)) !== 100) return "Total porsi TP harus 100%.";
  return null;
}

export function validateWeights(w: Weights): string | null {
  for (const v of [w.sumatif, w.adab, w.absensi]) if (!Number.isFinite(v) || v < 0 || v > 100) return "Bobot harus 0–100.";
  if (w.sumatif + w.adab + w.absensi !== 100) return "Total bobot harus 100%.";
  return null;
}

/** Weighted final grade; components without data are skipped and remaining weights re-normalised. */
export function finalScore(parts: { sumatif: number | null; adab: number | null; absensi: number | null }, w: Weights): number | null {
  let sum = 0, wt = 0;
  (["sumatif", "adab", "absensi"] as const).forEach((k) => {
    const v = parts[k];
    if (v !== null && w[k] > 0) { sum += v * w[k]; wt += w[k]; }
  });
  return wt ? round(sum / wt) : null;
}

export function predikat(score: number | null) {
  if (score === null) return "-";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "D";
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, "");

/** Report-card sentence: strongest TP(s) + TP(s) needing guidance. */
export function describe(name: string, tp: { description: string; score: number }[], threshold = 75): string {
  if (!tp.length) return `${name} belum memiliki nilai sumatif pada tujuan pembelajaran.`;
  const sorted = [...tp].sort((a, b) => b.score - a.score);
  const strong = sorted.filter((t) => t.score >= threshold);
  const weak = sorted.filter((t) => t.score < threshold).reverse();
  const parts: string[] = [];
  if (strong.length) parts.push(`Ananda ${name} menunjukkan penguasaan yang baik dalam ${strong.slice(0, 2).map((t) => lower(t.description)).join(" serta ")}`);
  if (weak.length) parts.push(`${strong.length ? "dan " : `Ananda ${name} `}perlu bimbingan dalam ${weak.slice(0, 2).map((t) => lower(t.description)).join(" serta ")}`);
  return parts.join(", ") + ".";
}

export type TpRow = {
  student_id: string; name: string;
  perTp: Record<string, number | null>; sumatif: number | null; adab: number | null; absensi: number | null;
  final: number | null; predikat: string; description: string;
  formatif: { count: number; avg: number | null; lastFeedback: string | null };
};

export function computeTpRecap(input: {
  students: { id: string; full_name: string }[];
  objectives: Objective[];
  assignments: TpAssignment[];
  attendance: { student_id: string; status: string }[];
  adab: { student_id: string; score: number }[];
  weights: Weights;
  threshold?: number;
}): TpRow[] {
  const graded = (s: { score: number | null; status: string }) => s.status === "graded" && s.score !== null;
  return input.students.map((st) => {
    const pct = (a: TpAssignment) => a.submissions.filter((s) => s.student_id === st.id && graded(s)).map((s) => (Number(s.score) / (a.max_score || 100)) * 100);
    const perTp: Record<string, number | null> = {};
    const tpScores: { description: string; score: number }[] = [];
    input.objectives.forEach((o) => {
      let num = 0, den = 0;
      input.assignments.filter((a) => a.assessment_kind === "sumatif").forEach((a) => {
        const share = tpShares(a)[o.id];
        if (share) pct(a).forEach((p) => { num += p * share; den += share; });
      });
      const v = den ? num / den : null;
      perTp[o.id] = v === null ? null : round(v);
      if (v !== null) tpScores.push({ description: o.description, score: v });
    });
    const sumatif = avg(tpScores.map((t) => t.score));
    const att = input.attendance.filter((a) => a.student_id === st.id).map((a) => ATTENDANCE_SCORE[a.status] ?? 0);
    const absensi = avg(att);
    const adabRow = input.adab.find((a) => a.student_id === st.id);
    const adab = adabRow ? adabRow.score : null;
    const parts = { sumatif: sumatif === null ? null : round(sumatif), adab, absensi: absensi === null ? null : round(absensi) };
    const final = finalScore(parts, input.weights);
    const formSubs = input.assignments.filter((a) => a.assessment_kind === "formatif")
      .flatMap((a) => a.submissions.filter((s) => s.student_id === st.id && graded(s)).map((s) => ({ p: (Number(s.score) / (a.max_score || 100)) * 100, f: s.feedback ?? null })));
    const fa = avg(formSubs.map((x) => x.p));
    return {
      student_id: st.id, name: st.full_name, perTp, ...parts, final, predikat: predikat(final),
      description: describe(st.full_name, tpScores, input.threshold),
      formatif: { count: formSubs.length, avg: fa === null ? null : round(fa), lastFeedback: [...formSubs].reverse().find((x) => x.f)?.f ?? null },
    };
  });
}
