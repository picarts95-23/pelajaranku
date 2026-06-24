import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, GraduationCap, Trophy, Coins, BookOpenCheck, Users2 } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { predikatOf } from "@/lib/mutabaah";

export const Route = createFileRoute("/_authenticated/guru/laporan")({
  head: () => ({ meta: [{ title: "Laporan Progres · EduQuest Academy" }] }),
  component: GuruLaporanPage,
});

const isHalaqoh = (subject?: string | null) => !!subject && /halaqoh|tahfidz|qur'?an/i.test(subject);

function predicate(score: number, lang: string) {
  if (score >= 90) return { label: "A", tone: "text-emerald-600" };
  if (score >= 80) return { label: "B", tone: "text-xp" };
  if (score >= 70) return { label: "C", tone: "text-coin" };
  return { label: lang === "id" ? "Perlu Perbaikan" : "Needs work", tone: "text-destructive" };
}

function GuruLaporanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const [classId, setClassId] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  // Teacher classes
  const { data: classes = [] } = useQuery({
    queryKey: ["laporan-classes", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subjects, subject").eq("teacher_id", user!.id).order("name")).data ?? [],
  });

  // Assignments with their submissions (the basis of scores)
  const { data: assignments = [] } = useQuery({
    queryKey: ["laporan-assignments", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase
      .from("assignments")
      .select("id, title, subject, class_id, max_score, classes(name), submissions(id, status, score, student_id)")
      .eq("teacher_id", user!.id)).data ?? [],
  });

  // Enrollments -> student ids per class
  const { data: enrollments = [] } = useQuery({
    queryKey: ["laporan-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase
      .from("class_enrollments")
      .select("student_id, class_id, classes!inner(teacher_id)")
      .eq("classes.teacher_id", user!.id)).data ?? [],
  });

  const studentIds = useMemo(() => Array.from(new Set((enrollments as any[]).map((e) => e.student_id))), [enrollments]);

  // Student profiles (XP/coins/names)
  const { data: profiles = [] } = useQuery({
    queryKey: ["laporan-profiles", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, xp, coins, level").in("id", studentIds)).data ?? [],
  });

  // Mutaba'ah records for Halaqoh detail
  const { data: mutabaah = [] } = useQuery({
    queryKey: ["laporan-mutabaah", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase
      .from("tahfidz_mutabaah")
      .select("student_id, class_id, session_type, setoran_kind, total_score, tajwid_score, kelancaran_score, fashohah_score, surah, pages_count, session_date")
      .eq("teacher_id", user!.id)
      .order("session_date", { ascending: false })).data ?? [],
  });

  const profName = (id: string) => (profiles as any[]).find((p) => p.id === id)?.full_name ?? "—";

  // Subjects available across teacher's classes & assignments
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    (classes as any[]).forEach((c) => { (c.subjects ?? []).forEach((s: string) => s && set.add(s)); if (c.subject) set.add(c.subject); });
    (assignments as any[]).forEach((a) => a.subject && set.add(a.subject));
    return Array.from(set).sort();
  }, [classes, assignments]);

  // Filter assignments by selected class & subject
  const filteredAssignments = useMemo(() => (assignments as any[]).filter((a) => {
    if (classId !== "all" && a.class_id !== classId) return false;
    if (subject !== "all" && a.subject !== subject) return false;
    return true;
  }), [assignments, classId, subject]);

  // Per-student aggregation (avg score from graded/auto-graded submissions + XP/coins)
  const perStudent = useMemo(() => {
    const scopeStudents = classId === "all"
      ? studentIds
      : Array.from(new Set((enrollments as any[]).filter((e) => e.class_id === classId).map((e) => e.student_id)));
    return scopeStudents.map((sid) => {
      const subs: { score: number; max: number }[] = [];
      filteredAssignments.forEach((a) => {
        (a.submissions ?? []).forEach((s: any) => {
          if (s.student_id === sid && (s.status === "graded" || s.score != null)) {
            subs.push({ score: s.score ?? 0, max: a.max_score || 100 });
          }
        });
      });
      const pct = subs.length ? Math.round(subs.reduce((acc, x) => acc + (x.score / (x.max || 100)) * 100, 0) / subs.length) : null;
      const prof = (profiles as any[]).find((p) => p.id === sid);
      return {
        id: sid,
        name: profName(sid),
        avg: pct,
        count: subs.length,
        xp: prof?.xp ?? 0,
        coins: prof?.coins ?? 0,
        level: prof?.level ?? 1,
      };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [filteredAssignments, studentIds, enrollments, classId, profiles]);

  // Per-subject aggregation
  const perSubject = useMemo(() => {
    const map: Record<string, { scores: number[]; halaqoh: boolean }> = {};
    filteredAssignments.forEach((a) => {
      const subj = a.subject || (lang === "id" ? "Tanpa mapel" : "No subject");
      if (!map[subj]) map[subj] = { scores: [], halaqoh: isHalaqoh(a.subject) };
      (a.submissions ?? []).forEach((s: any) => {
        if (s.status === "graded" || s.score != null) map[subj].scores.push(((s.score ?? 0) / (a.max_score || 100)) * 100);
      });
    });
    return Object.entries(map).map(([subj, v]) => ({
      subject: subj,
      avg: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null,
      count: v.scores.length,
      halaqoh: v.halaqoh,
    })).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [filteredAssignments, lang]);

  // Mutaba'ah detail scoped to filter
  const filteredMutabaah = useMemo(() => (mutabaah as any[]).filter((m) => {
    if (classId !== "all" && m.class_id !== classId) return false;
    return true;
  }), [mutabaah, classId]);

  const halaqohActive = subject === "all" || isHalaqoh(subject) || filteredMutabaah.length > 0;

  // Export columns + rows for the per-student table
  const exportColumns = [
    { key: "name", header: lang === "id" ? "Siswa" : "Student" },
    { key: "avg", header: lang === "id" ? "Rata-rata (%)" : "Average (%)" },
    { key: "count", header: lang === "id" ? "Jumlah Tugas" : "Tasks" },
    { key: "xp", header: "XP" },
    { key: "coins", header: lang === "id" ? "Koin" : "Coins" },
    { key: "level", header: "Level" },
  ];
  const exportRows = perStudent.map((s) => ({
    name: s.name,
    avg: s.avg ?? "-",
    count: s.count,
    xp: s.xp,
    coins: s.coins,
    level: s.level,
  }));


  return (
    <DashboardShell accent="guru">
      <QuizTabsLazy />

      <PageHeader
        title={lang === "id" ? "Laporan Progres Belajar" : "Learning Progress Report"}
        subtitle={lang === "id" ? "Ringkasan nilai, XP/koin, dan Mutaba'ah berdasarkan data Tugas/Kuis." : "Scores, XP/coins, and Mutaba'ah from Tugas/Kuis data."}
        actions={exportRows.length > 0 ? <ExportMenu rows={exportRows} columns={exportColumns} title={lang === "id" ? "Laporan Progres Belajar" : "Learning Progress Report"} filename={lang === "id" ? "laporan-progres" : "progress-report"} variant="guru" /> : undefined}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="min-w-[180px]">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><GraduationCap className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "id" ? "Semua Kelas" : "All Classes"}</SelectItem>
              {(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><BarChart3 className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "id" ? "Semua Mapel" : "All Subjects"}</SelectItem>
              {subjectOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Per-subject summary cards */}
      {perSubject.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perSubject.map((s) => {
            const p = s.avg != null ? predicate(s.avg, lang) : null;
            return (
              <div key={s.subject} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
                <div className="flex items-center gap-2">
                  {s.halaqoh ? <BookOpenCheck className="size-5 text-emerald-600" /> : <BarChart3 className="size-5 text-guru" />}
                  <h3 className="truncate font-display font-bold">{s.subject}</h3>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-black">{s.avg != null ? `${s.avg}` : "—"}<span className="text-base text-muted-foreground">%</span></p>
                    <p className="text-xs text-muted-foreground">{s.count} {lang === "id" ? "nilai" : "scores"}</p>
                  </div>
                  {p && <span className={`font-display text-lg font-black ${p.tone}`}>{p.label}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-student table */}
      <div className="rounded-2xl border-2 border-border bg-card shadow-card-rpg">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Users2 className="size-5 text-guru" />
          <h3 className="font-display font-bold">{lang === "id" ? "Progres per Siswa" : "Per-Student Progress"}</h3>
        </div>
        {perStudent.length === 0 ? (
          <EmptyState message={lang === "id" ? "Belum ada data siswa untuk filter ini." : "No student data for this filter."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-display">{lang === "id" ? "Siswa" : "Student"}</th>
                  <th className="px-4 py-2 text-center font-display">{lang === "id" ? "Rata-rata" : "Average"}</th>
                  <th className="px-4 py-2 text-center font-display">{lang === "id" ? "Tugas" : "Tasks"}</th>
                  <th className="px-4 py-2 text-right font-display"><Trophy className="ml-auto size-3.5" /></th>
                  <th className="px-4 py-2 text-right font-display"><Coins className="ml-auto size-3.5" /></th>
                </tr>
              </thead>
              <tbody>
                {perStudent.map((s) => {
                  const p = s.avg != null ? predicate(s.avg, lang) : null;
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-display font-semibold">{s.name} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">Lv {s.level}</span></td>
                      <td className="px-4 py-3 text-center">
                        {s.avg != null ? <span className={`font-display font-bold ${p?.tone}`}>{s.avg}% · {p?.label}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{s.count}</td>
                      <td className="px-4 py-3 text-right"><span className="rounded-full bg-xp/15 px-2 py-0.5 font-display text-xs font-bold text-xp">{s.xp.toLocaleString()}</span></td>
                      <td className="px-4 py-3 text-right"><span className="rounded-full bg-coin/15 px-2 py-0.5 font-display text-xs font-bold text-coin">{s.coins.toLocaleString()}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mutaba'ah Halaqoh detail */}
      {halaqohActive && filteredMutabaah.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 shadow-card-rpg">
          <div className="flex items-center gap-2 border-b border-emerald-500/20 px-4 py-3">
            <BookOpenCheck className="size-5 text-emerald-600" />
            <h3 className="font-display font-bold text-emerald-700">{lang === "id" ? "Detail Mutaba'ah Halaqoh Qur'an" : "Halaqoh Qur'an Mutaba'ah Detail"}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-500/20 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-display">{lang === "id" ? "Siswa" : "Student"}</th>
                  <th className="px-4 py-2 font-display">{lang === "id" ? "Jenis" : "Type"}</th>
                  <th className="px-4 py-2 font-display">Surah</th>
                  <th className="px-4 py-2 text-center font-display">Tajwid</th>
                  <th className="px-4 py-2 text-center font-display">{lang === "id" ? "Lancar" : "Fluency"}</th>
                  <th className="px-4 py-2 text-center font-display">Fashohah</th>
                  <th className="px-4 py-2 text-center font-display">{lang === "id" ? "Total" : "Total"}</th>
                  <th className="px-4 py-2 font-display">{lang === "id" ? "Tanggal" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMutabaah.slice(0, 100).map((m: any, i: number) => (
                  <tr key={i} className="border-b border-emerald-500/10 last:border-0">
                    <td className="px-4 py-2.5 font-display font-semibold">{profName(m.student_id)}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{m.setoran_kind || m.session_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.surah ?? "—"}{m.pages_count != null ? ` · ${m.pages_count} hlm` : ""}</td>
                    <td className="px-4 py-2.5 text-center">{m.tajwid_score}</td>
                    <td className="px-4 py-2.5 text-center">{m.kelancaran_score}</td>
                    <td className="px-4 py-2.5 text-center">{m.fashohah_score}</td>
                    <td className="px-4 py-2.5 text-center font-display font-bold text-emerald-700">{m.total_score} · {predikatOf(m.total_score, lang)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.session_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

// Tabs are rendered separately to keep imports tidy.
import { QuizTabs } from "@/components/quiz-tabs";
function QuizTabsLazy() { return <QuizTabs active="laporan" />; }
