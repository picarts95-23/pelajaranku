import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ChevronDown, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard-shell";
import { ExportMenu } from "@/components/export-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentProgressEditor } from "@/components/student-progress-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { applyStudentProgress, buildDevelopmentSummary, type DevelopmentAttempt, type ProgressRecord } from "@/lib/student-progress";
import { computeTpRecap, type Weights } from "@/lib/tp-recap";

type Student = { id: string; full_name: string };

export function StudentProgressDocs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<string | null>(null);
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subject, subjects").order("name")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["progress-doc-students", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: enrolled, error } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      if (error) throw error;
      const ids = (enrolled ?? []).map((item) => item.student_id);
      if (!ids.length) return [] as Student[];
      const { data, error: profileError } = await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name");
      if (profileError) throw profileError;
      return data ?? [];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["progress-doc-assignments", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("id, class_id, subject, objective_id, objective_weights, assessment_kind, max_score, submissions(student_id, score, status, feedback)").eq("class_id", classId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const subjects = useMemo(() => {
    const selected = classes.find((item) => item.id === classId);
    return Array.from(new Set([...(selected?.subjects ?? []), selected?.subject, ...assignments.map((item) => item.subject)].filter((item): item is string => !!item))).sort();
  }, [classes, classId, assignments]);
  const { data: objectives = [] } = useQuery({
    queryKey: ["learning-objectives", subject, classId], enabled: !!classId && !!subject,
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_objectives").select("id, code, description, sort_order").eq("subject", subject).or(`class_id.is.null,class_id.eq.${classId}`).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["rekap-attendance", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId)).data ?? [],
  });
  const { data: adab = [] } = useQuery({
    queryKey: ["rekap-adab", classId, subject], enabled: !!classId && !!subject,
    queryFn: async () => (await supabase.from("adab_scores").select("student_id, score").eq("class_id", classId).eq("subject", subject)).data ?? [],
  });
  const { data: savedWeights } = useQuery({
    queryKey: ["grade-weights", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("grade_weights").select("sumatif, adab, absensi").eq("teacher_id", user!.id).maybeSingle()).data,
  });
  const { data: attempts = [] } = useQuery({
    queryKey: ["practice-attempts", classId, subject], enabled: !!classId && !!subject,
    queryFn: async () => {
      const { data, error } = await supabase.from("practice_attempts").select("student_id, topic, score, feedback, created_at").eq("class_id", classId).eq("subject", subject).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (DevelopmentAttempt & { student_id: string })[];
    },
  });
  const { data: records = [] } = useQuery({
    queryKey: ["student-progress-records", classId, subject], enabled: !!classId && !!subject,
    queryFn: async () => {
      const { data, error } = await supabase.from("student_progress_records").select("student_id, objective_scores, development_notes, report_description").eq("class_id", classId).eq("subject", subject);
      if (error) throw error;
      return (data ?? []) as ProgressRecord[];
    },
  });
  const weights: Weights = { sumatif: savedWeights?.sumatif ?? 60, adab: savedWeights?.adab ?? 20, absensi: savedWeights?.absensi ?? 20 };
  const rows = useMemo(() => !classId || !subject ? [] : computeTpRecap({
    students, objectives, assignments: assignments.filter((item) => item.subject === subject), attendance, adab, weights,
  }).map((row) => applyStudentProgress(row, objectives, records.find((record) => record.student_id === row.student_id), weights)), [classId, subject, students, objectives, assignments, attendance, adab, records, savedWeights]);
  const attemptsFor = (studentId: string) => attempts.filter((attempt) => attempt.student_id === studentId);
  const aiAverage = (studentId: string) => {
    const list = attemptsFor(studentId);
    return list.length ? Math.round(list.reduce((sum, attempt) => sum + attempt.score, 0) / list.length) : null;
  };
  const exportRows = () => rows.map((row) => {
    const record = records.find((item) => item.student_id === row.student_id);
    return {
      student: row.name,
      tp: objectives.map((objective) => `${objective.code}: ${row.perTp[objective.id] ?? "—"}`).join(" | "),
      final: row.final ?? "",
      development: record?.development_notes ?? buildDevelopmentSummary(row, attemptsFor(row.student_id)),
      report: row.description,
    };
  });

  return <div className="space-y-4">
    <div><h2 className="font-display text-lg font-bold">Catatan Perkembangan & Deskripsi Rapor</h2><p className="text-sm text-muted-foreground">Akumulasi nilai TP, asesmen lain, formatif, dan ulasan Latihan AI. Semua catatan dapat diedit sebelum digunakan untuk rapor.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Select value={classId} onValueChange={(value) => { setClassId(value); setSubject(""); setOpenStudent(null); }}><SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger><SelectContent>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={subject} onValueChange={setSubject} disabled={!classId}><SelectTrigger><SelectValue placeholder="Pilih mata pelajaran" /></SelectTrigger><SelectContent>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
    </div>
    {!classId || !subject ? <EmptyState message="Pilih kelas dan mata pelajaran untuk melihat dokumen perkembangan siswa." /> : <>
      <div className="flex justify-end">{rows.length > 0 && <ExportMenu filename={`perkembangan-${subject}`} title={`Catatan Perkembangan & Rapor · ${subject}`} columns={[{ key: "student", header: "Nama Siswa" }, { key: "tp", header: "Nilai per TP" }, { key: "final", header: "Nilai Akhir" }, { key: "development", header: "Catatan Perkembangan" }, { key: "report", header: "Deskripsi Rapor" }]} rows={exportRows} />}</div>
      {!rows.length ? <EmptyState message="Belum ada siswa pada kelas ini." /> : <div className="space-y-3">{rows.map((row) => {
        const record = records.find((item) => item.student_id === row.student_id);
        const studentAttempts = attemptsFor(row.student_id);
        const open = openStudent === row.student_id;
        return <article key={row.student_id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
          <div className="flex flex-wrap items-center gap-3">
            <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenStudent(open ? null : row.student_id)}><ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : "-rotate-90"}`} /><span className="min-w-0"><span className="block truncate font-display font-bold">{row.name}</span><span className="text-xs text-muted-foreground">Nilai akhir {row.final ?? "—"} · {objectives.filter((objective) => row.perTp[objective.id] !== null).length} TP bernilai · Latihan AI {aiAverage(row.student_id) ?? "—"}</span></span></button>
            <Button size="sm" variant="outline" onClick={() => setEditStudent(row.student_id)}><Pencil className="size-4" /> Edit Nilai & Catatan</Button>
          </div>
          {open && <div className="mt-4 space-y-3 border-t border-border pt-4">
            <section><h3 className="flex items-center gap-2 font-display font-semibold"><BookOpenCheck className="size-4 text-primary" />Catatan perkembangan</h3><p className="mt-2 whitespace-pre-wrap text-sm">{record?.development_notes ?? buildDevelopmentSummary(row, studentAttempts)}</p>{studentAttempts.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Dihimpun dari {studentAttempts.length} sesi Latihan AI dan penilaian lain.</p>}</section>
            <section className="rounded-xl bg-muted/40 p-3"><h3 className="flex items-center gap-2 font-display font-semibold"><FileText className="size-4 text-primary" />Deskripsi rapor</h3><p className="mt-2 text-sm">{row.description}</p></section>
          </div>}
        </article>;
      })}</div>}
    </>}
    {editStudent && rows.find((row) => row.student_id === editStudent) && <StudentProgressEditor key={editStudent} classId={classId} subject={subject} row={rows.find((row) => row.student_id === editStudent)!} objectives={objectives} record={records.find((record) => record.student_id === editStudent)} attempts={attemptsFor(editStudent)} open={!!editStudent} onOpenChange={(open) => { if (!open) setEditStudent(null); }} onSaved={() => qc.invalidateQueries({ queryKey: ["student-progress-records", classId, subject] })} />}
  </div>;
}
