import { describe, finalScore, predikat, type Objective, type TpRow, type Weights } from "./tp-recap";

export type ProgressRecord = {
  student_id: string;
  objective_scores?: Record<string, number | null> | null;
  development_notes?: string | null;
  report_description?: string | null;
};

export function cleanObjectiveScores(scores: Record<string, number | "">) {
  return Object.fromEntries(Object.entries(scores).flatMap(([id, value]) => {
    if (value === "" || typeof value !== "number" || !Number.isFinite(value)) return [];
    return [[id, Math.max(0, Math.min(100, Math.round(value * 10) / 10))]];
  }));
}

/** Manual TP grades override only their own TP; all other recap sources stay unchanged. */
export function applyStudentProgress(row: TpRow, objectives: Objective[], record: ProgressRecord | undefined, weights: Weights): TpRow {
  if (!record) return row;
  const overrides = record.objective_scores ?? {};
  const perTp = { ...row.perTp };
  for (const objective of objectives) {
    const score = overrides[objective.id];
    if (typeof score === "number" && Number.isFinite(score)) perTp[objective.id] = Math.max(0, Math.min(100, score));
  }
  const scored = objectives.flatMap((objective) => {
    const score = perTp[objective.id];
    return typeof score === "number" ? [{ description: objective.description, score }] : [];
  });
  const sumatif = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length * 10) / 10 : null;
  const final = finalScore({ sumatif, adab: row.adab, absensi: row.absensi }, weights);
  const generated = describe(row.name, scored);
  return {
    ...row,
    perTp,
    sumatif,
    final,
    predikat: predikat(final),
    description: record.report_description?.trim() || generated,
  };
}

export type DevelopmentAttempt = { topic: string; score: number; feedback: string; created_at: string };

/** Editable draft combining TP, other assessment components, formative feedback and AI practice. */
export function buildDevelopmentSummary(row: TpRow, attempts: DevelopmentAttempt[]) {
  const lines = [
    `Nilai akhir ${row.final ?? "belum tersedia"} (${row.predikat}); rata-rata sumatif TP ${row.sumatif ?? "belum tersedia"}, adab ${row.adab ?? "belum diisi"}, dan absensi ${row.absensi ?? "belum tersedia"}.`,
    row.description,
  ];
  if (row.formatif.count) lines.push(`Asesmen formatif: ${row.formatif.count} penilaian dengan rata-rata ${row.formatif.avg}.${row.formatif.lastFeedback ? ` Umpan balik: ${row.formatif.lastFeedback}` : ""}`);
  if (attempts.length) {
    const average = Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length);
    lines.push(`Latihan AI: ${attempts.length} sesi dengan rata-rata nilai tambahan ${average}.`);
    for (const attempt of attempts.slice(0, 5)) lines.push(`• ${attempt.topic} (${attempt.score}/100): ${attempt.feedback}`);
  }
  return lines.join("\n");
}
