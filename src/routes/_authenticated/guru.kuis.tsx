import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Plus, Trash2, X, CheckCircle2, Users2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { SubjectSelect } from "@/components/subject-select";

export const Route = createFileRoute("/_authenticated/guru/kuis")({
  head: () => ({ meta: [{ title: "Kuis Pilihan Ganda · EduQuest Academy" }] }),
  component: GuruKuisPage,
});

const MAX_QUESTIONS = 40;

type QQ = { q: string; options: string[]; correctIndex: number };
const emptyQuestion = (): QQ => ({ q: "", options: ["", "", "", ""], correctIndex: 0 });

type KForm = {
  class_id: string;
  title: string;
  subject: string;
  description: string;
  due_at: string;
  max_score: number;
  xp_reward: number;
  coin_reward: number;
  questions: QQ[];
};

const emptyForm = (): KForm => ({
  class_id: "",
  title: "",
  subject: "",
  description: "",
  due_at: "",
  max_score: 100,
  xp_reward: 50,
  coin_reward: 10,
  questions: [emptyQuestion()],
});

function GuruKuisPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<KForm>(emptyForm());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, classes(name), submissions(id, status, score, student_id)")
        .eq("answer_format", "quiz")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setQ = (i: number, patch: Partial<QQ>) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) }));
  const setOpt = (qi: number, oi: number, v: string) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? v : o)) } : q,
      ),
    }));
  const addOpt = (qi: number) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, idx) => (idx === qi ? { ...q, options: [...q.options, ""] } : q)) }));
  const removeOpt = (qi: number, oi: number) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, idx) => {
        if (idx !== qi) return q;
        const options = q.options.filter((_, j) => j !== oi);
        const correctIndex = q.correctIndex >= options.length ? Math.max(0, options.length - 1) : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    }));
  const addQuestion = () =>
    setForm((f) => {
      if (f.questions.length >= MAX_QUESTIONS) {
        toast.error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS} questions`);
        return f;
      }
      return { ...f, questions: [...f.questions, emptyQuestion()] };
    });
  const removeQuestion = (i: number) =>
    setForm((f) => ({ ...f, questions: f.questions.length > 1 ? f.questions.filter((_, idx) => idx !== i) : f.questions }));

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!form.title.trim()) throw new Error(lang === "id" ? "Judul kuis wajib diisi" : "Quiz title is required");
      if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas tujuan" : "Select a target class");

      // Validate & normalise questions.
      const cleaned = form.questions.map((q, i) => {
        const prompt = q.q.trim();
        const options = q.options.map((o) => o.trim()).filter(Boolean);
        if (!prompt) throw new Error((lang === "id" ? "Soal " : "Question ") + (i + 1) + (lang === "id" ? " belum diisi" : " is empty"));
        if (options.length < 2)
          throw new Error((lang === "id" ? "Soal " : "Question ") + (i + 1) + (lang === "id" ? " butuh minimal 2 pilihan" : " needs at least 2 options"));
        const correctIndex = Math.min(q.correctIndex, options.length - 1);
        return { q: prompt, options, correctIndex };
      });
      if (cleaned.length === 0) throw new Error(lang === "id" ? "Tambahkan minimal 1 soal" : "Add at least 1 question");
      if (cleaned.length > MAX_QUESTIONS) throw new Error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS} questions`);

      const questionsPublic = cleaned.map((q) => ({ q: q.q, options: q.options }));
      const answerKey = cleaned.map((q) => q.correctIndex);

      const { data: inserted, error } = await supabase
        .from("assignments")
        .insert({
          teacher_id: user.id,
          class_id: form.class_id,
          title: form.title.trim(),
          subject: form.subject || null,
          description: form.description.trim() || null,
          exam_type: "harian",
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          max_score: form.max_score,
          xp_reward: form.xp_reward,
          coin_reward: form.coin_reward,
          answer_format: "quiz",
          questions: questionsPublic as any,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      // Correct answers are kept separate so students can never read them.
      const { error: keyErr } = await supabase.from("assignment_answer_keys").insert({
        assignment_id: inserted!.id,
        teacher_id: user.id,
        answer_key: JSON.stringify(answerKey),
      });
      if (keyErr) throw keyErr;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kuis dibuat 🎉" : "Quiz created 🎉");
      setOpen(false);
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kuis dihapus" : "Quiz deleted");
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalQ = form.questions.length;

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={lang === "id" ? "Kuis Pilihan Ganda" : "Multiple-Choice Quiz"}
        subtitle={lang === "id" ? `Susun kuis hingga ${MAX_QUESTIONS} soal — dinilai otomatis` : `Build quizzes up to ${MAX_QUESTIONS} questions — auto-graded`}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
            <DialogTrigger asChild>
              <Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Kuis Baru" : "New Quiz"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{lang === "id" ? "Kuis Pilihan Ganda Baru" : "New Multiple-Choice Quiz"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{lang === "id" ? "Judul Kuis" : "Quiz Title"} <span className="text-destructive">*</span></Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={lang === "id" ? "mis. Kuis Tajwid Bab 1" : "e.g. Tajwid Quiz Ch.1"} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{lang === "id" ? "Kelas" : "Class"} <span className="text-destructive">*</span></Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.class_id}
                      onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                    >
                      <option value="">{lang === "id" ? "— pilih kelas —" : "— select class —"}</option>
                      {(classes as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><Label>{lang === "id" ? "Mata Pelajaran" : "Subject"}</Label><SubjectSelect value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>{lang === "id" ? "Tenggat (opsional)" : "Due (optional)"}</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Nilai</Label><Input type="number" min={1} value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">XP</Label><Input type="number" min={0} value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Koin</Label><Input type="number" min={0} value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: Number(e.target.value) })} /></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Label className="text-base font-bold">{lang === "id" ? "Soal" : "Questions"} <span className="text-muted-foreground font-normal">({totalQ}/{MAX_QUESTIONS})</span></Label>
                  <Button type="button" size="sm" variant="outline" onClick={addQuestion} disabled={totalQ >= MAX_QUESTIONS}><Plus className="size-4" /> {lang === "id" ? "Tambah Soal" : "Add Question"}</Button>
                </div>

                <div className="space-y-3">
                  {form.questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border-2 border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold">{lang === "id" ? "Soal" : "Q"} {qi + 1}</span>
                        {form.questions.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeQuestion(qi)}><Trash2 className="size-4 text-destructive" /></Button>
                        )}
                      </div>
                      <Textarea rows={2} className="mt-2" placeholder={lang === "id" ? "Tulis pertanyaan…" : "Write the question…"} value={q.q} onChange={(e) => setQ(qi, { q: e.target.value })} />
                      <p className="mt-2 text-xs text-muted-foreground">{lang === "id" ? "Tandai lingkaran untuk jawaban benar." : "Tap the circle to mark the correct answer."}</p>
                      <div className="mt-1 space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <button type="button" onClick={() => setQ(qi, { correctIndex: oi })}
                              className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${q.correctIndex === oi ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                              {q.correctIndex === oi && <CheckCircle2 className="size-4" />}
                            </button>
                            <Input value={opt} onChange={(e) => setOpt(qi, oi, e.target.value)} placeholder={`${lang === "id" ? "Pilihan" : "Option"} ${String.fromCharCode(65 + oi)}`} />
                            {q.options.length > 2 && (
                              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeOpt(qi, oi)}><X className="size-4" /></Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="ghost" onClick={() => addOpt(qi)}><Plus className="size-3" /> {lang === "id" ? "Pilihan" : "Option"}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="guru" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending ? (lang === "id" ? "Menyimpan…" : "Saving…") : (lang === "id" ? "Simpan Kuis" : "Save Quiz")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(quizzes as any[]).length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada kuis. Buat kuis pilihan ganda pertamamu!" : "No quizzes yet. Create your first multiple-choice quiz!"} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(quizzes as any[]).map((quiz) => {
            const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
            const subs = (quiz.submissions ?? []) as any[];
            const avg = subs.length ? Math.round(subs.reduce((s, x) => s + (x.score ?? 0), 0) / subs.length) : null;
            const isOpen = expanded === quiz.id;
            return (
              <div key={quiz.id} className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileQuestion className="size-5 text-accent" />
                      <h3 className="truncate font-display text-lg font-bold">{quiz.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quiz.classes?.name ?? "—"} · {qCount} {lang === "id" ? "soal" : "questions"}
                      {quiz.due_at ? ` · ${lang === "id" ? "tenggat" : "due"} ${format(new Date(quiz.due_at), "dd MMM")}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => deleteMut.mutate(quiz.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-siswa/15 px-3 py-1 font-display font-bold text-siswa"><Users2 className="mr-1 inline size-3" />{subs.length} {lang === "id" ? "mengerjakan" : "done"}</span>
                  {avg !== null && <span className="rounded-full bg-xp/15 px-3 py-1 font-display font-bold text-xp">{lang === "id" ? "rata-rata" : "avg"} {avg}</span>}
                  <span className="rounded-full bg-quest/15 px-3 py-1 font-display font-bold text-quest">{quiz.xp_reward} XP</span>
                </div>
                {subs.length > 0 && (
                  <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setExpanded(isOpen ? null : quiz.id)}>
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    {lang === "id" ? "Lihat hasil siswa" : "View student results"}
                  </button>
                )}
                {isOpen && <ResultsList submissions={subs} maxScore={quiz.max_score} lang={lang} />}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function ResultsList({ submissions, maxScore, lang }: { submissions: any[]; maxScore: number; lang: string }) {
  const ids = submissions.map((s) => s.student_id);
  const { data: profs = [] } = useQuery({
    queryKey: ["quiz-result-profs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [],
  });
  const name = (id: string) => (profs as any[]).find((p) => p.id === id)?.full_name ?? "—";
  return (
    <ul className="mt-2 space-y-1 border-t border-border pt-2">
      {submissions.map((s) => (
        <li key={s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
          <span className="truncate font-display font-semibold">{name(s.student_id)}</span>
          <span className="font-display font-bold text-primary">{s.score ?? 0}<span className="text-xs text-muted-foreground">/{maxScore}</span></span>
        </li>
      ))}
    </ul>
  );
}
