import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { computeTotal, predikatOf, TAJWID_TOLERANCE, HELP_TOLERANCE } from "@/lib/mutabaah";
import { signAnswerFile } from "@/lib/transcribe.functions";

export type QType = "multiple_choice" | "true_false" | "short_answer" | "essay" | "voice" | "image";

export const Q_TYPE_LABEL = (type: QType, lang: string): string => {
  const map: Record<QType, [string, string]> = {
    multiple_choice: ["Pilihan Ganda", "Multiple Choice"],
    true_false: ["Benar / Salah", "True / False"],
    short_answer: ["Isian Singkat", "Short Answer"],
    essay: ["Esai (manual)", "Essay (manual)"],
    voice: ["Jawaban Audio (manual)", "Audio Answer (manual)"],
    image: ["Jawaban Foto/Gambar (manual)", "Photo/Image Answer (manual)"],
  };
  return lang === "id" ? map[type][0] : map[type][1];
};

const isHalaqoh = (subject?: string | null) => !!subject && /halaqoh/i.test(subject);

type Verdict = "correct" | "wrong" | "manual" | "empty";

// Automatic scoring rule for one question against its answer key.
// Objective types (PG, true/false, short answer) are scored automatically;
// essay & audio always require manual review by the teacher.
export function evalAnswer(q: any, ans: any, key: any): Verdict {
  if (!q) return "manual";
  if (q.type === "essay" || q.type === "voice" || q.type === "image") return "manual";
  const has = ans !== undefined && ans !== null && String(ans).trim() !== "";
  if (!has) return "empty";
  if (key === undefined || key === null || String(key).trim() === "") return "manual";
  if (q.type === "multiple_choice") return Number(ans) === Number(key) ? "correct" : "wrong";
  if (q.type === "complex_multiple_choice") return normIdxList(ans) === normIdxList(key) ? "correct" : "wrong";
  if (q.type === "true_false") return String(ans).toLowerCase() === String(key).toLowerCase() ? "correct" : "wrong";
  if (q.type === "short_answer") {
    const accepted = String(key).split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return accepted.includes(String(ans).trim().toLowerCase()) ? "correct" : "wrong";
  }
  return "manual";
}

/** Normalize a "0,2" style index list so order/spacing never changes the verdict. */
export function normIdxList(v: any): string {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .join(",");
}

/** Render an index list ("0,2") as readable option text. */
export function idxListText(q: any, v: any): string {
  const idx = normIdxList(v).split(",").filter(Boolean).map(Number);
  if (!idx.length) return "—";
  return idx
    .map((i) => `${String.fromCharCode(65 + i)}. ${Array.isArray(q.options) && q.options[i] != null ? q.options[i] : ""}`.trim())
    .join(" · ");
}

// Human-readable correct answer for the grading panel.
export function keyText(q: any, key: any, lang: string): string {
  if (key === undefined || key === null || String(key).trim() === "") return "—";
  if (q.type === "multiple_choice") return Array.isArray(q.options) && q.options[Number(key)] != null ? q.options[Number(key)] : `#${key}`;
  if (q.type === "complex_multiple_choice") return idxListText(q, key);
  if (q.type === "true_false") return String(key).toLowerCase() === "true" ? (lang === "id" ? "Benar" : "True") : (lang === "id" ? "Salah" : "False");
  return String(key).split("|").map((s) => s.trim()).filter(Boolean).join(" / ");
}


/**
 * Unified grading dialog for quiz-format assignments. Auto-corrects objective
 * questions, lets the teacher listen to / review each audio & image answer and
 * score every manual answer separately, and (for Halaqoh subjects) records the
 * result into Mutaba'ah automatically.
 */
export function QuizGradeDialog({
  quiz, submission, studentName, onClose, invalidateKey = ["quizzes"],
}: {
  quiz: any; submission: any; studentName: string; onClose: () => void; invalidateKey?: any[];
}) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const questions: any[] = Array.isArray(quiz.questions) ? quiz.questions : [];
  const studentAnswers: any[] = useMemo(() => {
    try { return JSON.parse(submission.content ?? "[]"); } catch { return []; }
  }, [submission.content]);
  const [feedback, setFeedback] = useState<string>(submission.feedback ?? "");
  const [voiceUrls, setVoiceUrls] = useState<Record<number, string>>({});
  const [manualScores, setManualScores] = useState<Record<number, number>>({});
  const signFile = useServerFn(signAnswerFile);

  // Answer key (objective questions) so the panel can auto-correct.
  const { data: answerKey = [] } = useQuery({
    queryKey: ["quiz-answer-key", quiz.id],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_answer_keys").select("answer_key").eq("assignment_id", quiz.id).maybeSingle();
      try { return data?.answer_key ? JSON.parse(data.answer_key as any) : []; } catch { return []; }
    },
  });

  // Automatic scoring: each question is worth an equal share of max_score.
  const auto = useMemo(() => {
    let correct = 0, objective = 0, manual = 0;
    questions.forEach((q, i) => {
      const v = evalAnswer(q, studentAnswers[i], (answerKey as any[])[i]);
      if (v === "manual") manual++;
      else { objective++; if (v === "correct") correct++; }
    });
    const per = questions.length ? quiz.max_score / questions.length : 0;
    return { correct, objective, manual, per, autoScore: Math.round(correct * per) };
  }, [questions, studentAnswers, answerKey, quiz.max_score]);

  // Round per-question point value (each question is an equal share of max_score)
  // and the running total of manually-scored answers (essay/voice/image).
  const perQuestion = questions.length ? Math.round(quiz.max_score / questions.length) : 0;
  const manualTotal = useMemo(
    () => Object.values(manualScores).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
    [manualScores],
  );


  // Pre-fill the final score from the automatic rule when not yet graded.
  const [score, setScore] = useState<number>(
    submission.status === "graded" && submission.score != null ? submission.score : auto.autoScore,
  );
  const [scoreTouched, setScoreTouched] = useState(false);
  // Final score defaults to auto (objective) + manual per-question points, until
  // the teacher overrides the final value directly.
  useEffect(() => {
    if (!scoreTouched && submission.status !== "graded") {
      setScore(Math.min(quiz.max_score, auto.autoScore + manualTotal));
    }
  }, [auto.autoScore, manualTotal, scoreTouched, submission.status, quiz.max_score]);

  const halaqoh = isHalaqoh(quiz.subject);
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
        const type = questions[i]?.type;
        const path = studentAnswers[i];
        if (!path) continue;
        const bucket = type === "voice" ? "voice-answers" : type === "image" ? "answer-images" : null;
        if (!bucket) continue;
        try {
          const r = await signFile({ data: { bucket, path } });
          if (r?.url) next[i] = r.url;
        } catch { /* ignore missing file */ }
      }
      if (active) setVoiceUrls(next);
    })();
    return () => { active = false; };
  }, [questions, studentAnswers, signFile]);





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
      qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ["submissions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Nilai" : "Grade"} · {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Automatic scoring rule summary */}
          {(auto.objective > 0 || auto.manual > 0) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-xs font-semibold">
              <span className="text-primary">{lang === "id" ? "Skor" : "Scoring"}:</span>
              {auto.objective > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700">✓ {auto.correct}/{auto.objective} {lang === "id" ? "benar (otomatis)" : "correct (auto)"} · {auto.autoScore} {lang === "id" ? "poin" : "pts"}</span>}
              {auto.manual > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">✍️ {Object.keys(manualScores).length}/{auto.manual} {lang === "id" ? "jawaban dinilai" : "answers scored"} · {manualTotal} {lang === "id" ? "poin" : "pts"}</span>}
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{lang === "id" ? "total" : "total"}: {Math.min(quiz.max_score, auto.autoScore + manualTotal)}/{quiz.max_score}</span>
              <span className="w-full text-[11px] font-normal text-muted-foreground">{lang === "id" ? `Aturan: tiap soal bernilai ${perQuestion} poin. Nilai tiap jawaban audio/gambar/esai secara terpisah di bawah.` : `Rule: each question = ${perQuestion} pts. Score each audio/image/essay answer separately below.`}</span>
              <Button type="button" size="sm" variant="outline" className="h-6 px-2" onClick={() => { setScore(Math.min(quiz.max_score, auto.autoScore + manualTotal)); setScoreTouched(true); }}>{lang === "id" ? "Terapkan total" : "Apply total"}</Button>
            </div>
          )}
          {questions.map((q, i) => {
            const ans = studentAnswers[i];
            const key = (answerKey as any[])[i];
            const verdict = evalAnswer(q, ans, key);
            const objective = q.type === "multiple_choice" || q.type === "true_false" || q.type === "short_answer";
            return (
              <div key={i} className="rounded-xl border-2 border-border bg-muted/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display font-bold">{i + 1}. {q.q} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{Q_TYPE_LABEL(q.type, lang)}</span></p>
                  {verdict === "correct" && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ {lang === "id" ? "Benar" : "Correct"}</span>}
                  {verdict === "wrong" && <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">✗ {lang === "id" ? "Salah" : "Wrong"}</span>}
                  {verdict === "manual" && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700">✍️ {lang === "id" ? "Manual" : "Manual"}</span>}
                  {verdict === "empty" && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Kosong" : "Empty"}</span>}
                </div>
                <div className="mt-1.5 text-foreground/80">
                  {q.type === "voice" ? (
                    <div className="space-y-2">
                      {voiceUrls[i] ? <audio controls src={voiceUrls[i]} className="mt-1 w-full" /> : <span className="text-muted-foreground">{ans ? (lang === "id" ? "(memuat audio…)" : "(loading audio…)") : (lang === "id" ? "(tidak ada rekaman)" : "(no recording)")}</span>}
                    </div>
                  ) : q.type === "image" ? (
                    <div className="space-y-1">
                      {voiceUrls[i] ? (
                        <a href={voiceUrls[i]} target="_blank" rel="noreferrer" className="block">
                          <img src={voiceUrls[i]} alt="jawaban siswa" className="mt-1 max-h-72 rounded-lg border-2 border-border object-contain" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{ans ? (lang === "id" ? "(memuat gambar…)" : "(loading image…)") : (lang === "id" ? "(tidak ada gambar)" : "(no image)")}</span>
                      )}
                    </div>
                  ) : q.type === "multiple_choice" ? (
                    <span>{lang === "id" ? "Jawaban:" : "Answer:"} {Array.isArray(q.options) && q.options[Number(ans)] != null ? q.options[Number(ans)] : "—"}</span>
                  ) : q.type === "true_false" ? (
                    <span>{lang === "id" ? "Jawaban:" : "Answer:"} {String(ans) === "true" ? (lang === "id" ? "Benar" : "True") : String(ans) === "false" ? (lang === "id" ? "Salah" : "False") : "—"}</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{ans || "—"}</span>
                  )}
                </div>
                {objective && verdict === "wrong" && (
                  <p className="mt-1 text-xs text-emerald-700">{lang === "id" ? "Kunci:" : "Key:"} {keyText(q, key, lang)}</p>
                )}
                {verdict === "manual" && (
                  <div className="mt-2 flex items-center gap-2 border-t border-dashed border-border pt-2">
                    <Label className="text-xs font-bold text-amber-700">⭐ {lang === "id" ? "Nilai soal ini" : "Score this answer"}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={perQuestion}
                      value={manualScores[i] ?? ""}
                      placeholder="0"
                      className="h-8 w-24"
                      onChange={(e) => {
                        const raw = e.target.value === "" ? 0 : Math.min(perQuestion, Math.max(0, Number(e.target.value)));
                        setManualScores((m) => ({ ...m, [i]: raw }));
                        setScoreTouched(false);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">/ {perQuestion} {lang === "id" ? "poin" : "pts"}</span>
                  </div>
                )}

              </div>
            );
          })}

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>{lang === "id" ? "Nilai Akhir" : "Final Score"} (/{quiz.max_score})</Label><Input type="number" min={0} max={quiz.max_score} value={score} onChange={(e) => { setScore(Number(e.target.value)); setScoreTouched(true); }} /></div>
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
