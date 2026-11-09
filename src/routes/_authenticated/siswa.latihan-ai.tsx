import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell, EmptyState, PageHeader } from "@/components/dashboard-shell";
import { PracticeGenerator, PracticeTutor, type PracticeMeta } from "@/components/ai-practice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PracticeQuestion } from "@/lib/ai-practice";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Latihan AI Siswa · Pelajaranku";
const DESC = "Buat sesi latihan adaptif dengan tutor AI: petunjuk bertahap, umpan balik instan, dan pembahasan langkah demi langkah.";

export const Route = createFileRoute("/_authenticated/siswa/latihan-ai")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SiswaLatihanAi,
});

type ClassChoice = { id: string; name: string; subject: string | null; subjects: string[] | null };

function SiswaLatihanAi() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [meta, setMeta] = useState<PracticeMeta | null>(null);
  const [classId, setClassId] = useState("");
  const { data: classes = [] } = useQuery({
    queryKey: ["student-practice-classes", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: enrolled, error } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      if (error) throw error;
      const ids = (enrolled ?? []).map((e) => e.class_id);
      if (!ids.length) return [] as ClassChoice[];
      const { data, error: classError } = await supabase.from("classes").select("id, name, subject, subjects").in("id", ids).order("name");
      if (classError) throw classError;
      return (data ?? []) as ClassChoice[];
    },
  });
  const activeClassId = classId || classes[0]?.id || "";
  const activeClass = classes.find((c) => c.id === activeClassId);
  const subjects = [...new Set([...(activeClass?.subjects ?? []), activeClass?.subject].filter((s): s is string => !!s))];

  return (
    <DashboardShell accent="siswa">
      <PageHeader title="Latihan AI" subtitle="Pilih kelas dan materi. Nilai tambahan serta umpan balik akan tersimpan di rekap dan Jurnal siswa." />
      {classes.length > 0 && <div className="mb-4 max-w-sm">
        <Label>Kelas untuk penyimpanan hasil</Label>
        <Select value={activeClassId} onValueChange={(v) => { setClassId(v); setQuestions(null); setMeta(null); }}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
          <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
      {!classes.length ? <EmptyState message="Kamu belum bergabung ke kelas. Gabung ke kelas dulu agar hasil latihan dapat direkap untuk guru." /> : questions && meta
        ? <PracticeTutor questions={questions} meta={meta} classId={activeClassId} persist onRestart={() => { setQuestions(null); setMeta(null); }} />
        : <PracticeGenerator key={activeClassId} subjectOptions={subjects} onReady={(qs, m) => { setQuestions(qs); setMeta(m); }} />}
    </DashboardShell>
  );
}
