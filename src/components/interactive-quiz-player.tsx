import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileQuestion, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecorder } from "@/components/voice-recorder";
import { compressImage } from "@/lib/compress-image";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { assertMediaSize } from "@/lib/media-limits";
import { supabase } from "@/integrations/supabase/client";
import { MediaViewer } from "@/components/media-input";
import { ScoreBreakdown, questionPoints, questionSeconds, type ScoreBreakdownItem } from "@/components/quiz-score-breakdown";

type QResult = { auto_correct: number; total: number; manual_pending: number; score: number; max_score: number; status: string; breakdown?: ScoreBreakdownItem[] };
type SavedRun = { answers: unknown[]; current: number; deadline: number | null };

export function InteractiveQuizDialog({ quiz, questions, onFinished }: { quiz: any; questions: any[]; onFinished: () => void }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"intro" | "playing" | "review" | "result">("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<unknown[]>(() => questions.map(() => null));
  const [voiceBlobs, setVoiceBlobs] = useState<Record<number, Blob | null>>({});
  const [imageFiles, setImageFiles] = useState<Record<number, File | null>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const defaultLimit = Math.max(10, Math.min(600, Number(quiz.question_time_limit) || 30));
  const [secondsLeft, setSecondsLeft] = useState(defaultLimit);
  const [result, setResult] = useState<QResult | null>(null);
  const submittingRef = useRef(false);
  const storageKey = user ? `pelajaranku-quiz-${user.id}-${quiz.id}` : null;
  const limit = questionSeconds(questions[current], defaultLimit);
  const totalPoints = questions.reduce((sum, question) => sum + questionPoints(question), 0);

  const answeredCount = useMemo(() => answers.filter((answer) => answer !== null && answer !== undefined && String(answer).trim() !== "").length, [answers]);
  const currentQuestion = questions[current];

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen || stage === "result" || !storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedRun;
      if (!Array.isArray(saved.answers) || saved.answers.length !== questions.length) return;
      const savedCurrent = Math.min(Math.max(0, saved.current || 0), Math.max(0, questions.length - 1));
      const resumedLimit = questionSeconds(questions[savedCurrent], defaultLimit);
      setAnswers(saved.answers.map((answer) => answer === "pending-upload" ? null : answer));
      setCurrent(savedCurrent);
      setDeadline(Date.now() + resumedLimit * 1000);
      setSecondsLeft(resumedLimit);
      setStage("playing");
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  };

  useEffect(() => {
    if (!open || (stage !== "playing" && stage !== "review") || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ answers, current, deadline } satisfies SavedRun));
    } catch { /* Private browsing or a full device must not interrupt the quiz. */ }
  }, [answers, current, deadline, stage, storageKey, open]);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(lang === "id" ? "Sesi masuk tidak ditemukan." : "Sign-in session not found.");
      const finalAnswers = [...answers];
      for (let i = 0; i < questions.length; i++) {
        const type = questions[i]?.type ?? "multiple_choice";
        if (type === "voice" && voiceBlobs[i]) {
          const blob = voiceBlobs[i];
          if (!blob) continue;
          assertMediaSize(blob, "voiceAnswer", lang as "id" | "en");
          const rawType = blob.type || "audio/webm";
          const ext = rawType.includes("mp4") || rawType.includes("m4a") ? "m4a" : rawType.includes("ogg") ? "ogg" : "webm";
          const path = `${user.id}/${quiz.id}-${i}-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("voice-answers").upload(path, blob, { contentType: rawType });
          if (error) throw error;
          finalAnswers[i] = path;
        } else if (type === "image" && imageFiles[i]) {
          const raw = imageFiles[i];
          if (!raw) continue;
          const file = await compressImage(raw);
          assertMediaSize(file, "answerImage", lang as "id" | "en");
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${user.id}/${quiz.id}-${i}-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("answer-images").upload(path, file, { contentType: file.type });
          if (error) throw error;
          finalAnswers[i] = path;
        }
      }
      const { data, error } = await (supabase as any).rpc("grade_quiz_submission", { _assignment_id: quiz.id, _answers: finalAnswers });
      if (error) throw error;
      return data as QResult;
    },
    onSuccess: (data) => {
      submittingRef.current = false;
      if (storageKey) {
        try { window.localStorage.removeItem(storageKey); } catch { /* ignore unavailable storage */ }
      }
      setResult(data);
      setStage("result");
      onFinished();
      toast.success(data.manual_pending > 0
        ? (lang === "id" ? "Jawaban terkirim dan menunggu penilaian guru." : "Answers submitted for teacher grading.")
        : (lang === "id" ? `Kuis selesai · nilai ${data.score}/${data.max_score}` : `Quiz complete · score ${data.score}/${data.max_score}`));
    },
    onError: (error: Error) => {
      submittingRef.current = false;
      const message = error.message.includes("DEADLINE_PASSED")
        ? (lang === "id" ? "Tenggat kuis sudah lewat." : "The quiz deadline has passed.")
        : error.message;
      toast.error(message);
    },
  });

  const submit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    submitMut.mutate();
  };

  const beginQuestion = (index: number) => {
    setCurrent(index);
    const nextLimit = questionSeconds(questions[index], defaultLimit);
    setDeadline(Date.now() + nextLimit * 1000);
    setSecondsLeft(nextLimit);
    setStage("playing");
  };

  const advance = () => {
    if (current >= questions.length - 1) {
      setStage("review");
      return;
    }
    beginQuestion(current + 1);
  };

  useEffect(() => {
    if (!open || stage !== "playing" || !deadline || submitMut.isPending) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        if (current >= questions.length - 1) submit();
        else advance();
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline, stage, current, submitMut.isPending, open]);

  const setAnswer = (value: unknown) => setAnswers((all) => all.map((answer, index) => index === current ? value : answer));
  const progress = questions.length ? ((current + 1) / questions.length) * 100 : 0;
  const timerPercent = (secondsLeft / limit) * 100;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="siswa" className="mt-4 w-full"><FileQuestion className="size-4" /> {lang === "id" ? "Mulai Kuis Interaktif" : "Start Interactive Quiz"}</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94dvh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center justify-between gap-3 pr-7">
            <span className="truncate">{quiz.title}</span>
            {stage === "playing" && <span className={`shrink-0 tabular-nums ${secondsLeft <= 10 ? "text-destructive" : "text-primary"}`}><Clock3 className="mr-1 inline size-4" />{secondsLeft}s</span>}
          </DialogTitle>
          {stage === "playing" && <Progress value={progress} className="mt-2 h-2" />}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {stage === "intro" && (
            <div className="mx-auto max-w-md space-y-5 py-4 text-center">
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-siswa/15"><Trophy className="size-10 text-siswa" /></div>
               <div><h3 className="font-display text-2xl font-bold">{lang === "id" ? "Siap mengerjakan?" : "Ready to begin?"}</h3><p className="mt-2 text-sm text-muted-foreground">{questions.length} {lang === "id" ? `soal · ${totalPoints} poin` : `questions · ${totalPoints} points`}</p></div>
              <div className="rounded-xl border-2 border-border bg-muted/30 p-4 text-left text-sm">
                <p>• {lang === "id" ? "Soal tampil satu per satu." : "Questions appear one at a time."}</p>
                <p>• {lang === "id" ? "Saat waktu habis, soal berikutnya terbuka otomatis." : "When time runs out, the next question opens automatically."}</p>
                <p>• {lang === "id" ? "Jawaban tersimpan sementara di perangkat ini." : "Answers are saved temporarily on this device."}</p>
              </div>
              <Button variant="siswa" size="lg" className="w-full" onClick={() => beginQuestion(0)} disabled={!questions.length}>{lang === "id" ? "Mulai Sekarang" : "Start Now"}<ArrowRight className="size-4" /></Button>
            </div>
          )}

          {stage === "playing" && currentQuestion && (
            <div className="mx-auto max-w-xl">
              <div className="mb-4 flex items-center justify-between text-xs font-bold text-muted-foreground"><span>{lang === "id" ? `Soal ${current + 1} dari ${questions.length}` : `Question ${current + 1} of ${questions.length}`}</span><span>{answeredCount}/{questions.length} {lang === "id" ? "terjawab" : "answered"}</span></div>
              <Progress value={timerPercent} className={`mb-5 h-1.5 ${secondsLeft <= 10 ? "[&>div]:bg-destructive" : ""}`} />
               <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground"><span>{questionPoints(currentQuestion)} {lang === "id" ? "poin" : "pts"}</span><span>· {currentQuestion.indicator || (lang === "id" ? "Umum" : "General")}</span></div>
               {currentQuestion.stimulus && <div className="mb-4 rounded-lg border-l-4 border-primary bg-primary/5 p-3"><p className="mb-1 text-xs font-bold text-primary">{lang === "id" ? "Stimulus / Bacaan" : "Stimulus / Passage"}</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{currentQuestion.stimulus}</p></div>}
               {currentQuestion.image_url && <MediaViewer mediaType="image" mediaUrl={currentQuestion.image_url} />}
               <h3 className="mt-4 font-display text-xl font-bold sm:text-2xl">{currentQuestion.q}</h3>
              <QuestionAnswer question={currentQuestion} value={answers[current]} onChange={setAnswer} lang={lang} onVoice={(blob) => setVoiceBlobs((all) => ({ ...all, [current]: blob }))} onImage={(file) => setImageFiles((all) => ({ ...all, [current]: file }))} />
            </div>
          )}

          {stage === "review" && (
            <div className="mx-auto max-w-xl space-y-5">
              <div><h3 className="font-display text-xl font-bold">{lang === "id" ? "Periksa jawaban" : "Review answers"}</h3><p className="mt-1 text-sm text-muted-foreground">{lang === "id" ? `${answeredCount} dari ${questions.length} soal sudah dijawab.` : `${answeredCount} of ${questions.length} answered.`}</p></div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">{questions.map((_, index) => { const answered = answers[index] !== null && answers[index] !== undefined && String(answers[index]).trim() !== ""; return <Button key={index} variant={answered ? "siswa" : "outline"} size="icon" onClick={() => beginQuestion(index)} aria-label={`${lang === "id" ? "Soal" : "Question"} ${index + 1}`}>{index + 1}</Button>; })}</div>
              {answeredCount < questions.length && <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm font-semibold">{lang === "id" ? "Soal yang belum dijawab tetap dapat dikirim dan akan bernilai nol." : "Unanswered questions can still be submitted and receive zero points."}</p>}
            </div>
          )}

          {stage === "result" && result && (
             <div className="mx-auto max-w-md space-y-4 py-8 text-center"><div className="text-6xl">{result.manual_pending > 0 ? "📝" : "🏆"}</div><h3 className="font-display text-2xl font-bold">{lang === "id" ? "Kuis selesai" : "Quiz complete"}</h3><div className="font-display text-4xl font-bold text-primary">{result.score}<span className="text-xl text-muted-foreground">/{result.max_score}</span></div><p className="text-sm text-muted-foreground">{result.manual_pending > 0 ? (lang === "id" ? "Nilai sementara; sebagian jawaban menunggu penilaian guru." : "Provisional score; some answers await teacher review.") : (lang === "id" ? `${result.auto_correct} dari ${result.total} jawaban benar` : `${result.auto_correct} of ${result.total} correct`)}</p><ScoreBreakdown items={result.breakdown ?? []} lang={lang} /></div>
          )}
        </div>

        {(stage === "playing" || stage === "review" || stage === "result") && (
          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 sm:px-6">
            {stage === "playing" ? <><Button variant="outline" onClick={() => current > 0 ? beginQuestion(current - 1) : setStage("review")}><ArrowLeft className="size-4" />{lang === "id" ? "Kembali" : "Back"}</Button><Button variant="siswa" onClick={advance}>{current === questions.length - 1 ? (lang === "id" ? "Selesai" : "Finish") : (lang === "id" ? "Berikutnya" : "Next")}<ArrowRight className="size-4" /></Button></> : stage === "review" ? <><Button variant="outline" onClick={() => beginQuestion(Math.min(current, questions.length - 1))}><ArrowLeft className="size-4" />{lang === "id" ? "Lanjut mengerjakan" : "Keep working"}</Button><Button variant="siswa" onClick={submit} disabled={submitMut.isPending}><Send className="size-4" />{submitMut.isPending ? (lang === "id" ? "Mengirim…" : "Submitting…") : (lang === "id" ? "Kirim Kuis" : "Submit Quiz")}</Button></> : <div className="ml-auto"><Button variant="siswa" onClick={() => setOpen(false)}><CheckCircle2 className="size-4" />{lang === "id" ? "Tutup" : "Close"}</Button></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuestionAnswer({ question, value, onChange, lang, onVoice, onImage }: { question: any; value: unknown; onChange: (value: unknown) => void; lang: string; onVoice: (blob: Blob | null) => void; onImage: (file: File | null) => void }) {
  const type = question.type ?? "multiple_choice";
  if (type === "multiple_choice") return <div className="mt-5 grid gap-3 sm:grid-cols-2">{(question.options ?? []).map((option: string, index: number) => { const selected = value === index; return <Button key={index} type="button" variant={selected ? "siswa" : "outline"} className="h-auto min-h-16 justify-start whitespace-normal px-4 py-3 text-left" onClick={() => onChange(index)}><span className="grid size-7 shrink-0 place-items-center rounded-full border border-current font-display font-bold">{String.fromCharCode(65 + index)}</span><span>{option}</span></Button>; })}</div>;
  if (type === "complex_multiple_choice") { const chosen = String(value ?? "").split(",").filter(Boolean); return <div className="mt-5 grid gap-3 sm:grid-cols-2">{(question.options ?? []).map((option: string, index: number) => { const selected = chosen.includes(String(index)); return <Button key={index} type="button" variant={selected ? "siswa" : "outline"} className="h-auto min-h-16 justify-start whitespace-normal px-4 py-3 text-left" onClick={() => { const next = selected ? chosen.filter((item) => item !== String(index)) : [...chosen, String(index)]; onChange(next.map(Number).sort((a, b) => a - b).join(",")); }}><span className="grid size-7 shrink-0 place-items-center rounded-md border border-current font-display font-bold">{selected ? "✓" : String.fromCharCode(65 + index)}</span><span>{option}</span></Button>; })}</div>; }
  if (type === "true_false") return <div className="mt-5 grid grid-cols-2 gap-3"><Button variant={value === "true" ? "siswa" : "outline"} className="h-16" onClick={() => onChange("true")}>{lang === "id" ? "Benar" : "True"}</Button><Button variant={value === "false" ? "siswa" : "outline"} className="h-16" onClick={() => onChange("false")}>{lang === "id" ? "Salah" : "False"}</Button></div>;
  if (type === "short_answer") return <Input className="mt-5" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={lang === "id" ? "Tulis jawaban singkat…" : "Write a short answer…"} />;
  if (type === "essay") return <Textarea className="mt-5" rows={7} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={lang === "id" ? "Tulis jawabanmu…" : "Write your answer…"} />;
  if (type === "voice") return <div className="mt-5"><VoiceRecorder onChange={({ blob }) => { onVoice(blob); onChange(blob ? "pending-upload" : null); }} /></div>;
  if (type === "image") return <div className="mt-5 rounded-xl border-2 border-dashed border-border p-4"><Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] ?? null; onImage(file); onChange(file ? "pending-upload" : null); }} /><p className="mt-2 text-xs text-muted-foreground">{lang === "id" ? "Ambil foto atau pilih gambar yang jelas." : "Take a photo or choose a clear image."}</p></div>;
  return null;
}