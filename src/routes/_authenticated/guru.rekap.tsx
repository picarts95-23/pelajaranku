import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, GraduationCap, Trophy, Save, HeartHandshake, ListChecks, LineChart } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { LaporanProgres } from "@/components/laporan-progres";
import { NilaiManual } from "@/components/nilai-manual";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isHalaqohSubject, type HalaqohDaily } from "@/lib/mutabaah";

export const Route = createFileRoute("/_authenticated/guru/rekap")({
  head: () => ({ meta: [{ title: "Rekap Nilai · Pelajaranku" }] }),
  component: GuruRekapPage,
});

// Attendance status -> weight (%)
const ATT_WEIGHT: Record<string, number> = { hadir: 100, izin: 60, sakit: 60, alpa: 0 };

function predicate(score: number, lang: string) {
  if (score >= 90) return { label: "A", tone: "text-emerald-600" };
  if (score >= 80) return { label: "B", tone: "text-xp" };
  if (score >= 70) return { label: "C", tone: "text-coin" };
  return { label: lang === "id" ? "Perlu Perbaikan" : "Needs work", tone: "text-destructive" };
}

function GuruRekapPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [adabDraft, setAdabDraft] = useState<Record<string, number>>({});
  const [view, setView] = useState<"rekap" | "laporan">("rekap");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subjects, subject").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["rekap-students", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: en } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = (en ?? []).map((e: any) => e.student_id);
      if (ids.length === 0) return [] as { id: string; full_name: string }[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profs ?? []) as { id: string; full_name: string }[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["rekap-assignments", classId], enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, subject, exam_type, max_score, submissions(student_id, score, status)")
        .eq("class_id", classId);
      return data ?? [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["rekap-attendance", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId)).data ?? [],
  });

  const { data: classMaterials = [] } = useQuery({
    queryKey: ["rekap-materials", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("materials").select("subject").eq("class_id", classId)).data ?? [],
  });

  const { data: adabScores } = useQuery({
    queryKey: ["rekap-adab", classId, subject], enabled: !!classId && !!subject,
    queryFn: async () => (await supabase.from("adab_scores").select("student_id, score").eq("class_id", classId).eq("subject", subject)).data ?? [],
  });

  const halaqoh = isHalaqohSubject(subject);

  // For a Halaqoh Qur'an subject, the daily grade is the accumulated Mutaba'ah
  // score (Ziyadah 30% + Muroja'ah 40% + Tilawah 30%) combining manual records
  // and graded Halaqoh tasks, computed server-side.
  const { data: halaqohDaily = [] } = useQuery({
    queryKey: ["rekap-halaqoh", classId, halaqoh], enabled: !!classId && halaqoh,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("halaqoh_daily_scores", { _class_id: classId });
      if (error) throw error;
      return (data ?? []) as HalaqohDaily[];
    },
  });
  const halaqohMap = useMemo(() => {
    const m: Record<string, HalaqohDaily> = {};
    (halaqohDaily as HalaqohDaily[]).forEach((h) => { m[h.student_id] = h; });
    return m;
  }, [halaqohDaily]);

  // Sync adab draft from DB whenever scores load (depend on the stable query
  // reference, not a freshly-allocated default array — that caused an infinite loop).
  useEffect(() => {
    if (!adabScores) return;
    const map: Record<string, number> = {};
    (adabScores as any[]).forEach((a) => { map[a.student_id] = a.score; });
    setAdabDraft(map);
  }, [adabScores]);

  // Subjects available for THIS class only: union of subjects used on its
  // tagged assignments, its shared materials, and the subjects the class itself
  // teaches (so Halaqoh Qur'an shows up even before any task is tagged).
  const subjects = useMemo(() => {
    const set = new Set<string>();
    (assignments as any[]).forEach((a) => { if (a.subject) set.add(a.subject); });
    (classMaterials as any[]).forEach((m) => { if (m.subject) set.add(m.subject); });
    const cls = (classes as any[]).find((c) => c.id === classId);
    if (cls) {
      (cls.subjects as string[] | null ?? []).forEach((s) => { if (s) set.add(s); });
      if (cls.subject) set.add(cls.subject);
    }
    return Array.from(set).sort();
  }, [assignments, classMaterials, classes, classId]);

  const saveAdab = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const rows = (students as any[]).map((s) => ({
        teacher_id: user.id, student_id: s.id, class_id: classId, subject,
        score: Math.max(0, Math.min(100, adabDraft[s.id] ?? 0)),
      }));
      const { error } = await supabase.from("adab_scores").upsert(rows, { onConflict: "teacher_id,student_id,class_id,subject" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "id" ? "Nilai adab disimpan ✅" : "Adab scores saved ✅"); qc.invalidateQueries({ queryKey: ["rekap-adab"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function avgPct(stuId: string, examType: string) {
    const relevant = (assignments as any[]).filter((a) => a.subject === subject && a.exam_type === examType);
    let sum = 0, count = 0;
    relevant.forEach((a) => {
      const sub = (a.submissions ?? []).find((s: any) => s.student_id === stuId && s.status === "graded" && s.score != null);
      if (sub) { sum += a.max_score ? (sub.score / a.max_score) * 100 : 0; count += 1; }
    });
    return count ? sum / count : 0;
  }

  function attendancePct(stuId: string) {
    const recs = (attendance as any[]).filter((a) => a.student_id === stuId);
    if (recs.length === 0) return 0;
    const sum = recs.reduce((n, r) => n + (ATT_WEIGHT[r.status] ?? 0), 0);
    return sum / recs.length;
  }

  const rows = useMemo(() => {
    if (!subject) return [];
    return (students as any[]).map((stu) => {
      const kehadiran = attendancePct(stu.id);
      const adab = Math.max(0, Math.min(100, adabDraft[stu.id] ?? 0));
      // For Halaqoh Qur'an, the daily grade is the accumulated Mutaba'ah score.
      const harian = halaqoh ? (halaqohMap[stu.id]?.daily ?? 0) : avgPct(stu.id, "harian");
      const uts = avgPct(stu.id, "uts");
      const uas = avgPct(stu.id, "uas");
      const final = kehadiran * 0.1 + adab * 0.2 + harian * 0.2 + uts * 0.2 + uas * 0.3;
      return {
        id: stu.id, name: stu.full_name,
        kehadiran: Math.round(kehadiran), adab, harian: Math.round(harian),
        ziyadah: halaqoh ? (halaqohMap[stu.id]?.ziyadah ?? 0) : null,
        murojaah: halaqoh ? (halaqohMap[stu.id]?.murojaah ?? 0) : null,
        tilawah: halaqoh ? (halaqohMap[stu.id]?.tilawah ?? 0) : null,
        uts: Math.round(uts), uas: Math.round(uas), final: Math.round(final),
      };
    }).sort((a, b) => b.final - a.final);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, assignments, students, attendance, adabDraft, halaqoh, halaqohMap]);

  const exportColumns = [
    { key: "name", header: t("studentName") },
    { key: "kehadiran", header: lang === "id" ? "Kehadiran (10%)" : "Attendance (10%)" },
    { key: "adab", header: lang === "id" ? "Adab (20%)" : "Adab (20%)" },
    { key: "harian", header: lang === "id" ? "Tugas Harian (20%)" : "Daily (20%)" },
    { key: "uts", header: "UTS (20%)" },
    { key: "uas", header: "UAS (30%)" },
    { key: "final", header: lang === "id" ? "Nilai Akhir" : "Final" },
    { key: "predikat", header: lang === "id" ? "Predikat" : "Grade" },
  ];
  const exportRows = () => rows.map((r) => ({ ...r, predikat: predicate(r.final, lang).label }));

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("recapTitle")}
        subtitle={lang === "id"
          ? "Kehadiran 10% · Adab 20% · Tugas Harian 20% · UTS 20% · UAS 30%"
          : "Attendance 10% · Adab 20% · Daily 20% · Midterm 20% · Final 30%"}
        actions={view === "rekap" && subject && rows.length > 0 ? (
          <ExportMenu filename={`rekap-${subject}`} title={`${t("recapTitle")} · ${subject}`} columns={exportColumns} rows={exportRows} />
        ) : undefined}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setView("rekap")}
          className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 font-display text-sm font-bold transition-colors ${view === "rekap" ? "border-guru bg-guru/10 text-guru" : "border-border bg-card text-muted-foreground hover:border-guru/40"}`}
        >
          <ListChecks className="size-4" /> {lang === "id" ? "Rekap Nilai" : "Grade Recap"}
        </button>
        <button
          onClick={() => setView("laporan")}
          className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 font-display text-sm font-bold transition-colors ${view === "laporan" ? "border-guru bg-guru/10 text-guru" : "border-border bg-card text-muted-foreground hover:border-guru/40"}`}
        >
          <LineChart className="size-4" /> {lang === "id" ? "Laporan Progres" : "Progress Report"}
        </button>
      </div>

      {view === "laporan" ? <LaporanProgres /> : (
      <>


      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-display font-semibold">{t("navClasses")}</label>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSubject(""); }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
            <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-display font-semibold">{t("subject")}</label>
          <Select value={subject} onValueChange={setSubject} disabled={!classId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={t("selectSubject")} /></SelectTrigger>
            <SelectContent>
              {subjects.length === 0
                ? <div className="px-3 py-2 text-xs text-muted-foreground">{lang === "id" ? "Belum ada tugas bermapel di kelas ini" : "No subject-tagged tasks in this class"}</div>
                : subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {classId && subject && (
        <div className="mb-6">
          <NilaiManual classId={classId} subject={subject} students={students as any[]} />
        </div>
      )}



      {!classId ? (
        <EmptyState message={lang === "id" ? "Pilih kelas untuk mulai." : "Select a class to begin."} />
      ) : !subject ? (
        <EmptyState message={lang === "id" ? "Pilih mata pelajaran untuk melihat rekap nilai." : "Select a subject to view the grade recap."} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("noGradesSubject")} />
      ) : (
        <div className="space-y-3">
          {halaqoh && (
            <div className="rounded-2xl border-2 border-guru/30 bg-guru/5 px-4 py-3 text-xs text-muted-foreground">
              {lang === "id"
                ? "Mata pelajaran Halaqoh Qur'an: kolom Harian otomatis dari akumulasi Mutaba'ah — Ziyadah 30% + Muroja'ah 40% + Tilawah 30%. Arahkan kursor ke nilai Harian untuk rinciannya."
                : "Halaqoh Qur'an subject: the Daily column is auto-accumulated from Mutaba'ah — Ziyadah 30% + Muroja'ah 40% + Tilawah 30%. Hover the Daily value for the breakdown."}
            </div>
          )}
          <div className="flex items-center justify-end">
            <Button variant="guru" size="sm" disabled={saveAdab.isPending} onClick={() => saveAdab.mutate()}>
              <Save className="size-4" /> {lang === "id" ? "Simpan Nilai Adab" : "Save Adab Scores"}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card shadow-card-rpg">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">{t("studentName")}</th>
                  <th className="px-3 py-3 text-center">{lang === "id" ? "Hadir" : "Att."}<br /><span className="normal-case">10%</span></th>
                  <th className="px-3 py-3 text-center"><HeartHandshake className="mx-auto size-3.5" />{lang === "id" ? "Adab" : "Adab"}<br /><span className="normal-case">20%</span></th>
                  <th className="px-3 py-3 text-center">{lang === "id" ? "Harian" : "Daily"}<br /><span className="normal-case">20%</span></th>
                  <th className="px-3 py-3 text-center">UTS<br /><span className="normal-case">20%</span></th>
                  <th className="px-3 py-3 text-center">UAS<br /><span className="normal-case">30%</span></th>
                  <th className="px-3 py-3 text-center">{lang === "id" ? "Akhir" : "Final"}</th>
                  <th className="px-3 py-3 text-center">{lang === "id" ? "Predikat" : "Grade"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pred = predicate(r.final, lang);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-3">{i < 3 ? <Trophy className={`size-4 ${i === 0 ? "text-coin" : i === 1 ? "text-muted-foreground" : "text-secondary-foreground"}`} /> : i + 1}</td>
                      <td className="px-3 py-3 font-display font-semibold flex items-center gap-2"><GraduationCap className="size-4 text-guru" /> {r.name}</td>
                      <td className="px-3 py-3 text-center">{r.kehadiran}</td>
                      <td className="px-3 py-3 text-center">
                        <Input
                          type="number" min={0} max={100}
                          value={adabDraft[r.id] ?? 0}
                          onChange={(e) => setAdabDraft((d) => ({ ...d, [r.id]: e.target.value === "" ? 0 : +e.target.value }))}
                          className="mx-auto h-8 w-16 text-center"
                        />
                      </td>
                      <td className="px-3 py-3 text-center" title={halaqoh ? `Ziyadah ${r.ziyadah} · Muroja'ah ${r.murojaah} · Tilawah ${r.tilawah}` : undefined}>{r.harian}{halaqoh && <span className="ml-0.5 text-[10px] text-guru align-super">★</span>}</td>
                      <td className="px-3 py-3 text-center">{r.uts}</td>
                      <td className="px-3 py-3 text-center">{r.uas}</td>
                      <td className="px-3 py-3 text-center font-display text-lg font-bold">{r.final}</td>
                      <td className={`px-3 py-3 text-center font-display font-bold ${pred.tone}`}>{pred.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t-2 border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <BarChart3 className="size-4" /> {lang === "id"
                ? "Predikat: A (90–100) · B (80–89) · C (70–79). Kehadiran otomatis dari presensi; UTS/UAS dari tugas bertanda."
                : "Grades: A (90–100) · B (80–89) · C (70–79). Attendance auto from records; UTS/UAS from tagged tasks."}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </DashboardShell>
  );
}
