import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, RotateCcw, Play } from "lucide-react";
import { DashboardShell, PageHeader } from "@/components/dashboard-shell";
import { PracticeGenerator, PracticeReviewList, PracticeTutor, type PracticeMeta } from "@/components/ai-practice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVEL_TO_DIFFICULTY, type PracticeQuestion } from "@/lib/ai-practice";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QuestionBankInsert = Database["public"]["Tables"]["question_bank"]["Insert"];

const TITLE = "Latihan AI Guru · Pelajaranku";
const DESC = "Buat Latihan Soal Literasi interaktif dengan pilihan ganda, pilihan ganda kompleks, dan tabel pernyataan Benar/Salah, lalu simpan ke Bank Soal.";

export const Route = createFileRoute("/_authenticated/guru/latihan-ai")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: GuruLatihanAi,
});

function GuruLatihanAi() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [meta, setMeta] = useState<PracticeMeta | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [purpose, setPurpose] = useState("latihan");
  const [grade, setGrade] = useState("");
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !questions || !meta) throw new Error("Belum ada soal.");
      const rows: QuestionBankInsert[] = questions.filter((_, i) => selected.has(i)).flatMap((q): QuestionBankInsert[] => {
        const base = {
          teacher_id: user.id, subject: meta.subject, topic: meta.topic, grade_level: grade || null,
          stimulus: q.stimulus || null, difficulty: LEVEL_TO_DIFFICULTY[meta.level],
          indicator: [purpose !== "latihan" ? purpose[0].toUpperCase() + purpose.slice(1) : "", q.concept].filter(Boolean).join(" · ") || null,
          exam_category: "harian",
        };
        if (q.type === "statement_table") return q.statements.map((statement, statementIndex) => ({
          ...base,
          question: `${q.question} — Pernyataan ${statementIndex + 1}: ${statement.text}`,
          type: "true_false" as const, options: null, answer: statement.answer ? "Benar" : "Salah",
        }));
        if (q.type === "complex_multiple_choice") return [{
          ...base, question: q.question, type: "complex_multiple_choice" as const,
          options: q.options, answer: q.correctIndices.map((index) => q.options[index]).join(", "),
        }];
        return [{
          ...base, question: q.question, type: "multiple_choice" as const,
          options: q.options, answer: q.options[q.correctIndex],
        }];
      });
      if (!rows.length) throw new Error("Pilih minimal 1 soal.");
      const { error } = await supabase.from("question_bank").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`${n} butir soal tersimpan di Bank Soal.`); setSaved(true); qc.invalidateQueries({ queryKey: ["question_bank"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan."),
  });

  const reset = () => { setQuestions(null); setMeta(null); setSaved(false); setPreview(false); };
  const toggle = (i: number) => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <DashboardShell accent="guru">
      <PageHeader title="Latihan AI" subtitle="Buat paket Literasi interaktif untuk kelas, remedial, atau pengayaan siswa dengan tiga bentuk soal." />
      {!questions && <PracticeGenerator onReady={(qs, m) => { setQuestions(qs); setMeta(m); setSelected(new Set(qs.map((_, i) => i))); }} />}
      {questions && preview && <PracticeTutor questions={questions} onRestart={() => setPreview(false)} />}
      {questions && !preview && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 grid gap-3 sm:grid-cols-3 items-end">
            <div className="space-y-1.5"><Label>Tujuan paket</Label>
              <Select value={purpose} onValueChange={setPurpose}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="latihan">Latihan kelas</SelectItem><SelectItem value="remedial">Remedial</SelectItem><SelectItem value="pengayaan">Pengayaan</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Kelas / jenjang (opsional)</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="cth. 7" /></div>
            <p className="text-sm text-muted-foreground">{selected.size} dari {questions.length} soal dipilih</p>
          </div>
          <PracticeReviewList questions={questions} selected={selected} onToggle={toggle} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || saved || !selected.size}><Save className="size-4" /> {saved ? "Sudah tersimpan" : "Simpan ke Bank Soal"}</Button>
            <Button variant="outline" onClick={() => setPreview(true)}><Play className="size-4" /> Coba sebagai siswa</Button>
            <Button variant="ghost" onClick={reset}><RotateCcw className="size-4" /> Buat ulang</Button>
            {saved && <Button variant="link" asChild><Link to="/guru/bank-soal">Buka Bank Soal untuk dibagikan sebagai tugas</Link></Button>}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
