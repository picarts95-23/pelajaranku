import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Mic, Plus, Send, Trash2, X, BookOpenCheck, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { SubjectSelect } from "@/components/subject-select";
import { QuizTabs } from "@/components/quiz-tabs";
import { LinkBadges } from "@/components/link-fields";
import { MediaViewer } from "@/components/media-input";
import {
  MAX_QUESTIONS, ALL_TYPES, type BType, type BQ,
  TYPE_LABEL, HALAQOH_KIND, SETORAN_KINDS, setoranLabel,
  isHalaqohType, emptyQ, buildBankRows, mapBankToQuiz, bankRowToBQ,
  QuestionEditorList,
} from "@/components/question-fields";

export const Route = createFileRoute("/_authenticated/guru/bank-soal")({
  head: () => ({ meta: [{ title: "Bank Soal · EduQuest Academy" }] }),
  component: GuruBankSoalPage,
});


function GuruBankSoalPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [questions, setQuestions] = useState<BQ[]>([emptyQ()]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Unified creation flow: build questions once, then choose where they go.
  const [destination, setDestination] = useState<"bank" | "assignment" | "both">("bank");
  const [aTitle, setATitle] = useState("");
  const [aTarget, setATarget] = useState<"class" | "student">("class");
  const [aClassId, setAClassId] = useState("");
  const [aStudentId, setAStudentId] = useState("");
  const [aDueAt, setADueAt] = useState("");
  const [aMaxScore, setAMaxScore] = useState(100);
  const [aXp, setAXp] = useState(50);
  const [aCoin, setACoin] = useState(10);

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["qb", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("question_bank").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-list-banksoal", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_students");
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setEditId(null);
    setSubject(""); setGradeLevel(""); setQuestions([emptyQ()]);
    setDestination("bank"); setATitle(""); setATarget("class");
    setAClassId(""); setAStudentId(""); setADueAt("");
    setAMaxScore(100); setAXp(50); setACoin(10);
  };

  // Open the form pre-filled to edit an existing bank question (single row).
  const openEdit = (row: any) => {
    setEditId(row.id);
    setSubject(row.subject ?? "");
    setGradeLevel(row.grade_level ?? "");
    setQuestions([bankRowToBQ(row)]);
    setDestination("bank");
    setOpen(true);
  };

  const setQ = (i: number, patch: Partial<BQ>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const addQuestion = (type: BType = "multiple_choice") =>
    setQuestions((qs) => {
      if (qs.length >= MAX_QUESTIONS) { toast.error(lang === "id" ? `Maksimal ${MAX_QUESTIONS} soal` : `Max ${MAX_QUESTIONS}`); return qs; }
      return [...qs, emptyQ(type)];
    });


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

  // Live validation result, shared between preview & save.
  const validation = buildBankRows(questions, subject, gradeLevel, user?.id ?? "", lang);
  const [showPreview, setShowPreview] = useState(false);

  // Extra validation when the questions are sent as a Tugas/Kuis.
  const sendAssignment = destination === "assignment" || destination === "both";
  const assignmentErrors: string[] = [];
  if (sendAssignment) {
    if (!aTitle.trim()) assignmentErrors.push(lang === "id" ? "Judul Tugas/Kuis wajib diisi." : "Title is required.");
    if (aTarget === "class" && !aClassId) assignmentErrors.push(lang === "id" ? "Pilih kelas tujuan." : "Select a target class.");
    if (aTarget === "student" && !aStudentId) assignmentErrors.push(lang === "id" ? "Pilih siswa tujuan." : "Select a target student.");
  }
  const allErrors = [...validation.errors, ...assignmentErrors];

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      const { rows, errors } = buildBankRows(questions, subject, gradeLevel, user.id, lang);
      const combined = [...errors, ...assignmentErrors];
      if (combined.length) {
        throw new Error(
          (lang === "id" ? "Periksa kembali soal:\n" : "Please fix:\n") + combined.map((e) => `• ${e}`).join("\n"),
        );
      }

      let savedBank = 0;
      let sentAssignment = 0;

      // Edit mode: update the single existing bank row (never touches assignments/submissions).
      if (editId) {
        const { error } = await supabase.from("question_bank").update(rows[0] as any).eq("id", editId);
        if (error) throw error;
        return { savedBank: 1, sentAssignment: 0, edited: true };
      }

      if (destination === "bank" || destination === "both") {
        const { error } = await supabase.from("question_bank").insert(rows as any);
        if (error) throw error;
        savedBank = rows.length;
      }

      if (sendAssignment) {
        const questionsPublic: any[] = [];
        const answerKey: any[] = [];
        rows.slice(0, MAX_QUESTIONS).forEach((b) => {
          const { question, key } = mapBankToQuiz(b);
          questionsPublic.push(question);
          answerKey.push(key);
        });
        const { data: inserted, error } = await supabase
          .from("assignments")
          .insert({
            teacher_id: user.id,
            class_id: aTarget === "class" ? aClassId : null,
            assigned_student_id: aTarget === "student" ? aStudentId : null,
            title: aTitle.trim(),
            subject: subject || null,
            exam_type: "harian",
            description: gradeLevel ? (lang === "id" ? `Jenjang: ${gradeLevel}` : `Grade: ${gradeLevel}`) : null,
            due_at: aDueAt ? new Date(aDueAt).toISOString() : null,
            max_score: aMaxScore, xp_reward: aXp, coin_reward: aCoin,
            answer_format: "quiz", questions: questionsPublic as any,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        const { error: keyErr } = await supabase.from("assignment_answer_keys").insert({
          assignment_id: inserted!.id, teacher_id: user.id, answer_key: JSON.stringify(answerKey),
        });
        if (keyErr) throw keyErr;
        sentAssignment = questionsPublic.length;
      }

      return { savedBank, sentAssignment, edited: false };
    },
    onSuccess: ({ savedBank, sentAssignment, edited }) => {
      if (edited) {
        toast.success(lang === "id" ? "Soal diperbarui ✨" : "Question updated ✨");
      } else {
        const parts: string[] = [];
        if (savedBank) parts.push(lang === "id" ? `${savedBank} soal ke Bank Soal` : `${savedBank} to Bank`);
        if (sentAssignment) parts.push(lang === "id" ? `${sentAssignment} soal terkirim sebagai Tugas/Kuis` : `${sentAssignment} sent as assignment`);
        toast.success((parts.join(" · ") || (lang === "id" ? "Tersimpan" : "Saved")) + " ✨");
      }
      setOpen(false); resetForm(); setShowPreview(false);
      qc.invalidateQueries({ queryKey: ["qb"] });
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
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

  // Available grade levels for the filter dropdown.
  const gradeOptions = Array.from(new Set((items as any[]).map((q) => q.grade_level).filter(Boolean))) as string[];
  // Map a stored row to its UI BType for filtering.
  const rowUiType = (q: any): BType => (q.halaqoh_kind ? (HALAQOH_KIND[q.halaqoh_kind] ?? "halaqoh_setoran") : (q.type as BType));
  const filteredItems = (items as any[]).filter((q) => {
    if (filterGrade !== "all" && q.grade_level !== filterGrade) return false;
    if (filterType !== "all" && rowUiType(q) !== filterType) return false;
    if (search.trim()) {
      const hay = `${q.question ?? ""} ${q.subject ?? ""} ${q.topic ?? ""} ${q.grade_level ?? ""}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <DashboardShell accent="guru">
      <QuizTabs active="bank" />

      <PageHeader title={t("navQuestionBank")} subtitle={lang === "id" ? `Buat soal sekali (maks ${MAX_QUESTIONS}, campur tipe), lalu simpan ke Bank atau kirim sebagai Tugas/Kuis` : `Build questions once (max ${MAX_QUESTIONS}, mixed types), then save to Bank or send as a quiz`}
        actions={
          <div className="flex flex-wrap gap-2">
            {selected.length > 0 && (
              <Button variant="quest" onClick={() => setTransferOpen(true)}>
                <Send className="size-4" /> {lang === "id" ? `Kirim ke Tugas (${selected.length})` : `Send to Tugas (${selected.length})`}
              </Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm(); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Buat Soal" : "Create Questions"}</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{lang === "id" ? "Buat Soal (Bank Soal / Tugas / Kuis)" : "Create Questions (Bank / Assignment / Quiz)"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{t("subject")}</Label><SubjectSelect value={subject} onChange={setSubject} /></div>
                    <div>
                      <Label>{lang === "id" ? "Untuk Kelas / Jenjang" : "Target Class / Grade"}</Label>
                      <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder={lang === "id" ? "mis. Kelas 7, SMP, Halaqoh A" : "e.g. Grade 7"} />
                    </div>
                  </div>

                  {/* Destination: one form, choose where the questions go */}
                  <div className="rounded-xl border-2 border-border bg-muted/20 p-3">
                    <Label className="text-sm font-bold">{lang === "id" ? "Tujuan Soal" : "Destination"}</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        ["bank", lang === "id" ? "Simpan ke Bank Soal" : "Save to Bank"],
                        ["assignment", lang === "id" ? "Kirim sbg Tugas/Kuis" : "Send as Quiz"],
                        ["both", lang === "id" ? "Bank + Kirim" : "Bank + Send"],
                      ] as [typeof destination, string][]).map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setDestination(val)}
                          className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold transition ${destination === val ? "border-guru bg-guru/10 text-guru" : "border-border text-muted-foreground hover:text-foreground"}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {sendAssignment && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        <div>
                          <Label className="text-xs">{lang === "id" ? "Judul Tugas/Kuis" : "Title"} <span className="text-destructive">*</span></Label>
                          <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder={lang === "id" ? "mis. Ulangan Tajwid Bab 1" : "e.g. Tajwid Test Ch.1"} />
                        </div>
                        <div>
                          <Label className="text-xs">{lang === "id" ? "Tujuan Pengiriman" : "Send To"}</Label>
                          <div className="mt-1 flex gap-2">
                            {(["class", "student"] as const).map((tg) => (
                              <button key={tg} type="button" onClick={() => setATarget(tg)}
                                className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${aTarget === tg ? "border-quest bg-quest/10 text-quest" : "border-border"}`}>
                                {tg === "class" ? (lang === "id" ? "Satu Kelas" : "Whole Class") : (lang === "id" ? "Siswa Tertentu" : "Specific Student")}
                              </button>
                            ))}
                          </div>
                        </div>
                        {aTarget === "class" ? (
                          <div>
                            <Label className="text-xs">{lang === "id" ? "Kelas" : "Class"} <span className="text-destructive">*</span></Label>
                            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={aClassId} onChange={(e) => setAClassId(e.target.value)}>
                              <option value="">{lang === "id" ? "— pilih kelas —" : "— select class —"}</option>
                              {(classes as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <Label className="text-xs">{lang === "id" ? "Siswa" : "Student"} <span className="text-destructive">*</span></Label>
                            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={aStudentId} onChange={(e) => setAStudentId(e.target.value)}>
                              <option value="">{lang === "id" ? "— pilih siswa —" : "— select student —"}</option>
                              {(students as any[]).map((s) => <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div className="sm:col-span-1"><Label className="text-xs">{lang === "id" ? "Tenggat" : "Due"}</Label><Input type="datetime-local" value={aDueAt} onChange={(e) => setADueAt(e.target.value)} /></div>
                          <div><Label className="text-xs">{lang === "id" ? "Nilai" : "Score"}</Label><Input type="number" min={1} value={aMaxScore} onChange={(e) => setAMaxScore(Number(e.target.value))} /></div>
                          <div><Label className="text-xs">XP</Label><Input type="number" min={0} value={aXp} onChange={(e) => setAXp(Number(e.target.value))} /></div>
                          <div><Label className="text-xs">{lang === "id" ? "Koin" : "Coins"}</Label><Input type="number" min={0} value={aCoin} onChange={(e) => setACoin(Number(e.target.value))} /></div>
                        </div>
                      </div>
                    )}
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

                  {/* Live validation summary + preview */}
                  <div className={`rounded-xl border-2 p-3 text-sm ${allErrors.length ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold">
                        {allErrors.length
                          ? (lang === "id" ? `⚠️ ${allErrors.length} hal perlu diperbaiki` : `⚠️ ${allErrors.length} issue(s)`)
                          : (lang === "id" ? `✅ ${questions.length}/${MAX_QUESTIONS} soal siap` : `✅ ${questions.length}/${MAX_QUESTIONS} ready`)}
                      </span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}>
                        {showPreview ? (lang === "id" ? "Tutup Pratinjau" : "Hide Preview") : (lang === "id" ? "Pratinjau" : "Preview")}
                      </Button>
                    </div>
                    {allErrors.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-destructive">
                        {allErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                    {showPreview && allErrors.length === 0 && (
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                        {questions.map((q, i) => (
                          <li key={i}>
                            <span className="font-semibold text-foreground">{TYPE_LABEL(q.type, lang)}</span>
                            {" · "}
                            {isHalaqohType(q.type)
                              ? `${q.surah.trim() || (lang === "id" ? "(tanpa surah)" : "(no surah)")}${q.target.trim() ? ` — ${q.target.trim()}` : ""}${q.setoranKind ? ` · ${setoranLabel(q.setoranKind, lang)}` : ""}`
                              : (q.question.trim().slice(0, 60) || (lang === "id" ? "(kosong)" : "(empty)"))}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button variant="guru" disabled={createMut.isPending || allErrors.length > 0} onClick={() => createMut.mutate()}>{createMut.isPending ? (lang === "id" ? "Menyimpan…" : "Saving…") : (destination === "bank" ? (lang === "id" ? "Simpan ke Bank" : "Save to Bank") : destination === "assignment" ? (lang === "id" ? "Kirim Tugas/Kuis" : "Send Quiz") : (lang === "id" ? "Simpan & Kirim" : "Save & Send"))}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } />

      {items.length === 0 ? <EmptyState message={t("empty")} /> : (
        <>
          {/* Filter & search */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "id" ? "Cari soal, topik, surah…" : "Search questions…"}
              className="h-9 w-full sm:w-64"
            />
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="h-9 w-auto min-w-[9rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "id" ? "Semua jenjang/kelas" : "All grades"}</SelectItem>
                {gradeOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-auto min-w-[9rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "id" ? "Semua tipe soal" : "All types"}</SelectItem>
                {ALL_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{TYPE_LABEL(tp, lang)}</SelectItem>)}
              </SelectContent>
            </Select>
            {(search || filterGrade !== "all" || filterType !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setFilterGrade("all"); setFilterType("all"); }}>
                <X className="size-4" /> {lang === "id" ? "Reset" : "Reset"}
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{filteredItems.length}/{items.length}</span>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState message={lang === "id" ? "Tidak ada soal yang cocok dengan filter." : "No questions match the filters."} />
          ) : (
          <div className="space-y-3">
          {filteredItems.map((q: any) => {
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
        </>
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
// Halaqoh metadata is preserved on the question so grading can auto-record to Mutaba'ah.
function mapBankToQuiz(b: any): { question: any; key: any } {
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

function TransferDialog({ open, onOpenChange, items, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; items: any[]; onDone: () => void }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [target, setTarget] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (open) {
      setTarget("class");
      setTitle("");
      setClassId("");
      setStudentId("");
      setSubject(items.find((i) => i.subject)?.subject ?? "");
      setGradeLevel(items.find((i) => i.grade_level)?.grade_level ?? "");
      setDueAt("");
    }
  }, [open, items]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user && open,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-list-transfer", user?.id], enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_students");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!title.trim()) throw new Error(lang === "id" ? "Judul wajib diisi" : "Title required");
      if (target === "class" && !classId) throw new Error(lang === "id" ? "Pilih kelas tujuan" : "Select a class");
      if (target === "student" && !studentId) throw new Error(lang === "id" ? "Pilih siswa tujuan" : "Select a student");
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
          teacher_id: user.id,
          class_id: target === "class" ? classId : null,
          assigned_student_id: target === "student" ? studentId : null,
          title: title.trim(),
          subject: subject || null, exam_type: "harian",
          description: gradeLevel ? (lang === "id" ? `Jenjang: ${gradeLevel}` : `Grade: ${gradeLevel}`) : null,
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
      qc.invalidateQueries({ queryKey: ["assignments"] });
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
              <Label>{lang === "id" ? "Mata Pelajaran" : "Subject"}</Label>
              <SubjectSelect value={subject} onChange={setSubject} />
            </div>
            <div>
              <Label>{lang === "id" ? "Jenjang / Kelas" : "Grade"}</Label>
              <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder={lang === "id" ? "mis. Kelas 7" : "e.g. Grade 7"} />
            </div>
          </div>

          <div>
            <Label>{lang === "id" ? "Tujuan" : "Target"}</Label>
            <div className="mt-1 flex gap-2">
              {(["class", "student"] as const).map((tg) => (
                <button key={tg} type="button" onClick={() => setTarget(tg)}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${target === tg ? "border-quest bg-quest/10 text-quest" : "border-border"}`}>
                  {tg === "class" ? (lang === "id" ? "Satu Kelas" : "Whole Class") : (lang === "id" ? "Siswa Tertentu" : "Specific Student")}
                </button>
              ))}
            </div>
          </div>

          {target === "class" ? (
            <div>
              <Label>{lang === "id" ? "Kelas" : "Class"} <span className="text-destructive">*</span></Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">{lang === "id" ? "— pilih kelas —" : "— select class —"}</option>
                {(classes as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <Label>{lang === "id" ? "Siswa" : "Student"} <span className="text-destructive">*</span></Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">{lang === "id" ? "— pilih siswa —" : "— select student —"}</option>
                {(students as any[]).map((s) => <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label>{lang === "id" ? "Jadwal / Tenggat (opsional)" : "Schedule / Due (optional)"}</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
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
