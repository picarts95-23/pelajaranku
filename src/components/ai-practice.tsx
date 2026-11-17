import { useCallback, useEffect, useMemo, useState } from "react";
import { BossArena, BattleOutcome, type BattleFx } from "@/components/boss-battle";
import { BOSS_MAX_HP, HERO_MAX_HP, heroDamage, hitDamage, pickBoss, practiceExp } from "@/lib/boss-battle";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Lightbulb, CheckCircle2, XCircle, ArrowRight, RotateCcw, Upload, BookOpen, Loader2, ListChecks, Table2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generatePractice } from "@/lib/ai-practice.functions";
import { savePracticeAttempt } from "@/lib/practice-result.functions";
import {
  MAX_FILE_BYTES, MAX_PRACTICE_COUNT, PRACTICE_TYPE_LABEL,
  isPracticeAnswerCorrect, practiceCorrectAnswer, practicePoints,
  type PracticeAnswerValue, type PracticeFile, type PracticeLevel, type PracticeQuestion, type PracticeQuestionType,
} from "@/lib/ai-practice";
import { cn } from "@/lib/utils";

export type PracticeMeta = { subject: string; topic: string; level: PracticeLevel };

export function PracticeGenerator({ onReady, subjectOptions = [] }: { onReady: (qs: PracticeQuestion[], meta: PracticeMeta) => void; subjectOptions?: string[] }) {
  const gen = useServerFn(generatePractice);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [level, setLevel] = useState<PracticeLevel>("menengah");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<PracticeFile | null>(null);
  const [busy, setBusy] = useState(false);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return toast.error("Ukuran file maksimal 5 MB.");
    if (f.type.startsWith("text/")) { const txt = (await f.text()).slice(0, 8000); setNotes((n) => (n ? n + "\n\n" : "") + txt); return; }
    if (!/^image\/|^application\/pdf$/.test(f.type)) return toast.error("Gunakan foto, PDF, atau file teks.");
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f);
    });
    setFile({ name: f.name, mime: f.type, dataUrl });
  };

  const submit = async () => {
    if (!subject.trim() || !topic.trim()) return toast.error("Isi mata pelajaran dan topik dulu.");
    setBusy(true);
    try {
      const r = await gen({ data: { subject, topic, count, level, notes: notes || undefined, file: file ?? undefined } });
      if (r.error || !r.questions.length) toast.error(r.error ?? "Gagal membuat soal.");
      else onReady(r.questions, { subject, topic, level });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat soal.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="font-display font-semibold">Paket Latihan Soal Literasi</p>
        <p className="mt-1 text-sm text-muted-foreground">Soal muncul satu per satu dengan stimulus, petunjuk, umpan balik instan, dan pembahasan.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5"><CircleDot className="size-3.5 text-primary" />Pilihan Ganda</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5"><ListChecks className="size-3.5 text-primary" />Pilihan Ganda Kompleks</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5"><Table2 className="size-3.5 text-primary" />Tabel Pernyataan Benar/Salah</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Mata pelajaran</Label>{subjectOptions.length ? (
          <Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue placeholder="Pilih mata pelajaran" /></SelectTrigger>
            <SelectContent>{subjectOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        ) : <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="cth. Matematika" />}</div>
        <div className="space-y-1.5"><Label>Topik materi</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="cth. Pecahan senilai" /></div>
        <div className="space-y-1.5"><Label>Jumlah soal</Label>
          <Input type="number" min={1} max={MAX_PRACTICE_COUNT} value={count} onChange={(e) => setCount(Math.min(MAX_PRACTICE_COUNT, Math.max(1, Number(e.target.value) || 1)))} /></div>
        <div className="space-y-1.5"><Label>Tingkat kesulitan</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as PracticeLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="dasar">Dasar</SelectItem><SelectItem value="menengah">Menengah</SelectItem><SelectItem value="mahir">Mahir</SelectItem></SelectContent>
          </Select></div>
      </div>
      <div className="space-y-1.5"><Label>Catatan / rangkuman materi (opsional)</Label>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tempel rangkuman materi agar soal sesuai pelajaranmu." /></div>
      <div className="space-y-1.5">
        <Label>Foto atau dokumen materi (opsional)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer"><Upload className="size-4" /> Pilih file
              <input type="file" accept="image/*,application/pdf,text/plain" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </Button>
          {file && <span className="text-sm text-muted-foreground break-all">{file.name} <button className="underline ml-1" onClick={() => setFile(null)}>hapus</button></span>}
        </div>
        <p className="text-xs text-muted-foreground">Foto, PDF, atau teks — maksimal 5 MB.</p>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {busy ? "AI sedang menyusun soal..." : "Buat Latihan Literasi"}
      </Button>
    </div>
  );
}

type Result = { chosen: PracticeAnswerValue; correct: boolean; hints: number };
const PRACTICE_TYPES: PracticeQuestionType[] = ["multiple_choice", "complex_multiple_choice", "statement_table"];

export function PracticeTutor({ questions, onRestart, meta, classId, persist = false, onSaved }: {
  questions: PracticeQuestion[];
  onRestart: () => void;
  meta?: PracticeMeta;
  classId?: string;
  persist?: boolean;
  onSaved?: () => void;
}) {
  const saveAttempt = useServerFn(savePracticeAttempt);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [clientId] = useState(() => globalThis.crypto?.randomUUID?.() ?? "00000000-4000-4000-8000-000000000000");
  const [idx, setIdx] = useState(0);
  const [hints, setHints] = useState(0);
  const [chosen, setChosen] = useState<PracticeAnswerValue | null>(null);
  const [multiDraft, setMultiDraft] = useState<number[]>([]);
  const [tableDraft, setTableDraft] = useState<(boolean | null)[]>(() => questions[0]?.statements.map(() => null) ?? []);
  const [showSteps, setShowSteps] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [battle, setBattle] = useState(true);
  const [fx, setFx] = useState<BattleFx>(null);
  const boss = useMemo(() => pickBoss(questions.map((q) => q.question).join("|")), [questions]);
  const n = questions.length;
  const bossHp = Math.max(0, BOSS_MAX_HP - results.reduce((s, r) => s + (r.correct ? hitDamage(n, r.hints) : 0), 0));
  const heroHp = Math.max(1, HERO_MAX_HP - results.filter((r) => !r.correct).length * heroDamage(n));
  const done = results.length === questions.length && chosen === null && idx >= questions.length;

  const persistResult = useCallback(async () => {
    if (!meta || !classId || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    try {
      await saveAttempt({ data: { clientId, classId, ...meta, questions, results } });
      setSaveState("saved");
      setSaveMessage("Nilai tambahan dan umpan balik tersimpan. Catatan latihan juga masuk ke Jurnal siswa.");
      onSaved?.();
    } catch (e) {
      setSaveState("error");
      setSaveMessage(e instanceof Error ? e.message : "Hasil belum tersimpan.");
    }
  }, [meta, classId, saveState, saveAttempt, clientId, questions, results, onSaved]);

  useEffect(() => {
    if (done && persist && saveState === "idle") void persistResult();
  }, [done, persist, saveState, persistResult]);

  if (done || idx >= questions.length) {
    const total = results.reduce((s, r) => s + practicePoints(r.correct, r.hints), 0);
    const score = Math.round(total / questions.length);
    const correctCount = results.filter((r) => r.correct).length;
    const victory = bossHp <= 0.5;
    const weak = [...new Set(questions.filter((_, i) => !results[i]?.correct).map((q) => q.concept).filter(Boolean))];
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4 text-center">
        {battle && <BattleOutcome victory={victory} boss={boss} exp={practiceExp(correctCount, victory)} expNote="EXP latihan mandiri ini hanya untuk sesi ini dan tidak menambah EXP profil." />}
        <p className="text-sm text-muted-foreground">Skor latihan</p>
        <p className="font-display text-5xl font-bold text-primary">{score}</p>
        <p>{correctCount} dari {questions.length} benar</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRACTICE_TYPES.filter((type) => questions.some((q) => q.type === type)).map((type) => {
            const indexes = questions.map((q, i) => q.type === type ? i : -1).filter((i) => i >= 0);
            const correct = indexes.filter((i) => results[i]?.correct).length;
            return <div key={type} className="rounded-xl bg-muted p-3 text-left"><p className="text-xs text-muted-foreground">{PRACTICE_TYPE_LABEL[type]}</p><p className="font-display text-lg font-bold">{correct}/{indexes.length} benar</p></div>;
          })}
        </div>
        {persist && <div className={cn("rounded-xl p-3 text-sm", saveState === "saved" ? "bg-quest/10 text-quest" : saveState === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
          {saveState === "saving" || saveState === "idle" ? "Menyimpan nilai tambahan dan jurnal..." : saveMessage}
          {saveState === "error" && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => void persistResult()}>Coba simpan lagi</Button></div>}
        </div>}
        {weak.length > 0 && (
          <div className="text-left rounded-xl bg-muted p-4"><p className="font-semibold mb-1">Konsep yang perlu diulang:</p>
            <ul className="list-disc ml-5 text-sm">{weak.map((w) => <li key={w}>{w}</li>)}</ul></div>
        )}
        <Button onClick={onRestart}><RotateCcw className="size-4" /> Buat latihan baru</Button>
      </div>
    );
  }

  const q = questions[idx];
  const answered = chosen !== null;
  const isCorrect = answered && isPracticeAnswerCorrect(q, chosen);
  const canCheck = q.type === "complex_multiple_choice" ? multiDraft.length > 0
    : q.type === "statement_table" ? tableDraft.length === q.statements.length && tableDraft.every((value) => typeof value === "boolean")
      : false;

  const recordAnswer = (value: PracticeAnswerValue) => {
    if (answered) return;
    const correct = isPracticeAnswerCorrect(q, value);
    setChosen(value);
    setShowSteps(!correct);
    setResults((r) => [...r, { chosen: value, correct, hints }]);
    setFx({ kind: correct ? "hit" : "miss", key: Date.now(), amount: correct ? hitDamage(n, hints) : heroDamage(n) });
  };
  const toggleMulti = (optionIndex: number) => {
    if (answered) return;
    setMultiDraft((current) => current.includes(optionIndex) ? current.filter((i) => i !== optionIndex) : [...current, optionIndex].sort((a, b) => a - b));
  };
  const next = () => {
    const nextIndex = idx + 1;
    setIdx(nextIndex);
    setChosen(null);
    setMultiDraft([]);
    setTableDraft(questions[nextIndex]?.statements.map(() => null) ?? []);
    setHints(0);
    setShowSteps(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Soal {idx + 1} / {questions.length}</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{PRACTICE_TYPE_LABEL[q.type]}</span>
        {q.concept && <span className="min-w-0 flex-1 truncate text-right">{q.concept}</span>}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <Checkbox checked={battle} onCheckedChange={(v) => setBattle(v === true)} /> ⚔️ Mode Boss Battle
      </label>
      {battle && <BossArena boss={boss} bossHp={bossHp} heroHp={heroHp} heroName="Kamu" fx={fx} />}
      {battle && hints > 0 && !answered && <p className="text-xs text-muted-foreground">Petunjuk membuat seranganmu lebih lemah.</p>}
      <Progress value={(idx / questions.length) * 100} />
      {q.stimulus && <section className="rounded-xl border-l-4 border-primary bg-muted p-4 text-sm whitespace-pre-wrap"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Stimulus / Bacaan</p>{q.stimulus}</section>}
      <p className="font-semibold text-lg whitespace-pre-wrap">{q.question}</p>

      {(q.type === "multiple_choice" || q.type === "complex_multiple_choice") && <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{q.type === "multiple_choice" ? "Pilih satu jawaban yang paling tepat." : "Pilih semua jawaban yang tepat, lalu tekan Periksa Jawaban."}</p>
        <div className="grid gap-2">
          {q.options.map((option, optionIndex) => {
            const selected = q.type === "multiple_choice" ? chosen === optionIndex : multiDraft.includes(optionIndex);
            const correctOption = q.type === "multiple_choice" ? q.correctIndex === optionIndex : q.correctIndices.includes(optionIndex);
            return <button key={optionIndex} type="button" aria-pressed={selected} onClick={() => q.type === "multiple_choice" ? recordAnswer(optionIndex) : toggleMulti(optionIndex)} disabled={answered}
              className={cn("min-h-12 rounded-xl border-2 px-4 py-3 text-left transition",
                !answered && "hover:border-primary",
                !answered && selected && "border-primary bg-primary/5",
                answered && correctOption && "border-quest bg-quest/10",
                answered && selected && !correctOption && "border-destructive bg-destructive/10")}>
              <span className="font-bold mr-2">{String.fromCharCode(65 + optionIndex)}.</span>{option}
              {q.type === "complex_multiple_choice" && selected && <span className="float-right font-bold">✓</span>}
            </button>;
          })}
        </div>
      </div>}

      {q.type === "statement_table" && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Tentukan Benar atau Salah untuk setiap pernyataan, lalu periksa jawaban.</p>
        <div className="overflow-hidden rounded-xl border">
          <div className="bg-muted px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tabel Pernyataan</div>
          {q.statements.map((statement, statementIndex) => <div key={statementIndex} className="space-y-3 border-t p-4 first:border-t-0">
            <p className="text-sm font-medium"><span className="mr-2 font-bold">{statementIndex + 1}.</span>{statement.text}</p>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((value) => {
                const selected = tableDraft[statementIndex] === value;
                const correctChoice = statement.answer === value;
                return <button key={String(value)} type="button" aria-pressed={selected} disabled={answered} onClick={() => setTableDraft((current) => current.map((item, i) => i === statementIndex ? value : item))}
                  className={cn("min-h-11 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition",
                    !answered && "hover:border-primary",
                    !answered && selected && "border-primary bg-primary/5",
                    answered && correctChoice && "border-quest bg-quest/10 text-quest",
                    answered && selected && !correctChoice && "border-destructive bg-destructive/10 text-destructive")}>
                  {value ? "Benar" : "Salah"}{selected ? " ✓" : ""}
                </button>;
              })}
            </div>
            {answered && <p className={cn("flex items-center gap-1.5 text-xs font-semibold", tableDraft[statementIndex] === statement.answer ? "text-quest" : "text-destructive")}>
              {tableDraft[statementIndex] === statement.answer ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {tableDraft[statementIndex] === statement.answer ? "Pernyataan ini kamu jawab dengan tepat." : `Kunci pernyataan ini: ${statement.answer ? "Benar" : "Salah"}.`}
            </p>}
          </div>)}
        </div>
      </div>}

      {!answered && q.type !== "multiple_choice" && <Button onClick={() => recordAnswer(q.type === "complex_multiple_choice" ? multiDraft : tableDraft as boolean[])} disabled={!canCheck} className="w-full sm:w-auto"><CheckCircle2 className="size-4" /> Periksa Jawaban</Button>}

      {!answered && hints > 0 && (
        <div className="space-y-2">{q.hints.slice(0, hints).map((h, i) => (
          <div key={i} className="flex gap-2 rounded-xl bg-accent/40 p-3 text-sm"><Lightbulb className="size-4 shrink-0 mt-0.5" /><span><b>Petunjuk {i + 1}:</b> {h}</span></div>
        ))}</div>
      )}
      {!answered && hints < q.hints.length && (
        <Button variant="outline" onClick={() => setHints((h) => h + 1)}><Lightbulb className="size-4" /> {hints === 0 ? "Minta petunjuk" : "Petunjuk berikutnya"}</Button>
      )}

      {answered && (
        <div className={cn("rounded-xl p-4 space-y-2", isCorrect ? "bg-quest/10" : "bg-destructive/10")}>
          <p className="flex items-start gap-2 font-semibold">
            {isCorrect ? <CheckCircle2 className="size-5 shrink-0 text-quest" /> : <XCircle className="size-5 shrink-0 text-destructive" />}
            <span>{isCorrect ? `Benar! +${practicePoints(true, hints)} poin` : `Belum tepat. Kunci jawaban: ${practiceCorrectAnswer(q)}`}</span>
          </p>
          {q.explanation && <p className="text-sm whitespace-pre-wrap">{q.explanation}</p>}
          {showSteps ? (
            q.steps.length > 0 && <ol className="list-decimal ml-5 text-sm space-y-1">{q.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowSteps(true)}><BookOpen className="size-4" /> Lihat langkah penyelesaian</Button>
          )}
        </div>
      )}
      {answered && <Button onClick={next} className="w-full sm:w-auto">{idx + 1 < questions.length ? "Soal berikutnya" : "Lihat hasil"} <ArrowRight className="size-4" /></Button>}
    </div>
  );
}

export function PracticeReviewList({ questions, selected, onToggle }: {
  questions: PracticeQuestion[]; selected: Set<number>; onToggle: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <label key={i} className="flex gap-3 rounded-2xl border bg-card p-4 cursor-pointer">
          <Checkbox checked={selected.has(i)} onCheckedChange={() => onToggle(i)} className="mt-1" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{PRACTICE_TYPE_LABEL[q.type]}</span>
            {q.stimulus && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground whitespace-pre-wrap">{q.stimulus}</p>}
            <p className="font-semibold">{i + 1}. {q.question}</p>
            {q.type === "statement_table" ? <ol className="space-y-1 text-sm">{q.statements.map((statement, statementIndex) => <li key={statementIndex}>{statementIndex + 1}. {statement.text} <b className="text-quest">({statement.answer ? "Benar" : "Salah"})</b></li>)}</ol>
              : <ul className="text-sm">{q.options.map((option, optionIndex) => {
                const correct = q.type === "multiple_choice" ? optionIndex === q.correctIndex : q.correctIndices.includes(optionIndex);
                return <li key={optionIndex} className={cn(correct && "font-bold text-quest")}>{String.fromCharCode(65 + optionIndex)}. {option}</li>;
              })}</ul>}
            {q.explanation && <p className="text-xs text-muted-foreground">Pembahasan: {q.explanation}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}
