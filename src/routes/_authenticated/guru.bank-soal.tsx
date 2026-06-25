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
  QuestionEditorList, EXAM_CATEGORIES, examCategoryLabel, normalizeHalaqohKind,
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
  const [examCategory, setExamCategory] = useState("harian");
  const [questions, setQuestions] = useState<BQ[]>([emptyQ()]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["qb", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("question_bank").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const resetForm = () => {
    setEditId(null);
    setSubject(""); setGradeLevel(""); setQuestions([emptyQ()]);
  };

  // Open the form pre-filled to edit an existing bank question (single row).
  const openEdit = (row: any) => {
    setEditId(row.id);
    setSubject(row.subject ?? "");
    setGradeLevel(row.grade_level ?? "");
    setQuestions([bankRowToBQ(row)]);
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
  const allErrors = validation.errors;

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      const { rows, errors } = buildBankRows(questions, subject, gradeLevel, user.id, lang);
      if (errors.length) {
        throw new Error(
          (lang === "id" ? "Periksa kembali soal:\n" : "Please fix:\n") + errors.map((e) => `• ${e}`).join("\n"),
        );
      }

      // Edit mode: update the single existing bank row (never touches assignments/submissions).
      if (editId) {
        const { error } = await supabase.from("question_bank").update(rows[0] as any).eq("id", editId);
        if (error) throw error;
        return { savedBank: 1, edited: true };
      }

      const { error } = await supabase.from("question_bank").insert(rows as any);
      if (error) throw error;
      return { savedBank: rows.length, edited: false };
    },
    onSuccess: ({ savedBank, edited }) => {
      toast.success(edited
        ? (lang === "id" ? "Soal diperbarui ✨" : "Question updated ✨")
        : ((lang === "id" ? `${savedBank} soal disimpan ke Bank Soal` : `${savedBank} questions saved to Bank`) + " ✨"));
      setOpen(false); resetForm(); setShowPreview(false);
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

  // ALL_TYPES imported from question-fields.

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

      <PageHeader title={t("navQuestionBank")} subtitle={lang === "id" ? `Perpustakaan soal (maks ${MAX_QUESTIONS}, campur tipe). Simpan di sini, lalu impor ke Tugas saat akan dikirim ke siswa.` : `Question library (max ${MAX_QUESTIONS}, mixed types). Store here, then import into a Task when ready to send.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {selected.length > 0 && (
              <Button variant="quest" onClick={() => setTransferOpen(true)}>
                <Send className="size-4" /> {lang === "id" ? `Impor ke Tugas Baru (${selected.length})` : `Import into New Task (${selected.length})`}
              </Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button variant="guru" onClick={() => resetForm()}><Plus className="size-4" /> {lang === "id" ? "Buat Soal" : "Create Questions"}</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? (lang === "id" ? "Edit Soal" : "Edit Question") : (lang === "id" ? "Buat Soal untuk Bank Soal" : "Create Bank Questions")}</DialogTitle></DialogHeader>

                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{t("subject")}</Label><SubjectSelect value={subject} onChange={setSubject} /></div>
                    <div>
                      <Label>{lang === "id" ? "Untuk Kelas / Jenjang" : "Target Class / Grade"}</Label>
                      <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder={lang === "id" ? "mis. Kelas 7, SMP, Halaqoh A" : "e.g. Grade 7"} />
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {lang === "id"
                      ? "💡 Bank Soal adalah perpustakaan soal. Setelah disimpan, pilih soal dari daftar lalu klik \"Impor ke Tugas Baru\" untuk mengirimnya ke kelas/siswa sebagai Tugas/Kuis."
                      : "💡 The Question Bank is a library. After saving, select questions from the list and click \"Import into New Task\" to send them to a class/student."}
                  </div>


                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Label className="text-base font-bold">{lang === "id" ? "Daftar Soal" : "Questions"} <span className="font-normal text-muted-foreground">({questions.length}/{MAX_QUESTIONS})</span></Label>
                    {!editId && (
                    <Select value="" onValueChange={(v) => addQuestion(v as BType)}>
                      <SelectTrigger className="h-9 w-auto gap-1"><Plus className="size-4" /><span className="text-sm">{lang === "id" ? "Tambah Soal" : "Add"}</span></SelectTrigger>
                      <SelectContent>
                        {ALL_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{TYPE_LABEL(tp, lang)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    )}
                  </div>


                  <QuestionEditorList
                    questions={questions}
                    setQuestions={setQuestions}
                    uploadImage={uploadImage}
                    uploadingIdx={uploadingIdx}
                  />


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
                  <Button variant="guru" disabled={createMut.isPending || allErrors.length > 0} onClick={() => createMut.mutate()}>{createMut.isPending ? (lang === "id" ? "Menyimpan…" : "Saving…") : editId ? (lang === "id" ? "Simpan Perubahan" : "Save Changes") : (lang === "id" ? "Simpan ke Bank Soal" : "Save to Bank")}</Button>
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(q)} title={lang === "id" ? "Edit" : "Edit"}><Pencil className="size-4 text-guru" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(q.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>

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
        <DialogHeader><DialogTitle>{lang === "id" ? "Impor ke Tugas Baru" : "Import into New Task"}</DialogTitle></DialogHeader>
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
