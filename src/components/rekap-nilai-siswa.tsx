import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronRight, GraduationCap, HeartHandshake, Info } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isHalaqohSubject, HALAQOH_WEIGHTS } from "@/lib/mutabaah";

// Mirrors the teacher recap (guru/rekap): Kehadiran 10% · Adab 20% ·
// Harian 20% · UTS 20% · UAS 30%.
const ATT_WEIGHT: Record<string, number> = { hadir: 100, izin: 60, sakit: 60, alpa: 0 };

function predicate(score: number, lang: string) {
  if (score >= 90) return { label: "A", tone: "text-emerald-600", bar: "bg-emerald-500" };
  if (score >= 80) return { label: "B", tone: "text-xp", bar: "bg-xp" };
  if (score >= 70) return { label: "C", tone: "text-coin", bar: "bg-coin" };
  return { label: lang === "id" ? "Perlu Perbaikan" : "Needs work", tone: "text-destructive", bar: "bg-destructive" };
}

type Row = {
  key: string;
  className: string;
  subject: string;
  kehadiran: number;
  adab: number;
  harian: number;
  uts: number;
  uas: number;
  final: number;
  halaqoh: boolean;
};

export function RekapNilaiSiswa({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { lang } = useLang();

  const { data, isLoading } = useQuery({
    queryKey: ["siswa-rekap-mapel", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: en } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      const classIds = Array.from(new Set((en ?? []).map((e: any) => e.class_id)));
      if (classIds.length === 0) return { classes: [], assignments: [], attendance: [], adab: [], mutabaah: [] };
      const [classes, assignments, attendance, adab, mutabaah] = await Promise.all([
        supabase.from("classes").select("id, name, subjects, subject").in("id", classIds),
        supabase
          .from("assignments")
          .select("id, class_id, subject, exam_type, max_score, submissions(student_id, score, status)")
          .in("class_id", classIds),
        supabase.from("attendance").select("class_id, status").eq("student_id", user!.id),
        supabase.from("adab_scores").select("class_id, subject, score").eq("student_id", user!.id),
        supabase.from("tahfidz_mutabaah").select("class_id, session_type, total_score").eq("student_id", user!.id),
      ]);
      return {
        classes: classes.data ?? [],
        assignments: assignments.data ?? [],
        attendance: attendance.data ?? [],
        adab: adab.data ?? [],
        mutabaah: mutabaah.data ?? [],
      };
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

      const attRecs = (data.attendance as any[]).filter((a) => a.class_id === cls.id);
      const kehadiran = attRecs.length
        ? attRecs.reduce((n, r) => n + (ATT_WEIGHT[r.status] ?? 0), 0) / attRecs.length
        : 0;

      for (const subject of Array.from(subjects).sort()) {
        const avgPct = (examType: string) => {
          let sum = 0, count = 0;
          clsAssignments
            .filter((a) => a.subject === subject && a.exam_type === examType)
            .forEach((a) => {
              const sub = (a.submissions ?? []).find(
                (s: any) => s.student_id === user.id && s.status === "graded" && s.score != null,
              );
              if (sub) { sum += a.max_score ? (sub.score / a.max_score) * 100 : 0; count += 1; }
            });
          return count ? sum / count : 0;
        };

        const halaqoh = isHalaqohSubject(subject);
        let harian = avgPct("harian");
        if (halaqoh) {
          // Same sources as the server RPC halaqoh_daily_scores: manual
          // Mutaba'ah records + graded Halaqoh assignments, per kind.
          const buckets: Record<"ziyadah" | "murojaah" | "tilawah", number[]> = {
            ziyadah: [], murojaah: [], tilawah: [],
          };
          const normKind = (raw: string): "ziyadah" | "murojaah" | "tilawah" | null => {
            const v = (raw ?? "").toLowerCase();
            if (v.startsWith("ziyadah")) return "ziyadah";
            if (v.startsWith("muroj") || v.startsWith("muraj")) return "murojaah";
            if (v.startsWith("tilawah")) return "tilawah";
            return null;
          };
          (data.mutabaah as any[])
            .filter((m) => m.class_id === cls.id)
            .forEach((m) => {
              const k = normKind(m.session_type ?? "") ?? "ziyadah";
              buckets[k].push(Number(m.total_score ?? 0));
            });
          clsAssignments.forEach((a) => {
            const k = normKind(a.halaqoh_kind ?? "");
            if (!k) return;
            const sub = (a.submissions ?? []).find(
              (s: any) => s.student_id === user.id && s.status === "graded" && s.score != null,
            );
            if (sub) buckets[k].push(a.max_score ? (sub.score / a.max_score) * 100 : 0);
          });
          const avgOf = (k: "ziyadah" | "murojaah" | "tilawah") =>
            buckets[k].length ? buckets[k].reduce((n, v) => n + v, 0) / buckets[k].length : null;
          const parts = (["ziyadah", "murojaah", "tilawah"] as const)
            .map((k) => ({ value: avgOf(k), weight: HALAQOH_WEIGHTS[k] }))
            .filter((p) => p.value != null);
          const totalWeight = parts.reduce((n, p) => n + p.weight, 0);
          harian = totalWeight
            ? parts.reduce((n, p) => n + (p.value as number) * p.weight, 0) / totalWeight
            : 0;
        }

        const adabRow = (data.adab as any[]).find((a) => a.class_id === cls.id && a.subject === subject);
        const adab = Math.max(0, Math.min(100, Number(adabRow?.score ?? 0)));
        const uts = avgPct("uts");
        const uas = avgPct("uas");
        const final = kehadiran * 0.1 + adab * 0.2 + harian * 0.2 + uts * 0.2 + uas * 0.3;

        out.push({
          key: `${cls.id}-${subject}`,
          className: cls.name,
          subject,
          kehadiran: Math.round(kehadiran),
          adab: Math.round(adab),
          harian: Math.round(harian),
          uts: Math.round(uts),
          uas: Math.round(uas),
          final: Math.round(final),
          halaqoh,
        });
      }
    }
    return out.sort((a, b) => b.final - a.final);
  }, [data, user]);

  const shown = compact ? rows.slice(0, 4) : rows;

  return (
    <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-card-rpg sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold flex items-center gap-2 sm:text-xl">
          <BarChart3 className="size-5 text-accent" />
          {lang === "id" ? "Rekap Nilai per Mata Pelajaran" : "Grade Recap per Subject"}
        </h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {lang === "id"
          ? "Nilai akhir = Kehadiran 10% + Adab 20% + Tugas Harian 20% + UTS 20% + UAS 30%"
          : "Final = Attendance 10% + Adab 20% + Daily 20% + Midterm 20% + Final Exam 30%"}
      </p>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">{lang === "id" ? "Memuat…" : "Loading…"}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          {lang === "id"
            ? "Belum ada rekap. Gabung kelas dan kerjakan tugas dulu, ya!"
            : "No recap yet. Join a class and complete tasks first!"}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const pred = predicate(r.final, lang);
            return (
              <div key={r.key} className="rounded-2xl border-2 border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate flex items-center gap-1.5">
                      <GraduationCap className="size-4 shrink-0 text-accent" /> {r.subject}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.className}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-display text-2xl font-bold leading-none ${pred.tone}`}>{r.final}</div>
                    <div className={`text-[11px] font-display font-bold ${pred.tone}`}>{pred.label}</div>
                  </div>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${pred.bar}`} style={{ width: `${Math.min(100, r.final)}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Metric label={lang === "id" ? "Kehadiran" : "Attendance"} weight="10%" value={r.kehadiran} />
                  <Metric label="Adab" weight="20%" value={r.adab} icon={<HeartHandshake className="size-3" />} />
                  <Metric label={lang === "id" ? "Harian" : "Daily"} weight="20%" value={r.harian} star={r.halaqoh} />
                  <Metric label="UTS" weight="20%" value={r.uts} />
                  <Metric label="UAS" weight="30%" value={r.uas} />
                </div>

                {r.halaqoh && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ★ {lang === "id"
                      ? "Nilai Harian Halaqoh dari akumulasi Mutaba'ah (Ziyadah 30% · Muroja'ah 40% · Tilawah 30%)."
                      : "Halaqoh daily score accumulated from Mutaba'ah (Ziyadah 30% · Muroja'ah 40% · Tilawah 30%)."}
                  </p>
                )}
              </div>
            );
          })}

          {compact && rows.length > shown.length && (
            <div className="pt-1 text-xs text-muted-foreground flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              {lang === "id"
                ? `+${rows.length - shown.length} mata pelajaran lain di halaman Nilai`
                : `+${rows.length - shown.length} more subjects on the Grades page`}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {lang === "id"
              ? "Predikat: A (90–100) · B (80–89) · C (70–79). Kehadiran dihitung otomatis dari presensi (Hadir 100 · Izin/Sakit 60 · Alpa 0). Nilai Adab diberikan guru."
              : "Grades: A (90–100) · B (80–89) · C (70–79). Attendance auto from records (Present 100 · Excused/Sick 60 · Absent 0). Adab is set by your teacher."}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, weight, value, icon, star }: { label: string; weight: string; value: number; icon?: React.ReactNode; star?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-display font-bold uppercase tracking-wide text-muted-foreground">
        {icon} {label} <span className="normal-case opacity-70">{weight}</span>
      </div>
      <div className="font-display text-base font-bold">
        {value}{star && <span className="ml-0.5 align-super text-[9px] text-accent">★</span>}
      </div>
    </div>
  );
}
