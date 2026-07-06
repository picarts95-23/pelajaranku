import { Check, Mic, Plus, Trash2, X, BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/lib/i18n";

export const MAX_QUESTIONS = 40;

// UI-level question type. Halaqoh kinds are stored as type='voice' + halaqoh_kind in DB.
export type BType =
  | "multiple_choice"
  | "complex_multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay"
  | "voice"
  | "image"
  | "halaqoh_menyimak"
  | "halaqoh_setoran"
  | "halaqoh_tilawah";

export const HALAQOH_TYPES: BType[] = ["halaqoh_menyimak", "halaqoh_setoran", "halaqoh_tilawah"];
export const isHalaqohType = (t: BType) => HALAQOH_TYPES.includes(t);

export const ALL_TYPES: BType[] = [
  "multiple_choice", "complex_multiple_choice", "true_false", "short_answer",
  "essay", "voice", "halaqoh_menyimak", "halaqoh_setoran", "halaqoh_tilawah",
];

export const TYPE_LABEL = (t: BType, lang: string): string => {
  const map: Record<BType, [string, string]> = {
    multiple_choice: ["Pilihan Ganda", "Multiple Choice"],
    complex_multiple_choice: ["Pilihan Ganda Kompleks", "Complex Multiple Choice"],
    true_false: ["Benar / Salah", "True / False"],
    short_answer: ["Isian Singkat", "Short Answer"],
    essay: ["Esai (manual)", "Essay (manual)"],
    voice: ["Jawaban Audio", "Audio Answer"],
    halaqoh_menyimak: ["Halaqoh: Menyimak Surah", "Halaqoh: Listening"],
    halaqoh_setoran: ["Halaqoh: Setoran Hafalan", "Halaqoh: Memorization"],
    halaqoh_tilawah: ["Halaqoh: Tilawah Harian", "Halaqoh: Daily Tilawah"],
  };
  return lang === "id" ? map[t][0] : map[t][1];
};

export const HALAQOH_KIND: Record<string, BType> = {
  menyimak: "halaqoh_menyimak",
  setoran: "halaqoh_setoran",
  tilawah: "halaqoh_tilawah",
};

// Bank Soal exam categories. 'halaqoh' is auto-applied to Halaqoh-type items.
export const EXAM_CATEGORIES: { value: string; id: string; en: string }[] = [
  { value: "harian", id: "Soal Harian", en: "Daily" },
  { value: "uts", id: "Soal UTS", en: "Midterm (UTS)" },
  { value: "uas", id: "Soal UAS", en: "Final (UAS)" },
  { value: "halaqoh", id: "Soal Halaqoh Qur'an", en: "Halaqoh Qur'an" },
];
export const examCategoryLabel = (v: string | null | undefined, lang: string) => {
  const f = EXAM_CATEGORIES.find((c) => c.value === v);
  return f ? (lang === "id" ? f.id : f.en) : (v ?? "");
};

// Normalize a stored setoran kind to the canonical Halaqoh kind used by the
// Mutaba'ah accumulation (assignments.halaqoh_kind ∈ ziyadah|murojaah|tilawah).
export function normalizeHalaqohKind(v: string | null | undefined): string | null {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("ziyadah")) return "ziyadah";
  if (s.startsWith("muroj") || s.startsWith("muraj")) return "murojaah";
  if (s.startsWith("tilawah")) return "tilawah";
  return null;
}

export type BQ = {
  type: BType;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  correctIndices: number[];
  answer: string;
  difficulty: string;
  image_url: string | null;
  surah: string;
  target: string;
  setoranKind: string;
  minPages: string;
};

// Setoran kinds for Halaqoh setoran / tilawah items.
export const SETORAN_KINDS: { value: string; id: string; en: string }[] = [
  { value: "ziyadah", id: "Ziyadah (Hafalan Baru)", en: "Ziyadah (New)" },
  { value: "murajaah", id: "Muraja'ah (Mengulang)", en: "Muraja'ah (Review)" },
  { value: "tilawah_harian", id: "Tilawah Harian", en: "Daily Tilawah" },
];
export const setoranLabel = (v: string | null | undefined, lang: string) => {
  const f = SETORAN_KINDS.find((s) => s.value === v);
  return f ? (lang === "id" ? f.id : f.en) : "";
};

export const emptyQ = (type: BType = "multiple_choice"): BQ => ({
  type,
  topic: "",
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  correctIndices: [],
  answer: "",
  difficulty: "medium",
  image_url: null,
  surah: "",
  target: "",
  setoranKind: type === "halaqoh_tilawah" ? "tilawah_harian" : type === "halaqoh_setoran" ? "ziyadah" : "",
  minPages: type === "halaqoh_tilawah" ? "1" : "",
});

// Build DB rows from the form, collecting ALL validation errors (never throws).
// Returns rows only when there are zero errors.
export function buildBankRows(
  questions: BQ[],
  subject: string,
  gradeLevel: string,
  examCategory: string,
  userId: string,
  lang: string,
): { rows: any[]; errors: string[] } {
  const errors: string[] = [];
  const rows: any[] = [];

  if (questions.length === 0) {
    errors.push(lang === "id" ? "Tambahkan minimal 1 soal." : "Add at least 1 question.");
  }
  if (questions.length > MAX_QUESTIONS) {
    errors.push(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal (sekarang ${questions.length}).` : `Max ${MAX_QUESTIONS} (now ${questions.length}).`);
  }

  questions.forEach((q, i) => {
    const at = (lang === "id" ? "Soal " : "Q ") + (i + 1);
    const prompt = q.question.trim();

    if (isHalaqohType(q.type)) {
      if (!q.surah.trim() && !prompt) {
        errors.push(`${at}: ${lang === "id" ? "isi Surah atau instruksi." : "fill surah or instruction."}`);
      }
      const isSetoranLike = q.type === "halaqoh_setoran" || q.type === "halaqoh_tilawah";
      if (isSetoranLike && !q.setoranKind) {
        errors.push(`${at}: ${lang === "id" ? "pilih Jenis Setoran." : "choose setoran type."}`);
      }
      if (q.minPages.trim() && (isNaN(Number(q.minPages)) || Number(q.minPages) < 0)) {
        errors.push(`${at}: ${lang === "id" ? "Min. Halaman harus angka ≥ 0." : "Min pages must be a number ≥ 0."}`);
      }
      const kind = q.type.replace("halaqoh_", "");
      const setoranTxt = isSetoranLike && q.setoranKind ? ` · ${setoranLabel(q.setoranKind, lang)}` : "";
      const pagesTxt = q.minPages.trim() ? ` · min ${q.minPages.trim()} hlm` : "";
      const defaultPrompt = `${TYPE_LABEL(q.type, lang)}${q.surah.trim() ? ` — ${q.surah.trim()}` : ""}${q.target.trim() ? ` (${q.target.trim()})` : ""}${setoranTxt}${pagesTxt}`;
      rows.push({
        teacher_id: userId, subject: subject || null, grade_level: gradeLevel || null,
        topic: q.surah.trim() || null, question: prompt || defaultPrompt, type: "voice" as const,
        halaqoh_kind: kind, options: null, answer: q.target.trim() || null,
        difficulty: q.difficulty as any, image_url: q.image_url || null,
        exam_category: "halaqoh",
        setoran_kind: isSetoranLike ? (q.setoranKind || null) : null,
        min_pages: q.minPages.trim() ? Number(q.minPages.trim()) : null,
      });
      return;
    }

    if (!prompt) {
      errors.push(`${at}: ${lang === "id" ? "pertanyaan masih kosong." : "question is empty."}`);
    }
    let opts: string[] | null = null;
    let answer: string | null = q.answer.trim() || null;
    if (q.type === "multiple_choice") {
      opts = q.options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) errors.push(`${at}: ${lang === "id" ? "minimal 2 pilihan jawaban." : "min 2 options."}`);
      const chosen = q.options[q.correctIndex]?.trim();
      if (!chosen) errors.push(`${at}: ${lang === "id" ? "tandai jawaban yang benar." : "mark the correct answer."}`);
      answer = chosen || null;
    } else if (q.type === "complex_multiple_choice") {
      opts = q.options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) errors.push(`${at}: ${lang === "id" ? "minimal 2 pilihan jawaban." : "min 2 options."}`);
      const chosen = q.correctIndices.map((idx) => q.options[idx]?.trim()).filter(Boolean);
      if (chosen.length < 1) errors.push(`${at}: ${lang === "id" ? "tandai minimal 1 jawaban benar." : "mark at least 1 correct answer."}`);
      answer = chosen.join(", ") || null;
    } else if (q.type === "true_false") {
      opts = null;
      if (!answer) answer = "Benar";
    } else if (q.type === "short_answer") {
      if (!answer) errors.push(`${at}: ${lang === "id" ? "isi kunci jawaban." : "fill the answer key."}`);
    } else if (q.type === "voice") {
      opts = null; answer = null;
    }
    rows.push({
      teacher_id: userId, subject: subject || null, grade_level: gradeLevel || null,
      topic: q.topic.trim() || null, question: prompt, type: q.type as any,
      halaqoh_kind: null, options: opts, answer, difficulty: q.difficulty as any,
      image_url: q.image_url || null,
      exam_category: examCategory || "harian",
    });
  });

  return { rows: errors.length ? [] : rows, errors };
}

// Map a bank row to a quiz question + answer-key entry for the assignments feature.
// Halaqoh metadata is preserved on the question so grading can auto-record to Mutaba'ah.
export function mapBankToQuiz(b: any): { question: any; key: any } {
  const opts: string[] = Array.isArray(b.options) ? b.options : [];
  if (b.halaqoh_kind || b.type === "voice") {
    return {
      question: {
        type: "voice", q: b.question, image_url: b.image_url ?? null,
        halaqoh_kind: b.halaqoh_kind ?? null,
        setoran_kind: b.setoran_kind ?? null,
        surah: b.topic ?? null,
        target: b.answer ?? null,
        min_pages: b.min_pages ?? null,
      },
      key: null,
    };
  }
  if (b.type === "multiple_choice") {
    const idx = Math.max(0, opts.findIndex((o) => o.trim().toLowerCase() === String(b.answer ?? "").split(",")[0].trim().toLowerCase()));
    return { question: { type: "multiple_choice", q: b.question, options: opts.length ? opts : ["", ""], image_url: b.image_url ?? null }, key: idx };
  }
  if (b.type === "true_false") {
    const a = String(b.answer ?? "").trim().toLowerCase();
    const truthy = ["true", "benar", "b", "ya", "yes", "1"].includes(a);
    return { question: { type: "true_false", q: b.question, options: ["Benar", "Salah"], image_url: b.image_url ?? null }, key: truthy ? "true" : "false" };
  }
  if (b.type === "short_answer") {
    return { question: { type: "short_answer", q: b.question, image_url: b.image_url ?? null }, key: String(b.answer ?? "").trim() };
  }
  // essay / complex / others -> manual essay
  return { question: { type: "essay", q: b.question, image_url: b.image_url ?? null }, key: null };
}

// Reconstruct an editable BQ from a stored question_bank row.
export function bankRowToBQ(row: any): BQ {
  const base = emptyQ();
  if (row.halaqoh_kind) {
    const t = HALAQOH_KIND[row.halaqoh_kind] ?? "halaqoh_setoran";
    return {
      ...base, type: t, question: row.question ?? "",
      surah: row.topic ?? "", target: row.answer ?? "",
      setoranKind: row.setoran_kind ?? (t === "halaqoh_tilawah" ? "tilawah_harian" : t === "halaqoh_setoran" ? "ziyadah" : ""),
      minPages: row.min_pages != null ? String(row.min_pages) : "",
      difficulty: row.difficulty ?? "medium", image_url: row.image_url ?? null,
    };
  }
  const opts: string[] = Array.isArray(row.options) ? row.options : ["", "", "", ""];
  const out: BQ = {
    ...base, type: (row.type as BType) ?? "multiple_choice", topic: row.topic ?? "",
    question: row.question ?? "", options: opts.length ? opts : ["", "", "", ""],
    answer: row.answer ?? "", difficulty: row.difficulty ?? "medium", image_url: row.image_url ?? null,
  };
  if (out.type === "multiple_choice") {
    const idx = opts.findIndex((o) => String(o).trim().toLowerCase() === String(row.answer ?? "").trim().toLowerCase());
    out.correctIndex = idx >= 0 ? idx : 0;
  } else if (out.type === "complex_multiple_choice") {
    const parts = String(row.answer ?? "").split(",").map((s) => s.trim().toLowerCase());
    out.correctIndices = opts.map((o, i) => (parts.includes(String(o).trim().toLowerCase()) ? i : -1)).filter((i) => i >= 0);
  }
  return out;
}

// Reconstruct an editable BQ from a quiz/assignment question object + its answer-key entry.
export function quizQuestionToBQ(q: any, key: any): BQ {
  const base = emptyQ();
  if (q?.halaqoh_kind) {
    const t = HALAQOH_KIND[q.halaqoh_kind] ?? "halaqoh_setoran";
    return {
      ...base, type: t, question: q.q ?? "",
      surah: q.surah ?? "", target: q.target ?? "",
      setoranKind: q.setoran_kind ?? (t === "halaqoh_tilawah" ? "tilawah_harian" : t === "halaqoh_setoran" ? "ziyadah" : ""),
      minPages: q.min_pages != null ? String(q.min_pages) : "",
      image_url: q.image_url ?? null,
    };
  }
  if (q?.type === "multiple_choice") {
    const opts: string[] = Array.isArray(q.options) ? q.options : ["", "", "", ""];
    return { ...base, type: "multiple_choice", question: q.q ?? "", options: opts.length ? opts : ["", "", "", ""], correctIndex: Number(key) || 0, image_url: q.image_url ?? null };
  }
  if (q?.type === "true_false") {
    return { ...base, type: "true_false", question: q.q ?? "", answer: String(key) === "true" ? "Benar" : "Salah", image_url: q.image_url ?? null };
  }
  if (q?.type === "short_answer") {
    return { ...base, type: "short_answer", question: q.q ?? "", answer: String(key ?? ""), image_url: q.image_url ?? null };
  }
  if (q?.type === "voice") {
    return { ...base, type: "voice", question: q.q ?? "", image_url: q.image_url ?? null };
  }
  return { ...base, type: "essay", question: q?.q ?? "", image_url: q?.image_url ?? null };
}

// Shared, fully self-contained editor for a list of questions.
export function QuestionEditorList({
  questions, setQuestions, uploadImage, uploadingIdx,
}: {
  questions: BQ[];
  setQuestions: React.Dispatch<React.SetStateAction<BQ[]>>;
  uploadImage?: (e: React.ChangeEvent<HTMLInputElement>, qi: number) => void;
  uploadingIdx?: number | null;
}) {
  const { t, lang } = useLang();

  const setQ = (i: number, patch: Partial<BQ>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const setOpt = (qi: number, oi: number, v: string) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? v : o)) } : q)));
  const addOpt = (qi: number) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === qi ? { ...q, options: [...q.options, ""] } : q)));
  const removeOpt = (qi: number, oi: number) =>
    setQuestions((qs) => qs.map((q, idx) => {
      if (idx !== qi) return q;
      const options = q.options.filter((_, j) => j !== oi);
      const correctIndex = q.correctIndex >= options.length ? Math.max(0, options.length - 1) : q.correctIndex;
      return { ...q, options, correctIndex, correctIndices: q.correctIndices.filter((x) => x < options.length) };
    }));
  const removeQuestion = (i: number) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));

  return (
    <div className="space-y-3">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-xl border-2 border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold">{lang === "id" ? "Soal" : "Q"} {qi + 1}</span>
            <div className="flex items-center gap-2">
              <Select value={q.type} onValueChange={(v) => setQ(qi, { type: v as BType })}>
                <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{TYPE_LABEL(tp, lang)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={q.difficulty} onValueChange={(v) => setQ(qi, { difficulty: v })}>
                <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t("easy")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="hard">{t("hard")}</SelectItem>
                </SelectContent>
              </Select>
              {questions.length > 1 && <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeQuestion(qi)}><Trash2 className="size-4 text-destructive" /></Button>}
            </div>
          </div>

          {isHalaqohType(q.type) ? (
            <div className="mt-2 space-y-2">
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <BookOpenCheck className="mr-1 inline size-3.5" />
                {lang === "id" ? "Soal Halaqoh — penilaian otomatis masuk ke Mutaba'ah saat dikirim sebagai Tugas mapel Halaqoh." : "Halaqoh item — auto-records to Mutaba'ah."}
              </div>
              {(q.type === "halaqoh_setoran" || q.type === "halaqoh_tilawah") && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">{lang === "id" ? "Jenis Setoran" : "Setoran Type"}</Label>
                    <Select value={q.setoranKind || undefined} onValueChange={(v) => setQ(qi, { setoranKind: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={lang === "id" ? "Pilih jenis" : "Select"} /></SelectTrigger>
                      <SelectContent>
                        {SETORAN_KINDS.map((s) => <SelectItem key={s.value} value={s.value}>{lang === "id" ? s.id : s.en}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{lang === "id" ? "Min. Halaman / hari" : "Min. Pages / day"}</Label>
                    <Input type="number" min={0} step="0.5" value={q.minPages} onChange={(e) => setQ(qi, { minPages: e.target.value })} placeholder={lang === "id" ? "mis. 1" : "e.g. 1"} />
                  </div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label className="text-xs">{lang === "id" ? "Surah" : "Surah"}</Label><Input value={q.surah} onChange={(e) => setQ(qi, { surah: e.target.value })} placeholder={lang === "id" ? "mis. Al-Baqarah" : "e.g. Al-Baqarah"} /></div>
                <div><Label className="text-xs">{lang === "id" ? "Target (ayat / juz)" : "Target"}</Label><Input value={q.target} onChange={(e) => setQ(qi, { target: e.target.value })} placeholder={lang === "id" ? "mis. ayat 1-10 / Juz 1" : "e.g. 1-10"} /></div>
              </div>
              <Textarea rows={2} value={q.question} onChange={(e) => setQ(qi, { question: e.target.value })} placeholder={lang === "id" ? "Instruksi (opsional)…" : "Instruction (optional)…"} />
            </div>
          ) : (
            <>
              <Textarea rows={2} className="mt-2" value={q.question} onChange={(e) => setQ(qi, { question: e.target.value })} placeholder={lang === "id" ? "Tulis pertanyaan…" : "Write the question…"} />

              {uploadImage && (
                <div className="mt-2">
                  <input type="file" accept="image/*" onChange={(e) => uploadImage(e, qi)} disabled={uploadingIdx === qi}
                    className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-guru file:px-3 file:py-1.5 file:text-white" />
                  {uploadingIdx === qi && <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Mengunggah…" : "Uploading…"}</p>}
                  {q.image_url && <p className="mt-1 text-xs text-emerald-600">✅ {lang === "id" ? "Gambar siap" : "Image attached"}</p>}
                </div>
              )}

              {(q.type === "multiple_choice" || q.type === "complex_multiple_choice") && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {q.type === "complex_multiple_choice"
                      ? (lang === "id" ? "Tandai semua jawaban benar." : "Mark all correct answers.")
                      : (lang === "id" ? "Tandai lingkaran untuk jawaban benar." : "Tap circle for correct answer.")}
                  </p>
                  {q.options.map((opt, oi) => {
                    const isComplex = q.type === "complex_multiple_choice";
                    const checked = isComplex ? q.correctIndices.includes(oi) : q.correctIndex === oi;
                    return (
                      <div key={oi} className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => isComplex
                            ? setQ(qi, { correctIndices: q.correctIndices.includes(oi) ? q.correctIndices.filter((x) => x !== oi) : [...q.correctIndices, oi] })
                            : setQ(qi, { correctIndex: oi })}
                          className={`grid size-6 shrink-0 place-items-center border-2 ${isComplex ? "rounded-md" : "rounded-full"} ${checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                          {checked && <Check className="size-3.5" />}
                        </button>
                        <Input value={opt} onChange={(e) => setOpt(qi, oi, e.target.value)} placeholder={`${lang === "id" ? "Pilihan" : "Option"} ${String.fromCharCode(65 + oi)}`} />
                        {q.options.length > 2 && <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeOpt(qi, oi)}><X className="size-4" /></Button>}
                      </div>
                    );
                  })}
                  {q.options.length < 6 && <Button type="button" size="sm" variant="ghost" onClick={() => addOpt(qi)}><Plus className="size-3" /> {lang === "id" ? "Pilihan" : "Option"}</Button>}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="mt-2 flex gap-2">
                  {["Benar", "Salah"].map((val) => (
                    <button key={val} type="button" onClick={() => setQ(qi, { answer: val })}
                      className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${q.answer === val ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border"}`}>
                      {val}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "short_answer" && (
                <div className="mt-2">
                  <Label className="text-xs">{lang === "id" ? "Kunci jawaban (alternatif pisahkan dengan |)" : "Answer key (separate with |)"}</Label>
                  <Input value={q.answer} onChange={(e) => setQ(qi, { answer: e.target.value })} placeholder={lang === "id" ? "mis. mad|maddah" : "e.g. mad|maddah"} />
                </div>
              )}

              {q.type === "voice" && (
                <p className="mt-2 rounded-lg bg-quest/10 px-3 py-1.5 text-xs font-semibold text-quest"><Mic className="mr-1 inline size-3.5" />{lang === "id" ? "Siswa menjawab dengan rekaman suara (dinilai manual)." : "Voice answer (manual)."}</p>
              )}

              {q.type === "essay" && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700">{lang === "id" ? "Esai — dinilai manual oleh guru." : "Essay — graded manually."}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
