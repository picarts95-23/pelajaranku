import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Plus, Trash2, Users2, ChevronDown, ChevronUp, ClipboardCheck, BookOpenCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { computeTotal, predikatOf, TAJWID_TOLERANCE, HELP_TOLERANCE } from "@/lib/mutabaah";
import { QuizTabs } from "@/components/quiz-tabs";
import {
  MAX_QUESTIONS, type BQ, TYPE_LABEL,
  buildBankRows, mapBankToQuiz, quizQuestionToBQ, QuestionEditorList,
} from "@/components/question-fields";

export const Route = createFileRoute("/_authenticated/guru/kuis")({
  head: () => ({ meta: [{ title: "Tugas & Kuis · EduQuest Academy" }] }),
  component: GuruKuisPage,
});

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

const isHalaqoh = (subject?: string | null) => !!subject && /halaqoh/i.test(subject);

function GuruKuisPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

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

  return (
    <DashboardShell accent="guru">
      <QuizTabs active="tugas" />

      <PageHeader
        title={lang === "id" ? "Tugas & Kuis" : "Assignments & Quizzes"}
        subtitle={lang === "id" ? "Pantau & nilai hasil. Soal dibuat & dikirim dari satu form di Bank Soal." : "Track & grade results. Questions are built and sent from one form in the Question Bank."}
        actions={
          <Button variant="guru" asChild>
            <Link to="/guru/bank-soal"><Plus className="size-4" /> {lang === "id" ? "Buat / Kirim Soal" : "Create / Send Questions"}</Link>
          </Button>
        }
      />

      {(quizzes as any[]).length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada kuis terkirim. Buat soal di Bank Soal lalu kirim sebagai Tugas/Kuis." : "No quizzes yet. Build questions in the Bank and send them as an assignment."} />
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(quiz)} title={lang === "id" ? "Edit soal" : "Edit"}><Pencil className="size-4 text-guru" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(lang === "id" ? "Hapus kuis ini? Riwayat pengerjaan ikut terhapus." : "Delete this quiz?")) deleteMut.mutate(quiz.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
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
      {editing && <EditQuizDialog quiz={editing} onClose={() => setEditing(null)} />}
    </DashboardShell>

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
  // Halaqoh metadata carried over from the question bank (surah, setoran type, target pages).
  const halaqohMeta = useMemo(() => {
    const q = questions.find((x) => x?.halaqoh_kind || x?.surah);
    if (!q) return null;
    const kindMap: Record<string, string> = { setoran: "ziyadah", menyimak: "ziyadah", tilawah: "tilawah" };
    const sessionType = q.setoran_kind === "murajaah"
      ? "murojaah"
      : q.setoran_kind === "tilawah_harian"
        ? "tilawah"
        : (kindMap[q.halaqoh_kind as string] ?? "ziyadah");
    return {
      sessionType,
      surah: q.surah ?? null,
      target: q.target ?? null,
      minPages: q.min_pages != null ? Number(q.min_pages) : null,
    };
  }, [questions]);
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
          session_type: halaqohMeta?.sessionType ?? "ziyadah",
          setoran_kind: halaqohMeta?.sessionType ?? null,
          surah: halaqohMeta?.surah ?? null,
          pages_count: halaqohMeta?.minPages ?? null,
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
          notes: [feedback.trim(), halaqohMeta?.target ? `Target: ${halaqohMeta.target}` : "", `Dari tugas: ${quiz.title}`].filter(Boolean).join(" · "),
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

// Edit an already-sent quiz/assignment (questions, Halaqoh metadata, rewards) without
// touching the submissions history. Submissions remain linked by assignment_id.
function EditQuizDialog({ quiz, onClose }: { quiz: any; onClose: () => void }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState<string>(quiz.title ?? "");
  const [dueAt, setDueAt] = useState<string>(quiz.due_at ? new Date(quiz.due_at).toISOString().slice(0, 16) : "");
  const [maxScore, setMaxScore] = useState<number>(quiz.max_score ?? 100);
  const [xp, setXp] = useState<number>(quiz.xp_reward ?? 50);
  const [coin, setCoin] = useState<number>(quiz.coin_reward ?? 10);
  const [questions, setQuestions] = useState<BQ[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const setQ = (i: number, patch: Partial<BQ>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>, qi: number) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingIdx(qi);
    try {
      const path = `${user.id}/qz-${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("lesson-media").upload(path, file);
      if (error) throw error;
      setQ(qi, { image_url: path });
      toast.success(lang === "id" ? "Gambar diunggah" : "Image uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingIdx(null);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("assignment_answer_keys").select("answer_key").eq("assignment_id", quiz.id).maybeSingle();
      let keys: any[] = [];
      try { keys = data?.answer_key ? JSON.parse(data.answer_key as any) : []; } catch { keys = []; }
      const qList: any[] = Array.isArray(quiz.questions) ? quiz.questions : [];
      const bqs = qList.map((q, i) => quizQuestionToBQ(q, keys[i]));
      if (active) { setQuestions(bqs.length ? bqs : []); setReady(true); }
    })();
    return () => { active = false; };
  }, [quiz.id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!title.trim()) throw new Error(lang === "id" ? "Judul wajib diisi." : "Title is required.");
      const { rows, errors } = buildBankRows(questions, quiz.subject ?? "", "", user.id, lang);
      if (errors.length) throw new Error((lang === "id" ? "Periksa soal:\n" : "Fix:\n") + errors.map((e) => `• ${e}`).join("\n"));
      const questionsPublic: any[] = [];
      const answerKey: any[] = [];
      rows.slice(0, MAX_QUESTIONS).forEach((b) => {
        const { question, key } = mapBankToQuiz(b);
        questionsPublic.push(question);
        answerKey.push(key);
      });
      const { error: aErr } = await supabase.from("assignments").update({
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        max_score: maxScore, xp_reward: xp, coin_reward: coin,
        questions: questionsPublic as any,
      } as any).eq("id", quiz.id);
      if (aErr) throw aErr;
      // Upsert the answer key (separate table, keyed by assignment).
      const { error: kErr } = await supabase.from("assignment_answer_keys")
        .upsert({ assignment_id: quiz.id, teacher_id: user.id, answer_key: JSON.stringify(answerKey) }, { onConflict: "assignment_id" });
      if (kErr) throw kErr;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kuis diperbarui ✨" : "Quiz updated ✨");
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subCount = (quiz.submissions ?? []).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Edit Tugas/Kuis" : "Edit Quiz"}</DialogTitle></DialogHeader>
        {!ready ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{lang === "id" ? "Memuat soal…" : "Loading…"}</p>
        ) : (
          <div className="space-y-3">
            {subCount > 0 && (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-3 text-xs font-semibold text-amber-700">
                {lang === "id"
                  ? `${subCount} siswa sudah mengerjakan. Riwayat & nilai mereka tetap aman, tetapi mengubah urutan/soal dapat memengaruhi pencocokan jawaban lama.`
                  : `${subCount} students already submitted. Their history is kept, but changing question order may affect old answer matching.`}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>{lang === "id" ? "Judul" : "Title"}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label className="text-xs">{lang === "id" ? "Tenggat" : "Due"}</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
              <div><Label className="text-xs">{lang === "id" ? "Nilai Maks" : "Max Score"}</Label><Input type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} /></div>
              <div><Label className="text-xs">XP</Label><Input type="number" min={0} value={xp} onChange={(e) => setXp(Number(e.target.value))} /></div>
              <div><Label className="text-xs">{lang === "id" ? "Koin" : "Coins"}</Label><Input type="number" min={0} value={coin} onChange={(e) => setCoin(Number(e.target.value))} /></div>
            </div>
            <Label className="text-base font-bold">{lang === "id" ? "Daftar Soal" : "Questions"} <span className="font-normal text-muted-foreground">({questions.length}/{MAX_QUESTIONS})</span></Label>
            <QuestionEditorList questions={questions} setQuestions={setQuestions} uploadImage={uploadImage} uploadingIdx={uploadingIdx} />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{lang === "id" ? "Batal" : "Cancel"}</Button>
          <Button variant="guru" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !ready}>{saveMut.isPending ? "…" : (lang === "id" ? "Simpan Perubahan" : "Save Changes")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

