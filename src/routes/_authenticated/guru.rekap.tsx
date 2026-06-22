import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, GraduationCap, Trophy } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/rekap")({
  head: () => ({ meta: [{ title: "Rekap Nilai · EduQuest Academy" }] }),
  component: GuruRekapPage,
});

function GuruRekapPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  // Enrolled students of the selected class (id + name)
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

  // Assignments of the class + their submissions
  const { data: assignments = [] } = useQuery({
    queryKey: ["rekap-assignments", classId], enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, subject, max_score, submissions(student_id, score, status)")
        .eq("class_id", classId);
      return data ?? [];
    },
  });

  const subjects = useMemo(() => {
    const set = new Set<string>();
    (assignments as any[]).forEach((a) => { if (a.subject) set.add(a.subject); });
    return Array.from(set).sort();
  }, [assignments]);

  const rows = useMemo(() => {
    if (!subject) return [];
    const relevant = (assignments as any[]).filter((a) => a.subject === subject);
    return (students as any[]).map((stu) => {
      let total = 0, count = 0, pctSum = 0;
      relevant.forEach((a) => {
        const sub = (a.submissions ?? []).find((s: any) => s.student_id === stu.id && s.status === "graded" && s.score != null);
        if (sub) { total += sub.score; count += 1; pctSum += a.max_score ? (sub.score / a.max_score) * 100 : 0; }
      });
      const avg = count ? Math.round(pctSum / count) : 0;
      return { id: stu.id, name: stu.full_name, total, count, avg };
    }).sort((a, b) => b.avg - a.avg);
  }, [subject, assignments, students]);

  const exportColumns = [
    { key: "name", header: t("studentName") },
    { key: "count", header: t("tasksGraded") },
    { key: "total", header: t("totalScore") },
    { key: "avg", header: `${t("average")} (%)` },
  ];

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("recapTitle")}
        subtitle={t("recapSubtitle")}
        actions={subject && rows.length > 0 ? (
          <ExportMenu filename={`rekap-${subject}`} title={`${t("recapTitle")} · ${subject}`} columns={exportColumns} rows={() => rows} />
        ) : undefined}
      />

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

      {!classId ? (
        <EmptyState message={lang === "id" ? "Pilih kelas untuk mulai." : "Select a class to begin."} />
      ) : !subject ? (
        <EmptyState message={lang === "id" ? "Pilih mata pelajaran untuk melihat arsip nilai." : "Select a subject to view grade archives."} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("noGradesSubject")} />
      ) : (
        <div className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-card-rpg">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">{t("studentName")}</th>
                <th className="px-4 py-3 text-center">{t("tasksGraded")}</th>
                <th className="px-4 py-3 text-center">{t("totalScore")}</th>
                <th className="px-4 py-3 text-right">{t("average")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {i < 3 ? <Trophy className={`size-4 ${i === 0 ? "text-coin" : i === 1 ? "text-muted-foreground" : "text-secondary-foreground"}`} /> : i + 1}
                  </td>
                  <td className="px-4 py-3 font-display font-semibold flex items-center gap-2"><GraduationCap className="size-4 text-guru" /> {r.name}</td>
                  <td className="px-4 py-3 text-center">{r.count}</td>
                  <td className="px-4 py-3 text-center font-display font-bold">{r.total}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-display text-lg font-bold ${r.avg >= 80 ? "text-xp" : r.avg >= 60 ? "text-coin" : "text-destructive"}`}>{r.avg}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 border-t-2 border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <BarChart3 className="size-4" /> {lang === "id" ? "Nilai terhitung dari akumulasi tugas dinilai siswa pada mapel ini." : "Computed from each student's graded tasks in this subject."}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
