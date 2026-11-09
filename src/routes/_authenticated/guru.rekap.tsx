import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, ListChecks } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { LaporanProgres } from "@/components/laporan-progres";
import { NilaiManual } from "@/components/nilai-manual";
import { NilaiKelompok } from "@/components/nilai-kelompok";
import { RekapHalaqoh } from "@/components/rekap-halaqoh";
import { SheetBackupCard } from "@/components/sheet-backup-card";
import { TpRecapWorkspace } from "@/components/tp-recap-workspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isHalaqohSubject } from "@/lib/mutabaah";

const TITLE = "Rekap Nilai & TP Guru · Pelajaranku";
const DESC = "Satu rekap nilai per siswa dan Tujuan Pembelajaran, nilai tambahan Latihan AI, umpan balik, dan deskripsi rapor.";

export const Route = createFileRoute("/_authenticated/guru/rekap")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: GuruRekapPage,
});

function GuruRekapPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [view, setView] = useState<"rekap" | "laporan">("rekap");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: role === "admin" ? "/admin" : "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subjects, subject").order("name")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["rekap-students", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: en, error } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      if (error) throw error;
      const ids = (en ?? []).map((e) => e.student_id);
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data, error: profileError } = await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name");
      if (profileError) throw profileError;
      return data ?? [];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["rekap-subject-assignments", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("assignments").select("id, subject").eq("class_id", classId)).data ?? [],
  });
  const { data: classMaterials = [] } = useQuery({
    queryKey: ["rekap-materials", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("materials").select("subject").eq("class_id", classId)).data ?? [],
  });

  const subjects = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => { if (a.subject) set.add(a.subject); });
    classMaterials.forEach((m) => { if (m.subject) set.add(m.subject); });
    const cls = classes.find((c) => c.id === classId);
    (cls?.subjects ?? []).forEach((s) => { if (s) set.add(s); });
    if (cls?.subject) set.add(cls.subject);
    return Array.from(set).sort();
  }, [assignments, classMaterials, classes, classId]);
  const activeClass = classes.find((c) => c.id === classId);

  return (
    <DashboardShell accent="guru">
      <PageHeader title={lang === "id" ? "Rekap Nilai & TP" : t("recapTitle")} subtitle={lang === "id" ? "Nilai sumatif per TP, formatif sebagai umpan balik, serta Latihan AI sebagai nilai tambahan—semua dalam satu tabel." : "Objective grades, formative feedback, and AI practice in one recap."} />
      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setView("rekap")} className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 font-display text-sm font-bold transition-colors ${view === "rekap" ? "border-guru bg-guru/10 text-guru" : "border-border bg-card text-muted-foreground hover:border-guru/40"}`}><ListChecks className="size-4" /> {lang === "id" ? "Rekap Nilai & TP" : "Grades & Objectives"}</button>
        <button onClick={() => setView("laporan")} className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 font-display text-sm font-bold transition-colors ${view === "laporan" ? "border-guru bg-guru/10 text-guru" : "border-border bg-card text-muted-foreground hover:border-guru/40"}`}><LineChart className="size-4" /> {lang === "id" ? "Laporan Progres" : "Progress Report"}</button>
      </div>

      {view === "laporan" ? <LaporanProgres /> : <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div><label className="text-sm font-display font-semibold">{t("navClasses")}</label><Select value={classId} onValueChange={(v) => { setClassId(v); setSubject(""); }}><SelectTrigger className="mt-1"><SelectValue placeholder={t("selectClass")} /></SelectTrigger><SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-sm font-display font-semibold">{t("subject")}</label><Select value={subject} onValueChange={setSubject} disabled={!classId}><SelectTrigger className="mt-1"><SelectValue placeholder={t("selectSubject")} /></SelectTrigger><SelectContent>{subjects.length === 0 ? <div className="px-3 py-2 text-xs text-muted-foreground">Belum ada mapel di kelas ini</div> : subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        </div>

        {!classId ? <EmptyState message="Pilih kelas untuk mulai." /> : !subject ? <EmptyState message="Pilih mata pelajaran untuk melihat rekap nilai dan TP." /> : <>
          {isHalaqohSubject(subject) && <div className="mb-4"><RekapHalaqoh classId={classId} students={students} /></div>}
          <div className="mb-4 space-y-3"><NilaiManual classId={classId} subject={subject} students={students} /><NilaiKelompok classId={classId} subject={subject} students={students} /></div>
          <TpRecapWorkspace classId={classId} subject={subject} className={activeClass?.name ?? ""} students={students} />
        </>}
      </>}
      <div className="mt-6"><SheetBackupCard /></div>
    </DashboardShell>
  );
}
