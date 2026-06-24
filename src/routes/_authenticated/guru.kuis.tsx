import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Plus, Trash2, X, CheckCircle2, Users2, ChevronDown, ChevronUp, Database, ClipboardCheck, BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { SubjectSelect } from "@/components/subject-select";
import { computeTotal, predikatOf, TAJWID_TOLERANCE, HELP_TOLERANCE } from "@/lib/mutabaah";

export const Route = createFileRoute("/_authenticated/guru/kuis")({
  head: () => ({ meta: [{ title: "Tugas & Kuis · EduQuest Academy" }] }),
  component: GuruKuisPage,
});

const MAX_QUESTIONS = 40;

export type QType = "multiple_choice" | "true_false" | "short_answer" | "essay" | "voice";

export const Q_TYPE_LABEL = (type: QType, lang: string): string => {
  const map: Record<QType, [string, string]> = {
    multiple_choice: ["Pilihan Ganda", "Multiple Choice"],
    true_false: ["Benar / Salah", "True / False"],
    short_answer: ["Isian Singkat", "Short Answer"],
    essay: ["Esai (manual)", "Essay (manual)"],
    voice: ["Jawaban Audio (manual)", "Audio Answer (manual)"],
  };
  return lang === "id" ? map[type][0] : map[type][1];
};

const isManual = (type: QType) => type === "essay" || type === "voice";

type QQ = {
  type: QType;
  q: string;
  options: string[];
  correctIndex: number;
  tf: boolean;
  shortAnswer: string;
  image_url?: string | null;
};

const emptyQuestion = (type: QType = "multiple_choice"): QQ => ({
  type,
  q: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  tf: true,
  shortAnswer: "",
  image_url: null,
});

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

const isHalaqoh = (subject?: string | null) => !!subject && /halaqoh/i.test(subject);

function GuruKuisPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<KForm>(emptyForm());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bankOpen, setBankOpen] = useState(false);

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: bank = [] } = useQuery({
    queryKey: ["qb-pick", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("question_bank").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, classes(name), submissions(id, status, score, student_id, content, feedback)")
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
  const addQuestion = (type: QType = "multiple_choice") =>
    setForm((f) => {
      if (f.questions.length >= MAX_QUESTIONS) {
        toast.error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS} questions`);
        return f;
      }
      return { ...f, questions: [...f.questions, emptyQuestion(type)] };
    });
  const removeQuestion = (i: number) =>
    setForm((f) => ({ ...f, questions: f.questions.length > 1 ? f.questions.filter((_, idx) => idx !== i) : f.questions }));

  const importBank = (ids: string[]) => {
    const picked = (bank as any[]).filter((b) => ids.includes(b.id));
    const mapped: QQ[] = picked.map((b) => {
      const opts: string[] = Array.isArray(b.options) ? b.options : [];
      if (b.type === "multiple_choice" || b.type === "complex_multiple_choice") {
        const idx = Math.max(0, opts.findIndex((o) => o.trim().toLowerCase() === String(b.answer ?? "").split(",")[0].trim().toLowerCase()));
        return { type: "multiple_choice", q: b.question, options: opts.length ? opts : ["", ""], correctIndex: idx, tf: true, shortAnswer: "", image_url: b.image_url };
      }
      if (b.type === "true_false") {
        const a = String(b.answer ?? "").trim().toLowerCase();
        const truthy = ["true", "benar", "b", "ya", "yes", "1"].includes(a);
        return { type: "true_false", q: b.question, options: [], correctIndex: 0, tf: truthy, shortAnswer: "", image_url: b.image_url };
      }
      if (b.type === "voice" || b.halaqoh_kind) {
        return { type: "voice", q: b.question, options: [], correctIndex: 0, tf: true, shortAnswer: "", image_url: b.image_url };
      }
      if (b.type === "short_answer") {
        return { type: "short_answer", q: b.question, options: [], correctIndex: 0, tf: true, shortAnswer: String(b.answer ?? ""), image_url: b.image_url };
      }
      // essay (and any other) -> essay manual
      return { type: "essay", q: b.question, options: [], correctIndex: 0, tf: true, shortAnswer: "", image_url: b.image_url };
    });
    setForm((f) => {
      const room = MAX_QUESTIONS - f.questions.filter((q) => q.q.trim()).length;
      const toAdd = mapped.slice(0, Math.max(0, room));
      // Drop a single leading empty question so imports feel clean.
      const base = f.questions.length === 1 && !f.questions[0].q.trim() ? [] : f.questions;
      return { ...f, questions: [...base, ...toAdd].slice(0, MAX_QUESTIONS) };
    });
    setBankOpen(false);
    toast.success(lang === "id" ? `${Math.min(mapped.length, MAX_QUESTIONS)} soal ditambahkan` : `${Math.min(mapped.length, MAX_QUESTIONS)} questions added`);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!form.title.trim()) throw new Error(lang === "id" ? "Judul wajib diisi" : "Title is required");
      if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas tujuan" : "Select a target class");

      const questionsPublic: any[] = [];
      const answerKey: any[] = [];
      form.questions.forEach((q, i) => {
        const prompt = q.q.trim();
        if (!prompt) throw new Error((lang === "id" ? "Soal " : "Question ") + (i + 1) + (lang === "id" ? " belum diisi" : " is empty"));
        if (q.type === "multiple_choice") {
          const options = q.options.map((o) => o.trim()).filter(Boolean);
          if (options.length < 2) throw new Error((lang === "id" ? "Soal " : "Question ") + (i + 1) + (lang === "id" ? " butuh minimal 2 pilihan" : " needs at least 2 options"));
          const correctIndex = Math.min(q.correctIndex, options.length - 1);
          questionsPublic.push({ type: "multiple_choice", q: prompt, options, image_url: q.image_url ?? null });
          answerKey.push(correctIndex);
        } else if (q.type === "true_false") {
          questionsPublic.push({ type: "true_false", q: prompt, options: [lang === "id" ? "Benar" : "True", lang === "id" ? "Salah" : "False"], image_url: q.image_url ?? null });
          answerKey.push(q.tf ? "true" : "false");
        } else if (q.type === "short_answer") {
          if (!q.shortAnswer.trim()) throw new Error((lang === "id" ? "Soal " : "Question ") + (i + 1) + (lang === "id" ? " butuh kunci jawaban" : " needs an answer key"));
          questionsPublic.push({ type: "short_answer", q: prompt, image_url: q.image_url ?? null });
          answerKey.push(q.shortAnswer.trim());
        } else {
          // essay or voice (manual)
          questionsPublic.push({ type: q.type, q: prompt, image_url: q.image_url ?? null });
          answerKey.push(null);
        }
      });
      if (questionsPublic.length === 0) throw new Error(lang === "id" ? "Tambahkan minimal 1 soal" : "Add at least 1 question");
      if (questionsPublic.length > MAX_QUESTIONS) throw new Error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS} questions`);

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
        title={lang === "id" ? "Tugas & Kuis" : "Assignments & Quizzes"}
        subtitle={lang === "id" ? `Campur tipe soal (PG, B/S, isian, esai, audio) hingga ${MAX_QUESTIONS} soal` : `Mix question types up to ${MAX_QUESTIONS} questions`}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
            <DialogTrigger asChild>
              <Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Kuis Baru" : "New Quiz"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{lang === "id" ? "Susun Tugas / Kuis" : "Build Assignment / Quiz"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{lang === "id" ? "Judul" : "Title"} <span className="text-destructive">*</span></Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={lang === "id" ? "mis. Ulangan Tajwid Bab 1" : "e.g. Tajwid Test Ch.1"} />
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
                {isHalaqoh(form.subject) && (
                  <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700">
                    <BookOpenCheck className="mr-1 inline size-4" />
                    {lang === "id" ? "Mapel Halaqoh: saat menilai, kamu bisa isi komponen Tahfidz yang otomatis tercatat ke Mutaba'ah." : "Halaqoh subject: grading lets you fill Tahfidz components saved to Mutaba'ah."}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>{lang === "id" ? "Tenggat (opsional)" : "Due (optional)"}</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Nilai</Label><Input type="number" min={1} value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">XP</Label><Input type="number" min={0} value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Koin</Label><Input type="number" min={0} value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: Number(e.target.value) })} /></div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Label className="text-base font-bold">{lang === "id" ? "Soal" : "Questions"} <span className="text-muted-foreground font-normal">({totalQ}/{MAX_QUESTIONS})</span></Label>
                  <div className="flex flex-wrap gap-2">
                    <Dialog open={bankOpen} onOpenChange={setBankOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" size="sm" variant="outline"><Database className="size-4" /> {lang === "id" ? "Dari Bank Soal" : "From Bank"}</Button>
                      </DialogTrigger>
                      <BankPickerDialog bank={bank as any[]} onPick={importBank} lang={lang} />
                    </Dialog>
                    <Select value="" onValueChange={(v) => addQuestion(v as QType)}>
                      <SelectTrigger className="h-9 w-auto gap-1"><Plus className="size-4" /><span className="text-sm">{lang === "id" ? "Tambah Soal" : "Add"}</span></SelectTrigger>
                      <SelectContent>
                        {(["multiple_choice", "true_false", "short_answer", "essay", "voice"] as QType[]).map((tp) => (
                          <SelectItem key={tp} value={tp}>{Q_TYPE_LABEL(tp, lang)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  {form.questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border-2 border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold">{lang === "id" ? "Soal" : "Q"} {qi + 1}</span>
                        <div className="flex items-center gap-2">
                          <Select value={q.type} onValueChange={(v) => setQ(qi, { type: v as QType })}>
                            <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(["multiple_choice", "true_false", "short_answer", "essay", "voice"] as QType[]).map((tp) => (
                                <SelectItem key={tp} value={tp}>{Q_TYPE_LABEL(tp, lang)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {form.questions.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeQuestion(qi)}><Trash2 className="size-4 text-destructive" /></Button>
                          )}
                        </div>
                      </div>
                      <Textarea rows={2} className="mt-2" placeholder={lang === "id" ? "Tulis pertanyaan…" : "Write the question…"} value={q.q} onChange={(e) => setQ(qi, { q: e.target.value })} />

                      {q.type === "multiple_choice" && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground">{lang === "id" ? "Tandai lingkaran untuk jawaban benar." : "Tap the circle to mark the correct answer."}</p>
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
                      )}

                      {q.type === "true_false" && (
                        <div className="mt-2 flex gap-2">
                          {[true, false].map((val) => (
                            <button key={String(val)} type="button" onClick={() => setQ(qi, { tf: val })}
                              className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${q.tf === val ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border"}`}>
                              {val ? (lang === "id" ? "Benar ✓" : "True ✓") : (lang === "id" ? "Salah ✗" : "False ✗")}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === "short_answer" && (
                        <div className="mt-2">
                          <Label className="text-xs">{lang === "id" ? "Kunci jawaban (pisahkan alternatif dengan |)" : "Answer key (separate alternatives with |)"}</Label>
                          <Input value={q.shortAnswer} onChange={(e) => setQ(qi, { shortAnswer: e.target.value })} placeholder={lang === "id" ? "mis. mad|maddah" : "e.g. mad|maddah"} />
                        </div>
                      )}

                      {isManual(q.type) && (
                        <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700">
                          {lang === "id" ? "Dinilai manual oleh guru setelah siswa menjawab." : "Graded manually by the teacher after submission."}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="guru" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending ? (lang === "id" ? "Menyimpan…" : "Saving…") : (lang === "id" ? "Simpan" : "Save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(quizzes as any[]).length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada kuis. Buat kuis campuran tipe soal pertamamu!" : "No quizzes yet. Create your first mixed quiz!"} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(quizzes as any[]).map((quiz) => {
            const qList = Array.isArray(quiz.questions) ? quiz.questions : [];
            const subs = (quiz.submissions ?? []) as any[];
            const avg = subs.length ? Math.round(subs.reduce((s, x) => s + (x.score ?? 0), 0) / subs.length) : null;
            const pending = subs.filter((s) => s.status === "submitted").length;
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
                      {quiz.classes?.name ?? "—"} · {qList.length} {lang === "id" ? "soal" : "questions"}
                      {quiz.subject ? ` · ${quiz.subject}` : ""}
                      {quiz.due_at ? ` · ${lang === "id" ? "tenggat" : "due"} ${format(new Date(quiz.due_at), "dd MMM")}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => deleteMut.mutate(quiz.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-siswa/15 px-3 py-1 font-display font-bold text-siswa"><Users2 className="mr-1 inline size-3" />{subs.length} {lang === "id" ? "mengerjakan" : "done"}</span>
                  {pending > 0 && <span className="rounded-full bg-amber-500/15 px-3 py-1 font-display font-bold text-amber-700"><ClipboardCheck className="mr-1 inline size-3" />{pending} {lang === "id" ? "perlu dinilai" : "to grade"}</span>}
                  {avg !== null && <span className="rounded-full bg-xp/15 px-3 py-1 font-display font-bold text-xp">{lang === "id" ? "rata-rata" : "avg"} {avg}</span>}
                  <span className="rounded-full bg-quest/15 px-3 py-1 font-display font-bold text-quest">{quiz.xp_reward} XP</span>
                </div>
                {subs.length > 0 && (
                  <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setExpanded(isOpen ? null : quiz.id)}>
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    {lang === "id" ? "Lihat & nilai hasil siswa" : "View & grade results"}
                  </button>
                )}
                {isOpen && <ResultsList quiz={quiz} submissions={subs} lang={lang} />}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function BankPickerDialog({ bank, onPick, lang }: { bank: any[]; onPick: (ids: string[]) => void; lang: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{lang === "id" ? "Pilih dari Bank Soal" : "Pick from Question Bank"}</DialogTitle></DialogHeader>
      {bank.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{lang === "id" ? "Bank Soal masih kosong." : "Question bank is empty."}</p>
      ) : (
        <div className="space-y-2">
          {bank.map((b) => (
            <button key={b.id} type="button" onClick={() => toggle(b.id)}
              className={`flex w-full items-start gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm ${sel.includes(b.id) ? "border-guru bg-guru/10" : "border-border hover:bg-muted"}`}>
              <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2 ${sel.includes(b.id) ? "border-guru bg-guru text-white" : "border-muted-foreground/40"}`}>
                {sel.includes(b.id) && <CheckCircle2 className="size-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 font-semibold">{b.question}</span>
                <span className="text-xs text-muted-foreground">{b.subject ?? "—"} · {b.type}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <DialogFooter>
        <Button variant="guru" disabled={sel.length === 0} onClick={() => onPick(sel)}>{lang === "id" ? `Tambah ${sel.length} soal` : `Add ${sel.length}`}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResultsList({ quiz, submissions, lang }: { quiz: any; submissions: any[]; lang: string }) {
  const ids = submissions.map((s) => s.student_id);
  const [grading, setGrading] = useState<any | null>(null);
  const { data: profs = [] } = useQuery({
    queryKey: ["quiz-result-profs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [],
  });
  const name = (id: string) => (profs as any[]).find((p) => p.id === id)?.full_name ?? "—";
  return (
    <>
      <ul className="mt-2 space-y-1 border-t border-border pt-2">
        {submissions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
            <span className="truncate font-display font-semibold">{name(s.student_id)}</span>
            <div className="flex items-center gap-2">
              {s.status === "submitted" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700">{lang === "id" ? "perlu nilai" : "to grade"}</span>}
              <span className="font-display font-bold text-primary">{s.score ?? 0}<span className="text-xs text-muted-foreground">/{quiz.max_score}</span></span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => setGrading(s)}>{lang === "id" ? "Nilai" : "Grade"}</Button>
            </div>
          </li>
        ))}
      </ul>
      {grading && (
        <GradeSubmissionDialog quiz={quiz} submission={grading} studentName={name(grading.student_id)} onClose={() => setGrading(null)} />
      )}
    </>
  );
}

function GradeSubmissionDialog({ quiz, submission, studentName, onClose }: { quiz: any; submission: any; studentName: string; onClose: () => void }) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const questions: any[] = Array.isArray(quiz.questions) ? quiz.questions : [];
  const studentAnswers: any[] = useMemo(() => {
    try { return JSON.parse(submission.content ?? "[]"); } catch { return []; }
  }, [submission.content]);
  const [score, setScore] = useState<number>(submission.score ?? 0);
  const [feedback, setFeedback] = useState<string>(submission.feedback ?? "");
  const [voiceUrls, setVoiceUrls] = useState<Record<number, string>>({});
  const halaqoh = isHalaqoh(quiz.subject);
  const [maba, setMaba] = useState({ tajwid: 80, tajErr: 0, kelancaran: 80, helps: 0, fashohah: 80, aurat: true, focus: true, etika: true, sendMutabaah: halaqoh });

  useEffect(() => {
    let active = true;
    (async () => {
      const next: Record<number, string> = {};
      for (let i = 0; i < questions.length; i++) {
        if (questions[i]?.type === "voice" && studentAnswers[i]) {
          const { data } = await supabase.storage.from("voice-answers").createSignedUrl(studentAnswers[i], 3600);
          if (data?.signedUrl) next[i] = data.signedUrl;
        }
      }
      if (active) setVoiceUrls(next);
    })();
    return () => { active = false; };
  }, [questions, studentAnswers]);

  const total = computeTotal(maba.tajwid, maba.kelancaran, maba.fashohah);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("submissions")
        .update({ score, feedback: feedback.trim() || null, status: "graded" })
        .eq("id", submission.id);
      if (error) throw error;

      if (halaqoh && maba.sendMutabaah) {
        const { error: mErr } = await supabase.from("tahfidz_mutabaah").insert({
          teacher_id: quiz.teacher_id,
          student_id: submission.student_id,
          class_id: quiz.class_id,
          session_date: new Date().toISOString().slice(0, 10),
          session_type: "ziyadah",
          tajwid_score: maba.tajwid,
          tajwid_errors: maba.tajErr,
          kelancaran_score: maba.kelancaran,
          kelancaran_helps: maba.helps,
          fashohah_score: maba.fashohah,
          adab_aurat: maba.aurat,
          adab_focus: maba.focus,
          adab_etika: maba.etika,
          total_score: total,
          predikat: predikatOf(total, lang),
          notes: feedback.trim() || `Dari tugas: ${quiz.title}`,
        } as any);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Nilai disimpan" + (halaqoh && maba.sendMutabaah ? " & dikirim ke Mutaba'ah" : "") : "Grade saved");
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Nilai" : "Grade"} · {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const ans = studentAnswers[i];
            return (
              <div key={i} className="rounded-xl border-2 border-border bg-muted/20 p-3 text-sm">
                <p className="font-display font-bold">{i + 1}. {q.q} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{Q_TYPE_LABEL(q.type, lang)}</span></p>
                <div className="mt-1.5 text-foreground/80">
                  {q.type === "voice" ? (
                    voiceUrls[i] ? <audio controls src={voiceUrls[i]} className="mt-1 w-full" /> : <span className="text-muted-foreground">{lang === "id" ? "(memuat audio…)" : "(loading audio…)"}</span>
                  ) : q.type === "multiple_choice" ? (
                    <span>{lang === "id" ? "Jawaban:" : "Answer:"} {Array.isArray(q.options) && q.options[Number(ans)] != null ? q.options[Number(ans)] : "—"}</span>
                  ) : q.type === "true_false" ? (
                    <span>{lang === "id" ? "Jawaban:" : "Answer:"} {String(ans) === "true" ? (lang === "id" ? "Benar" : "True") : String(ans) === "false" ? (lang === "id" ? "Salah" : "False") : "—"}</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{ans || "—"}</span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>{lang === "id" ? "Nilai Akhir" : "Final Score"} (/{quiz.max_score})</Label><Input type="number" min={0} max={quiz.max_score} value={score} onChange={(e) => setScore(Number(e.target.value))} /></div>
          </div>
          <div><Label>{lang === "id" ? "Catatan / Koreksi" : "Feedback"}</Label><Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>

          {halaqoh && (
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <input type="checkbox" checked={maba.sendMutabaah} onChange={(e) => setMaba({ ...maba, sendMutabaah: e.target.checked })} />
                <BookOpenCheck className="size-4" /> {lang === "id" ? "Catat otomatis ke Mutaba'ah Tahfidz" : "Auto-record to Mutaba'ah"}
              </label>
              {maba.sendMutabaah && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div><Label className="text-xs">Tajwid & Makhraj</Label><Input type="number" min={0} max={100} value={maba.tajwid} onChange={(e) => setMaba({ ...maba, tajwid: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Kelancaran</Label><Input type="number" min={0} max={100} value={maba.kelancaran} onChange={(e) => setMaba({ ...maba, kelancaran: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Fashohah & Adab</Label><Input type="number" min={0} max={100} value={maba.fashohah} onChange={(e) => setMaba({ ...maba, fashohah: Number(e.target.value) })} /></div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">{lang === "id" ? "Kesalahan tajwid" : "Tajwid errors"} (max {TAJWID_TOLERANCE})</Label>
                      <Input type="number" min={0} value={maba.tajErr} onChange={(e) => setMaba({ ...maba, tajErr: Number(e.target.value) })} className={maba.tajErr > TAJWID_TOLERANCE ? "border-destructive" : ""} />
                    </div>
                    <div>
                      <Label className="text-xs">{lang === "id" ? "Bantuan kata" : "Prompts"} (max {HELP_TOLERANCE})</Label>
                      <Input type="number" min={0} value={maba.helps} onChange={(e) => setMaba({ ...maba, helps: Number(e.target.value) })} className={maba.helps > HELP_TOLERANCE ? "border-destructive" : ""} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={maba.aurat} onChange={(e) => setMaba({ ...maba, aurat: e.target.checked })} /> {lang === "id" ? "Menutup aurat" : "Aurat covered"}</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={maba.focus} onChange={(e) => setMaba({ ...maba, focus: e.target.checked })} /> {lang === "id" ? "Fokus" : "Focused"}</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={maba.etika} onChange={(e) => setMaba({ ...maba, etika: e.target.checked })} /> {lang === "id" ? "Adab/etika" : "Etiquette"}</label>
                  </div>
                  <p className="text-xs font-semibold text-emerald-700">{lang === "id" ? "Nilai Tahfidz" : "Tahfidz total"}: {total} · {predikatOf(total, lang)}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{lang === "id" ? "Batal" : "Cancel"}</Button>
          <Button variant="guru" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? "…" : (lang === "id" ? "Simpan Nilai" : "Save Grade")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
