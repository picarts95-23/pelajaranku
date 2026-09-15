import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { TYPE_LABEL, type BType } from "@/components/question-fields";
import { keyText, normIdxList } from "@/components/quiz-grade-dialog";

/**
 * Read-only review of quiz questions + answer keys, used after transferring
 * questions from Bank Soal so the teacher can confirm nothing changed shape.
 */
export function QuizReviewList({ questions, answerKey }: { questions: any[]; answerKey: any[] }) {
  const { lang } = useLang();
  if (!questions.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{lang === "id" ? "Belum ada soal." : "No questions yet."}</p>;
  }
  return (
    <div className="space-y-2">
      {questions.map((q, i) => {
        const key = answerKey?.[i];
        const type = (q?.type ?? "multiple_choice") as BType;
        const correct = type === "complex_multiple_choice"
          ? normIdxList(key).split(",").filter(Boolean).map(Number)
          : type === "multiple_choice" && key != null && String(key) !== ""
            ? [Number(key)]
            : [];
        return (
          <div key={i} className="rounded-xl border-2 border-border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-display font-bold">{i + 1}. {q?.q}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-display font-semibold text-muted-foreground">
                {TYPE_LABEL(type, lang)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span>{Number(q?.points) || 1} {lang === "id" ? "poin" : "pts"}</span>
              <span>· {Number(q?.time_limit_seconds) || 30} {lang === "id" ? "detik" : "sec"}</span>
              <span>· {q?.indicator || (lang === "id" ? "Umum" : "General")}</span>
            </div>
            {q?.stimulus && <div className="mt-2 rounded-lg border-l-4 border-primary bg-primary/5 p-2 text-xs"><span className="font-bold">{lang === "id" ? "Stimulus:" : "Stimulus:"}</span> <span className="whitespace-pre-wrap">{q.stimulus}</span></div>}
            {Array.isArray(q?.options) && q.options.length > 0 && (
              <div className="mt-2 space-y-1">
                {q.options.map((o: string, oi: number) => (
                  <div key={oi}
                    className={`rounded-lg px-2 py-1 text-xs ${correct.includes(oi) ? "bg-emerald-500/15 font-semibold text-emerald-700" : "bg-background"}`}>
                    {String.fromCharCode(65 + oi)}. {o} {correct.includes(oi) ? "✓" : ""}
                  </div>
                ))}
              </div>
            )}
            {(type === "short_answer" || type === "true_false") && (
              <p className="mt-1.5 text-xs text-emerald-700">{lang === "id" ? "Kunci:" : "Key:"} {keyText(q, key, lang)}</p>
            )}
            {(type === "essay" || type === "voice" || type === "image") && (
              <p className="mt-1.5 text-xs text-amber-700">✍️ {lang === "id" ? "Dinilai manual oleh guru." : "Graded manually."}</p>
            )}
            {(q?.topic || q?.difficulty) && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {q.topic ? `📚 ${q.topic}` : ""}{q.topic && q.difficulty ? " · " : ""}{q.difficulty ? `⚙️ ${q.difficulty}` : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dialog wrapper so a teacher can review the questions of an existing quiz task. */
export function QuizReviewDialog({
  open, onOpenChange, title, questions, answerKey,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; questions: any[]; answerKey: any[] }) {
  const { lang } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Tinjau Soal" : "Review Questions"} · {title}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          {lang === "id"
            ? "Format soal & kunci jawaban sama seperti di Bank Soal. Gunakan tombol Edit pada tugas untuk mengubahnya."
            : "Question format & answer keys match Bank Soal. Use Edit on the task to change them."}
        </p>
        <QuizReviewList questions={questions} answerKey={answerKey} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{lang === "id" ? "Tutup" : "Close"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
