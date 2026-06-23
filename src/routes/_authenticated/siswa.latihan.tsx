import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Sparkles, Coins, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/latihan")({
  head: () => ({ meta: [{ title: "Latihan Kuis · EduQuest Academy" }] }),
  component: SiswaLatihanPage,
});

function SiswaLatihanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: quizzes = [] } = useQuery({
    queryKey: ["siswa-quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("*, classes(name), submissions(*)")
        .eq("answer_format", "quiz")
        .order("created_at", { ascending: false });
      return (data ?? []).map((a: any) => ({ ...a, mySubmission: a.submissions?.find((s: any) => s.student_id === user!.id) }));
    },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={lang === "id" ? "Latihan Kuis" : "Quiz Practice"} subtitle={lang === "id" ? "Kerjakan kuis pilihan ganda & dapatkan XP otomatis!" : "Answer multiple-choice quizzes & earn XP instantly!"} />
      {(quizzes as any[]).length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada kuis. Gabung ke kelas dulu ya!" : "No quizzes yet. Join a class first!"} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(quizzes as any[]).map((q) => <QuizCard key={q.id} quiz={q} />)}
        </div>
      )}
    </DashboardShell>
  );
}

function QuizCard({ quiz }: { quiz: any }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const questions: { q: string; options: string[] }[] = Array.isArray(quiz.questions) ? quiz.questions : [];
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<{ correct: number; total: number; score: number; max_score: number } | null>(null);
  const done = !!quiz.mySubmission;

  const submitMut = useMutation({
    mutationFn: async () => {
      if (answers.some((a) => a === null)) throw new Error(lang === "id" ? "Jawab semua soal dulu ya!" : "Answer every question first!");
      const { data, error } = await (supabase as any).rpc("grade_quiz_submission", {
        _assignment_id: quiz.id,
        _answers: answers,
      });
      if (error) throw error;
      return data as { correct: number; total: number; score: number; max_score: number };
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(lang === "id" ? `Skor kamu ${data.score}/${data.max_score} 🎉` : `Your score ${data.score}/${data.max_score} 🎉`);
      qc.invalidateQueries({ queryKey: ["siswa-quizzes"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("ALREADY_SUBMITTED")
        ? (lang === "id" ? "Kamu sudah mengerjakan kuis ini." : "You already took this quiz.")
        : e.message;
      toast.error(msg);
    },
  });

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex items-center gap-2">
        <FileQuestion className="size-5 text-accent" />
        <h3 className="truncate font-display text-lg font-bold">{quiz.title}</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {quiz.classes?.name ?? "—"} · {questions.length} {lang === "id" ? "soal" : "questions"}
        {quiz.due_at ? ` · ${lang === "id" ? "tenggat" : "due"} ${format(new Date(quiz.due_at), "dd MMM")}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-quest/15 px-3 py-1 font-display font-bold text-quest"><Sparkles className="mr-1 inline size-3" />{quiz.xp_reward} XP</span>
        <span className="rounded-full bg-coin/15 px-3 py-1 font-display font-bold text-coin"><Coins className="mr-1 inline size-3" />{quiz.coin_reward}</span>
      </div>

      {done ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-xp/10 px-4 py-3 text-sm font-display font-bold text-xp">
          <Trophy className="size-5" /> {lang === "id" ? "Selesai" : "Done"} · {quiz.mySubmission.score ?? 0}/{quiz.max_score}
        </div>
      ) : (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAnswers(questions.map(() => null)); setResult(null); } }}>
          <DialogTrigger asChild>
            <Button variant="siswa" className="mt-4 w-full"><FileQuestion className="size-4" /> {lang === "id" ? "Kerjakan Kuis" : "Take Quiz"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{quiz.title}</DialogTitle></DialogHeader>
            {result ? (
              <div className="space-y-4 py-4 text-center">
                <div className="text-5xl">🎉</div>
                <div className="font-display text-3xl font-bold text-primary">{result.score}<span className="text-lg text-muted-foreground">/{result.max_score}</span></div>
                <p className="text-sm text-muted-foreground">{lang === "id" ? `Benar ${result.correct} dari ${result.total} soal` : `${result.correct} of ${result.total} correct`}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((qq, qi) => (
                  <div key={qi} className="rounded-xl border-2 border-border bg-muted/20 p-3">
                    <p className="font-display text-sm font-bold">{qi + 1}. {qq.q}</p>
                    <div className="mt-2 space-y-1.5">
                      {qq.options.map((opt, oi) => {
                        const selected = answers[qi] === oi;
                        return (
                          <button key={oi} type="button"
                            onClick={() => setAnswers((a) => a.map((v, idx) => (idx === qi ? oi : v)))}
                            className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors ${selected ? "border-siswa bg-siswa/10 font-semibold" : "border-border hover:bg-muted"}`}>
                            <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-siswa bg-siswa text-white" : "border-muted-foreground/40"}`}>
                              {selected && <CheckCircle2 className="size-3.5" />}
                            </span>
                            <span className="font-display text-xs font-bold text-muted-foreground">{String.fromCharCode(65 + oi)}</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              {result ? (
                <Button variant="siswa" onClick={() => setOpen(false)}>{lang === "id" ? "Tutup" : "Close"}</Button>
              ) : (
                <Button variant="siswa" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                  {submitMut.isPending ? (lang === "id" ? "Menilai…" : "Grading…") : (lang === "id" ? "Kirim Jawaban" : "Submit Answers")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
