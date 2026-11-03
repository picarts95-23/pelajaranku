import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Lightbulb, CheckCircle2, XCircle, ArrowRight, RotateCcw, Upload, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generatePractice } from "@/lib/ai-practice.functions";
import {
  MAX_FILE_BYTES, MAX_PRACTICE_COUNT, practicePoints,
  type PracticeFile, type PracticeLevel, type PracticeQuestion,
} from "@/lib/ai-practice";
import { cn } from "@/lib/utils";

export type PracticeMeta = { subject: string; topic: string; level: PracticeLevel };

export function PracticeGenerator({ onReady }: { onReady: (qs: PracticeQuestion[], meta: PracticeMeta) => void }) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Mata pelajaran</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="cth. Matematika" /></div>
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {busy ? "AI sedang menyusun soal..." : "Buat Latihan"}
      </Button>
    </div>
  );
}

type Result = { chosen: number; correct: boolean; hints: number };

export function PracticeTutor({ questions, onRestart }: { questions: PracticeQuestion[]; onRestart: () => void }) {
  const [idx, setIdx] = useState(0);
  const [hints, setHints] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const done = results.length === questions.length && chosen === null && idx >= questions.length;

  if (done || idx >= questions.length) {
    const total = results.reduce((s, r) => s + practicePoints(r.correct, r.hints), 0);
    const score = Math.round(total / questions.length);
    const weak = [...new Set(questions.filter((_, i) => !results[i]?.correct).map((q) => q.concept).filter(Boolean))];
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Skor latihan</p>
        <p className="font-display text-5xl font-bold text-primary">{score}</p>
        <p>{results.filter((r) => r.correct).length} dari {questions.length} benar</p>
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
  const isCorrect = answered && chosen === q.correctIndex;

  const answer = (i: number) => {
    if (answered) return;
    setChosen(i);
    setShowSteps(i !== q.correctIndex);
    setResults((r) => [...r, { chosen: i, correct: i === q.correctIndex, hints }]);
  };
  const next = () => { setIdx((i) => i + 1); setChosen(null); setHints(0); setShowSteps(false); };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Soal {idx + 1} / {questions.length}</span>{q.concept && <span className="truncate ml-2">{q.concept}</span>}
      </div>
      <Progress value={(idx / questions.length) * 100} />
      {q.stimulus && <div className="rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap">{q.stimulus}</div>}
      <p className="font-semibold text-lg whitespace-pre-wrap">{q.question}</p>
      <div className="grid gap-2">
        {q.options.map((o, i) => (
          <button key={i} onClick={() => answer(i)} disabled={answered}
            className={cn("min-h-12 rounded-xl border-2 px-4 py-3 text-left transition",
              !answered && "hover:border-primary",
              answered && i === q.correctIndex && "border-success bg-success/10",
              answered && i === chosen && i !== q.correctIndex && "border-destructive bg-destructive/10")}>
            <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{o}
          </button>
        ))}
      </div>

      {!answered && hints > 0 && (
        <div className="space-y-2">{q.hints.slice(0, hints).map((h, i) => (
          <div key={i} className="flex gap-2 rounded-xl bg-accent/40 p-3 text-sm"><Lightbulb className="size-4 shrink-0 mt-0.5" /><span><b>Petunjuk {i + 1}:</b> {h}</span></div>
        ))}</div>
      )}
      {!answered && hints < q.hints.length && (
        <Button variant="outline" onClick={() => setHints((h) => h + 1)}><Lightbulb className="size-4" /> {hints === 0 ? "Minta petunjuk" : "Petunjuk berikutnya"}</Button>
      )}

      {answered && (
        <div className={cn("rounded-xl p-4 space-y-2", isCorrect ? "bg-success/10" : "bg-destructive/10")}>
          <p className="flex items-center gap-2 font-semibold">
            {isCorrect ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-destructive" />}
            {isCorrect ? `Benar! +${practicePoints(true, hints)} poin` : `Belum tepat. Jawaban benar: ${String.fromCharCode(65 + q.correctIndex)}`}
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
          <div className="min-w-0 space-y-1">
            {q.stimulus && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.stimulus}</p>}
            <p className="font-semibold">{i + 1}. {q.question}</p>
            <ul className="text-sm">{q.options.map((o, j) => (
              <li key={j} className={cn(j === q.correctIndex && "font-bold text-success")}>{String.fromCharCode(65 + j)}. {o}</li>
            ))}</ul>
            {q.explanation && <p className="text-xs text-muted-foreground">Pembahasan: {q.explanation}</p>}
          </div>
        </label>
      ))}
    </div>
  );
}
