import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Database, Mic, Plus, Send, Trash2, X, BookOpenCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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
import { QuizTabs } from "@/components/quiz-tabs";
import { LinkBadges } from "@/components/link-fields";
import { MediaViewer } from "@/components/media-input";

export const Route = createFileRoute("/_authenticated/guru/bank-soal")({
  head: () => ({ meta: [{ title: "Bank Soal · EduQuest Academy" }] }),
  component: GuruBankSoalPage,
});

const MAX_QUESTIONS = 40;

// UI-level question type. Halaqoh kinds are stored as type='voice' + halaqoh_kind in DB.
type BType =
  | "multiple_choice"
  | "complex_multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay"
  | "voice"
  | "halaqoh_menyimak"
  | "halaqoh_setoran"
  | "halaqoh_tilawah";

const HALAQOH_TYPES: BType[] = ["halaqoh_menyimak", "halaqoh_setoran", "halaqoh_tilawah"];
const isHalaqohType = (t: BType) => HALAQOH_TYPES.includes(t);

const TYPE_LABEL = (t: BType, lang: string): string => {
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

const HALAQOH_KIND: Record<string, BType> = {
  menyimak: "halaqoh_menyimak",
  setoran: "halaqoh_setoran",
  tilawah: "halaqoh_tilawah",
};

type BQ = {
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
const SETORAN_KINDS: { value: string; id: string; en: string }[] = [
  { value: "ziyadah", id: "Ziyadah (Hafalan Baru)", en: "Ziyadah (New)" },
  { value: "murajaah", id: "Muraja'ah (Mengulang)", en: "Muraja'ah (Review)" },
  { value: "tilawah_harian", id: "Tilawah Harian", en: "Daily Tilawah" },
];
const setoranLabel = (v: string | null | undefined, lang: string) => {
  const f = SETORAN_KINDS.find((s) => s.value === v);
  return f ? (lang === "id" ? f.id : f.en) : "";
};

const emptyQ = (type: BType = "multiple_choice"): BQ => ({
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

function GuruBankSoalPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [questions, setQuestions] = useState<BQ[]>([emptyQ()]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["qb", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("question_bank").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const resetForm = () => { setSubject(""); setGradeLevel(""); setQuestions([emptyQ()]); };

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
  const addQuestion = (type: BType = "multiple_choice") =>
    setQuestions((qs) => {
      if (qs.length >= MAX_QUESTIONS) { toast.error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS}`); return qs; }
      return [...qs, emptyQ(type)];
    });
  const removeQuestion = (i: number) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>, qi: number) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingIdx(qi);
    try {
      const path = `${user.id}/qb-${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
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

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      const rows = questions.map((q, i) => {
        const prompt = q.question.trim();
        const at = (lang === "id" ? "Soal " : "Question ") + (i + 1);
        if (isHalaqohType(q.type)) {
          if (!q.surah.trim() && !prompt) throw new Error(`${at}: ${lang === "id" ? "isi surah atau instruksi" : "fill surah or instruction"}`);
          const kind = q.type.replace("halaqoh_", "");
          const isSetoranLike = q.type === "halaqoh_setoran" || q.type === "halaqoh_tilawah";
          const setoranTxt = isSetoranLike && q.setoranKind ? ` · ${setoranLabel(q.setoranKind, lang)}` : "";
          const pagesTxt = q.minPages.trim() ? ` · min ${q.minPages.trim()} hlm` : "";
          const defaultPrompt = `${TYPE_LABEL(q.type, lang)}${q.surah.trim() ? ` — ${q.surah.trim()}` : ""}${q.target.trim() ? ` (${q.target.trim()})` : ""}${setoranTxt}${pagesTxt}`;
          return {
            teacher_id: user.id, subject: subject || null, grade_level: gradeLevel || null,
            topic: q.surah.trim() || null, question: prompt || defaultPrompt, type: "voice" as const,
            halaqoh_kind: kind, options: null, answer: q.target.trim() || null,
            difficulty: q.difficulty as any, image_url: q.image_url || null,
            setoran_kind: isSetoranLike ? (q.setoranKind || null) : null,
            min_pages: q.minPages.trim() ? Number(q.minPages.trim()) : null,
          };
        }
        if (!prompt) throw new Error(`${at}: ${lang === "id" ? "pertanyaan kosong" : "empty question"}`);
        let opts: string[] | null = null;
        let answer: string | null = q.answer.trim() || null;
        if (q.type === "multiple_choice") {
          opts = q.options.map((o) => o.trim()).filter(Boolean);
          if (opts.length < 2) throw new Error(`${at}: ${lang === "id" ? "minimal 2 pilihan" : "min 2 options"}`);
          const chosen = q.options[q.correctIndex]?.trim();
          if (!chosen) throw new Error(`${at}: ${lang === "id" ? "pilih jawaban benar" : "select correct answer"}`);
          answer = chosen;
        } else if (q.type === "complex_multiple_choice") {
          opts = q.options.map((o) => o.trim()).filter(Boolean);
          if (opts.length < 2) throw new Error(`${at}: ${lang === "id" ? "minimal 2 pilihan" : "min 2 options"}`);
          const chosen = q.correctIndices.map((idx) => q.options[idx]?.trim()).filter(Boolean);
          if (chosen.length < 1) throw new Error(`${at}: ${lang === "id" ? "tandai minimal 1 jawaban" : "mark at least 1"}`);
          answer = chosen.join(", ");
        } else if (q.type === "true_false") {
          opts = null;
          if (!answer) answer = "Benar";
        } else if (q.type === "short_answer") {
          if (!answer) throw new Error(`${at}: ${lang === "id" ? "isi kunci jawaban" : "fill answer key"}`);
        } else if (q.type === "voice") {
          opts = null; answer = null;
        }
        return {
          teacher_id: user.id, subject: subject || null, grade_level: gradeLevel || null,
          topic: q.topic.trim() || null, question: prompt, type: q.type as any,
          halaqoh_kind: null, options: opts, answer, difficulty: q.difficulty as any,
          image_url: q.image_url || null,
        };
      });
      if (rows.length === 0) throw new Error(lang === "id" ? "Tambahkan minimal 1 soal" : "Add at least 1 question");
      const { error } = await supabase.from("question_bank").insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(lang === "id" ? `${n} soal ditambahkan ✨` : `${n} questions added ✨`);
      setOpen(false); resetForm();
      qc.invalidateQueries({ queryKey: ["qb"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("question_bank").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qb"] }); setSelected((s) => s.filter(Boolean)); },
  });

  const diffColor: Record<string, string> = { easy: "bg-xp/20 text-xp", medium: "bg-coin/20 text-coin", hard: "bg-destructive/20 text-destructive" };
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ALL_TYPES: BType[] = ["multiple_choice", "complex_multiple_choice", "true_false", "short_answer", "essay", "voice", "halaqoh_menyimak", "halaqoh_setoran", "halaqoh_tilawah"];

  return (
    <DashboardShell accent="guru">
      <QuizTabs active="bank" />

      <PageHeader title={t("navQuestionBank")} subtitle={lang === "id" ? `Buat banyak soal sekaligus (maks ${MAX_QUESTIONS}) & kirim ke Tugas` : `Create many questions at once (max ${MAX_QUESTIONS}) & send to assignments`}
        actions={
          <div className="flex flex-wrap gap-2">
            {selected.length > 0 && (
              <Button variant="quest" onClick={() => setTransferOpen(true)}>
                <Send className="size-4" /> {lang === "id" ? `Kirim ke Tugas (${selected.length})` : `Send to Tugas (${selected.length})`}
              </Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm(); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newQuestion")}</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{lang === "id" ? "Tambah Soal (banyak sekaligus)" : "Add Questions (bulk)"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{t("subject")}</Label><SubjectSelect value={subject} onChange={setSubject} /></div>
                    <div>
                      <Label>{lang === "id" ? "Untuk Kelas / Jenjang" : "Target Class / Grade"}</Label>
                      <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder={lang === "id" ? "mis. Kelas 7, SMP, Halaqoh A" : "e.g. Grade 7"} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Label className="text-base font-bold">{lang === "id" ? "Daftar Soal" : "Questions"} <span className="font-normal text-muted-foreground">({questions.length}/{MAX_QUESTIONS})</span></Label>
                    <Select value="" onValueChange={(v) => addQuestion(v as BType)}>
                      <SelectTrigger className="h-9 w-auto gap-1"><Plus className="size-4" /><span className="text-sm">{lang === "id" ? "Tambah Soal" : "Add"}</span></SelectTrigger>
                      <SelectContent>
                        {ALL_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{TYPE_LABEL(tp, lang)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

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

                            <div className="mt-2">
                              <input type="file" accept="image/*" onChange={(e) => uploadImage(e, qi)} disabled={uploadingIdx === qi}
                                className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-guru file:px-3 file:py-1.5 file:text-white" />
                              {uploadingIdx === qi && <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Mengunggah…" : "Uploading…"}</p>}
                              {q.image_url && <p className="mt-1 text-xs text-emerald-600">✅ {lang === "id" ? "Gambar siap" : "Image attached"}</p>}
                            </div>

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
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{createMut.isPending ? (lang === "id" ? "Menyimpan…" : "Saving…") : t("save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } />

      {items.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="space-y-3">
          {items.map((q: any) => {
            const isSel = selected.includes(q.id);
            return (
              <div key={q.id} className={`rounded-2xl border-2 bg-card p-4 shadow-card-rpg transition ${isSel ? "border-quest" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <button type="button" onClick={() => toggleSel(q.id)} aria-label="select"
                      className={`mt-1 grid size-6 shrink-0 place-items-center rounded-md border-2 ${isSel ? "border-quest bg-quest text-white" : "border-muted-foreground/40"}`}>
                      {isSel && <CheckCircle2 className="size-4" />}
                    </button>
                    <div className="grid size-10 place-items-center rounded-xl bg-gradient-magic text-white shrink-0">
                      {q.halaqoh_kind ? <BookOpenCheck className="size-4" /> : q.type === "voice" ? <Mic className="size-4" /> : <Database className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {q.subject && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{q.subject}</span>}
                        {q.grade_level && <span className="rounded-full bg-siswa/15 px-2 py-0.5 text-xs font-display font-bold text-siswa">{q.grade_level}</span>}
                        {q.topic && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{q.topic}</span>}
                        {q.halaqoh_kind && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-display font-bold text-emerald-700">{TYPE_LABEL(HALAQOH_KIND[q.halaqoh_kind] ?? "halaqoh_setoran", lang)}</span>}
                        {q.setoran_kind && <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-display font-bold text-teal-700">{setoranLabel(q.setoran_kind, lang)}</span>}
                        {q.min_pages != null && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-display font-bold text-amber-700">≥ {q.min_pages} hlm</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-display font-bold ${diffColor[q.difficulty]}`}>{t(q.difficulty as any)}</span>
                      </div>
                      <p className="mt-2 font-display font-semibold">{q.question}</p>
                      {q.image_url && <MediaViewer mediaType="image" mediaUrl={q.image_url} />}
                      {q.options && <ul className="mt-2 ml-4 list-disc text-sm text-muted-foreground">{(q.options as string[]).map((o, i) => <li key={i}>{o}</li>)}</ul>}
                      {q.answer && !q.halaqoh_kind && <div className="mt-2 text-xs"><span className="font-display font-bold text-xp">{t("answer")}:</span> {q.answer}</div>}
                      <LinkBadges quizLink={q.quiz_link} gameLink={q.game_link} />
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(q.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        items={(items as any[]).filter((q) => selected.includes(q.id))}
        onDone={() => { setSelected([]); setTransferOpen(false); }}
      />
    </DashboardShell>
  );
}

// Map a bank row to a quiz question + answer-key entry for the assignments feature.
function mapBankToQuiz(b: any): { question: any; key: any } {
  const opts: string[] = Array.isArray(b.options) ? b.options : [];
  if (b.halaqoh_kind || b.type === "voice") {
    return { question: { type: "voice", q: b.question, image_url: b.image_url ?? null }, key: null };
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

function TransferDialog({ open, onOpenChange, items, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; items: any[]; onDone: () => void }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setClassId("");
      setSubject(items.find((i) => i.subject)?.subject ?? "");
      setDueAt("");
    }
  }, [open, items]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user && open,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!title.trim()) throw new Error(lang === "id" ? "Judul wajib diisi" : "Title required");
      if (!classId) throw new Error(lang === "id" ? "Pilih kelas tujuan" : "Select a class");
      if (items.length === 0) throw new Error(lang === "id" ? "Tidak ada soal terpilih" : "No questions selected");
      const questionsPublic: any[] = [];
      const answerKey: any[] = [];
      items.slice(0, MAX_QUESTIONS).forEach((b) => {
        const { question, key } = mapBankToQuiz(b);
        questionsPublic.push(question);
        answerKey.push(key);
      });
      const { data: inserted, error } = await supabase
        .from("assignments")
        .insert({
          teacher_id: user.id, class_id: classId, title: title.trim(),
          subject: subject || null, exam_type: "harian",
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          max_score: 100, xp_reward: 50, coin_reward: 10,
          answer_format: "quiz", questions: questionsPublic as any,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const { error: keyErr } = await supabase.from("assignment_answer_keys").insert({
        assignment_id: inserted!.id, teacher_id: user.id, answer_key: JSON.stringify(answerKey),
      });
      if (keyErr) throw keyErr;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Soal dikirim sebagai Tugas 🎉" : "Sent as assignment 🎉");
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Kirim ke Tugas / Kelas" : "Send to Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{lang === "id" ? `${items.length} soal akan dikirim sebagai satu tugas/kuis.` : `${items.length} questions will be sent as one assignment.`}</p>
          <div>
            <Label>{lang === "id" ? "Judul Tugas" : "Title"} <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === "id" ? "mis. Latihan Bab 1" : "e.g. Practice Ch.1"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{lang === "id" ? "Kelas" : "Class"} <span className="text-destructive">*</span></Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">{lang === "id" ? "— pilih kelas —" : "— select class —"}</option>
                {(classes as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>{lang === "id" ? "Tenggat (opsional)" : "Due (optional)"}</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
          <Button variant="quest" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "…" : (lang === "id" ? "Kirim" : "Send")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
