import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronRight, GraduationCap, HeartHandshake, Info, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { computeTpRecap, type Weights } from "@/lib/tp-recap";
import { applyStudentProgress, type ProgressRecord } from "@/lib/student-progress";

function predicate(score: number | null, lang: string) {
  if (score === null) return { label: "—", tone: "text-muted-foreground", bar: "bg-muted" };
  if (score >= 90) return { label: "A", tone: "text-emerald-600", bar: "bg-emerald-500" };
  if (score >= 80) return { label: "B", tone: "text-xp", bar: "bg-xp" };
  if (score >= 70) return { label: "C", tone: "text-coin", bar: "bg-coin" };
  return { label: lang === "id" ? "Perlu Perbaikan" : "Needs work", tone: "text-destructive", bar: "bg-destructive" };
}

type Row = {
  key: string; className: string; subject: string; tp: { code: string; description: string; score: number | null }[];
  sumatif: number | null; adab: number | null; kehadiran: number | null; ai: number | null; aiFeedback: string | null;
  final: number | null; description: string; weights: Weights;
};

export function RekapNilaiSiswa({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["siswa-rekap-tp", user?.id], enabled: !!user, staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: en } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      const classIds = Array.from(new Set((en ?? []).map((e) => e.class_id)));
      if (!classIds.length) return { classes: [], assignments: [], attendance: [], adab: [], objectives: [], weights: [], attempts: [], progressRecords: [] };
      const classList = `(${classIds.join(",")})`;
      const [classes, assignments, attendance, adab, objectives, weights, attempts, progressRecords] = await Promise.all([
        supabase.from("classes").select("id, name, teacher_id, subjects, subject").in("id", classIds),
        supabase.from("assignments").select("id, class_id, subject, objective_id, objective_weights, assessment_kind, max_score, submissions(student_id, score, status, feedback)").in("class_id", classIds),
        supabase.from("attendance").select("class_id, student_id, status").eq("student_id", user!.id),
        supabase.from("adab_scores").select("class_id, student_id, subject, score").eq("student_id", user!.id),
        supabase.from("learning_objectives").select("id, class_id, subject, code, description, sort_order").or(`class_id.is.null,class_id.in.${classList}`).order("sort_order"),
        supabase.from("grade_weights").select("teacher_id, sumatif, adab, absensi"),
        (supabase as any).from("practice_attempts").select("class_id, subject, score, feedback, created_at").eq("student_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("student_progress_records").select("class_id, subject, student_id, objective_scores, report_description").eq("student_id", user!.id),
      ]);
      return { classes: classes.data ?? [], assignments: assignments.data ?? [], attendance: attendance.data ?? [], adab: adab.data ?? [], objectives: objectives.data ?? [], weights: weights.data ?? [], attempts: attempts.data ?? [], progressRecords: progressRecords.data ?? [] };
    },
  });

  const rows = useMemo<Row[]>(() => {
    if (!data || !user) return [];
    const out: Row[] = [];
    for (const cls of data.classes as any[]) {
      const clsAssignments = (data.assignments as any[]).filter((a) => a.class_id === cls.id);
      const subjects = new Set<string>();
      clsAssignments.forEach((a) => { if (a.subject) subjects.add(a.subject); });
      ((cls.subjects as string[] | null) ?? []).forEach((s) => { if (s) subjects.add(s); });
      if (cls.subject) subjects.add(cls.subject);
      for (const subject of [...subjects].sort()) {
        const objectives = (data.objectives as any[]).filter((o) => o.subject === subject && (o.class_id === null || o.class_id === cls.id));
        const saved = (data.weights as any[]).find((w) => w.teacher_id === cls.teacher_id);
        const weights: Weights = { sumatif: saved?.sumatif ?? 60, adab: saved?.adab ?? 20, absensi: saved?.absensi ?? 20 };
        const baseRecap = computeTpRecap({
          students: [{ id: user.id, full_name: "" }], objectives,
          assignments: clsAssignments.filter((a) => a.subject === subject),
          attendance: (data.attendance as any[]).filter((a) => a.class_id === cls.id),
          adab: (data.adab as any[]).filter((a) => a.class_id === cls.id && a.subject === subject), weights,
        })[0];
        const progressRecord = (data.progressRecords as ProgressRecord[]).find((record: any) => record.class_id === cls.id && record.subject === subject);
        const recap = applyStudentProgress(baseRecap, objectives, progressRecord, weights);
        const attempts = (data.attempts as any[]).filter((a) => a.class_id === cls.id && a.subject === subject);
        out.push({
          key: `${cls.id}-${subject}`, className: cls.name, subject,
          tp: objectives.map((o) => ({ code: o.code, description: o.description, score: recap.perTp[o.id] ?? null })),
          sumatif: recap.sumatif, adab: recap.adab, kehadiran: recap.absensi,
          ai: attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : null,
          aiFeedback: attempts[0]?.feedback ?? null,
          final: recap.final, description: recap.description, weights,
        });
      }
    }
    return out.sort((a, b) => (b.final ?? -1) - (a.final ?? -1));
  }, [data, user]);

  const shown = compact ? rows.slice(0, 4) : rows;
  return (
    <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-card-rpg sm:p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold sm:text-xl"><BarChart3 className="size-5 text-accent" />{lang === "id" ? "Rekap Nilai & TP per Mata Pelajaran" : "Grade & Objective Recap"}</h2>
      <p className="mb-4 text-xs text-muted-foreground">Nilai akhir dihitung dari TP sumatif, adab, dan absensi sesuai bobot sekolah. Latihan AI merupakan nilai tambahan.</p>
      {isLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Memuat…</div> : !shown.length ? <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">Belum ada rekap. Gabung kelas dan kerjakan tugas dulu, ya!</div> : <div className="space-y-3">
        {shown.map((r) => {
          const pred = predicate(r.final, lang);
          return <div key={r.key} className="rounded-2xl border-2 border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-1.5 truncate font-display font-bold"><GraduationCap className="size-4 shrink-0 text-accent" />{r.subject}</div><div className="truncate text-xs text-muted-foreground">{r.className}</div></div><div className="shrink-0 text-right"><div className={`font-display text-2xl font-bold leading-none ${pred.tone}`}>{r.final ?? "—"}</div><div className={`text-[11px] font-display font-bold ${pred.tone}`}>{pred.label}</div></div></div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${pred.bar}`} style={{ width: `${Math.min(100, r.final ?? 0)}%` }} /></div>
            {r.tp.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{r.tp.map((tp) => <div key={tp.code} className="rounded-xl border border-border bg-card px-3 py-2" title={tp.description}><div className="flex justify-between gap-2 text-sm"><span className="font-display font-bold">{tp.code}</span><span className="font-bold text-primary">{tp.score ?? "—"}</span></div><p className="line-clamp-2 text-xs text-muted-foreground">{tp.description}</p></div>)}</div>}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Sumatif TP" weight={`${r.weights.sumatif}%`} value={r.sumatif} /><Metric label="Adab" weight={`${r.weights.adab}%`} value={r.adab} icon={<HeartHandshake className="size-3" />} /><Metric label="Kehadiran" weight={`${r.weights.absensi}%`} value={r.kehadiran} /><Metric label="Latihan AI" weight="Tambahan" value={r.ai} icon={<Sparkles className="size-3" />} /></div>
            {r.aiFeedback && <div className="mt-3 rounded-xl bg-accent/30 p-3 text-sm"><b>Umpan balik Latihan AI terbaru:</b> {r.aiFeedback}</div>}
            <p className="mt-3 text-sm text-muted-foreground"><b>Deskripsi:</b> {r.description}</p>
          </div>;
        })}
        {compact && rows.length > shown.length && <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground"><ChevronRight className="size-3.5" />+{rows.length - shown.length} mata pelajaran lain di halaman Nilai</div>}
        <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />Nilai Latihan AI tidak mengubah nilai akhir. Predikat: A (90–100), B (80–89), C (70–79), D di bawah 70.</div>
      </div>}
    </div>
  );
}

function Metric({ label, weight, value, icon }: { label: string; weight: string; value: number | null; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card px-2 py-1.5 text-center"><div className="flex items-center justify-center gap-1 text-[10px] font-display font-bold uppercase tracking-wide text-muted-foreground">{icon}{label}<span className="normal-case opacity-70">{weight}</span></div><div className="font-display text-base font-bold">{value ?? "—"}</div></div>;
}
