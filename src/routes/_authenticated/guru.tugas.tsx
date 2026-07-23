import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, Plus, Trash2, ChevronRight, X, Play, KeyRound, Send, Search, Pencil, Copy, CheckCircle2, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { LinkFields, LinkBadges } from "@/components/link-fields";
import { MediaInput, MediaViewer, type MediaValue } from "@/components/media-input";
import { SubjectSelect } from "@/components/subject-select";
import { ExportMenu } from "@/components/export-menu";
import { ANSWER_FORMATS, JUZ_LIST, SURAHS, type AnswerFormat } from "@/lib/quran-data";
import { isHalaqohSubject, SETORAN_TYPES } from "@/lib/mutabaah";
import { QuizTabs } from "@/components/quiz-tabs";
import { QuizGradeDialog } from "@/components/quiz-grade-dialog";
import { signAnswerFile } from "@/lib/transcribe.functions";

export const Route = createFileRoute("/_authenticated/guru/tugas")({
  head: () => ({ meta: [{ title: "Tugas · Pelajaranku" }] }),
  component: GuruTugasPage,
});



type TForm = {
  class_id: string; assigned_student_id: string; title: string; description: string;
  subject: string; exam_type: string; halaqoh_kind: string;
  due_at: string; max_score: number; xp_reward: number; coin_reward: number;
  quiz_link: string; game_link: string;
  answer_format: AnswerFormat; options: string[]; answer_key: string;
  muroja_juz: string; muroja_surah: string; muroja_ayat: string;
};

const emptyForm = (): TForm => ({
  class_id: "", assigned_student_id: "", title: "", description: "", subject: "", exam_type: "harian", halaqoh_kind: "", due_at: "",
  max_score: 100, xp_reward: 50, coin_reward: 10, quiz_link: "", game_link: "",
  answer_format: "descriptive", options: ["", ""], answer_key: "",
  muroja_juz: "", muroja_surah: "", muroja_ayat: "",
});

const EXAM_TYPES = [
  { value: "harian", labelId: "Tugas Harian", labelEn: "Daily Task", emoji: "📚" },
  { value: "uts", labelId: "UTS (Tengah Semester)", labelEn: "Midterm", emoji: "📝" },
  { value: "uas", labelId: "UAS (Akhir Semester)", labelEn: "Final Exam", emoji: "🎓" },
];

function GuruTugasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<"class" | "student">("class");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<TForm>(emptyForm());

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_students");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments").select("*, classes(name), assignee:profiles!assignments_assigned_student_id_fkey(full_name), submissions(id, status, score, student_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.title) throw new Error(t("required"));
      if (target === "class" && !form.class_id) throw new Error(t("selectClass"));
      if (target === "student" && !form.assigned_student_id) throw new Error(t("selectStudent"));
      const cleanOptions = form.options.map((o) => o.trim()).filter(Boolean);
      const isMC = form.answer_format === "multiple_choice" || form.answer_format === "complex_mc";
      if (isMC && cleanOptions.length < 2)
        throw new Error(lang === "id" ? "Minimal 2 pilihan jawaban" : "At least 2 options");
      if (form.answer_format === "muroja" && !form.muroja_surah)
        throw new Error(lang === "id" ? "Pilih surah untuk muroja'ah" : "Select a surah");

      const { data: inserted, error } = await supabase.from("assignments").insert({
        teacher_id: user.id,
        class_id: target === "class" ? form.class_id : null,
        assigned_student_id: target === "student" ? form.assigned_student_id : null,
        title: form.title,
        subject: form.subject || null,
        exam_type: form.exam_type,
        halaqoh_kind: isHalaqohSubject(form.subject) && form.halaqoh_kind ? form.halaqoh_kind : null,
        description: form.description || null, due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        max_score: form.max_score, xp_reward: form.xp_reward, coin_reward: form.coin_reward,
        quiz_link: form.quiz_link.trim() || null, game_link: form.game_link.trim() || null,
        answer_format: form.answer_format,
        options: isMC ? cleanOptions : null,
        muroja_juz: form.answer_format === "muroja" ? form.muroja_juz || null : null,
        muroja_surah: form.answer_format === "muroja" ? form.muroja_surah || null : null,
        muroja_ayat: form.answer_format === "muroja" ? form.muroja_ayat.trim() || null : null,
      }).select("id").single();
      if (error) throw error;

      // Answer key is stored separately so students can never read it.
      if (inserted && form.answer_key.trim()) {
        const { error: keyErr } = await supabase.from("assignment_answer_keys").insert({
          assignment_id: inserted.id, teacher_id: user.id, answer_key: form.answer_key.trim(),
        });
        if (keyErr) throw keyErr;
      }
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Tugas dibuat" : "Assignment created");
      setOpen(false);
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Tugas dihapus" : "Deleted"); qc.invalidateQueries({ queryKey: ["assignments"] }); },
  });

  const currentAssignment = useMemo(() => assignments.find((a: any) => a.id === selected), [assignments, selected]);

  // Group submissions by CLASS, then by SUBJECT, so the grading hub is tidy
  // ("per kelas kemudian per Mapel"). Each class is a collapsible section.
  const groupedByClass = useMemo(() => {
    const classMap: Record<string, { className: string; subjects: Record<string, any[]> }> = {};
    (assignments as any[]).forEach((a) => {
      const className = a.assigned_student_id
        ? (lang === "id" ? "Tugas Personal" : "Personal Tasks")
        : (a.classes?.name ?? (lang === "id" ? "Tanpa Kelas" : "No Class"));
      const subject = a.subject || (lang === "id" ? "Umum" : "General");
      (classMap[className] ??= { className, subjects: {} });
      (classMap[className].subjects[subject] ??= []).push(a);
    });
    return Object.values(classMap)
      .sort((a, b) => a.className.localeCompare(b.className))
      .map((c) => ({
        className: c.className,
        items: Object.values(c.subjects).flat(),
        subjects: Object.entries(c.subjects)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subject, items]) => ({ subject, items })),
      }));
  }, [assignments, lang]);


  const exportColumns = [
    { key: "title", header: lang === "id" ? "Judul" : "Title" },
    { key: "format", header: lang === "id" ? "Format Jawaban" : "Answer Format" },
    { key: "target", header: lang === "id" ? "Sasaran" : "Target" },
    { key: "due", header: lang === "id" ? "Tenggat" : "Due" },
    { key: "max_score", header: lang === "id" ? "Nilai Maks" : "Max Score" },
    { key: "xp", header: "XP" },
    { key: "submissions", header: lang === "id" ? "Pengumpulan" : "Submissions" },
  ];
  const exportRows = () => assignments.map((a: any) => ({
    title: a.title,
    format: ANSWER_FORMATS.find((f) => f.value === a.answer_format)?.[lang === "id" ? "labelId" : "labelEn"] ?? a.answer_format,
    target: a.assigned_student_id ? (a.assignee?.full_name ?? "Personal") : a.classes?.name ?? "—",
    due: a.due_at ? format(new Date(a.due_at), "dd MMM yyyy HH:mm") : "—",
    max_score: a.max_score, xp: a.xp_reward, submissions: (a.submissions ?? []).length,
  }));

  return (
    <DashboardShell accent="guru">
      <QuizTabs active="tugas" />
      <PageHeader
        title={t("navAssignments")}
        subtitle={lang === "id" ? "Buat tugas, kuis, & nilai pengumpulan siswa (koreksi otomatis + audio)" : "Create tasks, quizzes & grade submissions (auto-scoring + audio)"}
        actions={
          <div className="flex flex-wrap gap-2">
            {assignments.length > 0 && (
              <ExportMenu filename="tugas" title={lang === "id" ? "Daftar Tugas" : "Assignments"} columns={exportColumns} rows={exportRows} />
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newAssignment")}</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("newAssignment")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>{t("assignTarget")}</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Button type="button" variant={target === "class" ? "guru" : "outline"} className="w-full" onClick={() => setTarget("class")}>{t("targetClass")}</Button>
                      <Button type="button" variant={target === "student" ? "guru" : "outline"} className="w-full" onClick={() => setTarget("student")}>{t("targetStudent")}</Button>
                    </div>
                  </div>
                  {target === "class" ? (
                    <div>
                      <Label>{t("navClasses")}</Label>
                      <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                        <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>{t("navStudents")}</Label>
                      <Select value={form.assigned_student_id} onValueChange={(v) => setForm({ ...form, assigned_student_id: v })}>
                        <SelectTrigger><SelectValue placeholder={t("selectStudent")} /></SelectTrigger>
                        <SelectContent>
                          {students.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}{s.class_name ? ` · ${s.class_name}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div><Label>{t("title")} <span className="text-destructive">*</span></Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>{t("subject")}</Label><SubjectSelect value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} /></div>
                  <div>
                    <Label>{lang === "id" ? "Jenis Penilaian" : "Assessment Type"}</Label>
                    <Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXAM_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.emoji} {lang === "id" ? e.labelId : e.labelEn}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Menentukan bobot pada rekap nilai (Harian 20%, UTS 20%, UAS 30%)." : "Sets the weight in the grade recap."}</p>
                  </div>
                  {isHalaqohSubject(form.subject) && (
                    <div className="rounded-xl border-2 border-guru/30 bg-guru/5 p-3">
                      <Label>{lang === "id" ? "Jenis Halaqoh (otomatis ke Mutaba'ah)" : "Halaqoh Kind (auto to Mutaba'ah)"}</Label>
                      <Select value={form.halaqoh_kind} onValueChange={(v) => setForm({ ...form, halaqoh_kind: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder={lang === "id" ? "Pilih jenis setoran" : "Select setoran kind"} /></SelectTrigger>
                        <SelectContent>
                          {SETORAN_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{lang === "id" ? s.id : s.en}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Nilai tugas Halaqoh yang sudah dikoreksi otomatis masuk akumulasi Mutaba'ah (Ziyadah 30% · Muroja'ah 40% · Tilawah 30%)." : "Graded Halaqoh task scores auto-feed the Mutaba'ah accumulation."}</p>
                    </div>
                  )}
                  <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

                  {/* Answer format selector */}
                  <div>
                    <Label>{lang === "id" ? "Format Jawaban Siswa" : "Student Answer Format"}</Label>
                    <Select value={form.answer_format} onValueChange={(v) => setForm({ ...form, answer_format: v as AnswerFormat })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANSWER_FORMATS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.emoji} {lang === "id" ? f.labelId : f.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Multiple choice options */}
                  {(form.answer_format === "multiple_choice" || form.answer_format === "complex_mc") && (
                    <div className="rounded-xl border-2 border-dashed border-guru/40 p-3 space-y-2">
                      <Label className="flex items-center gap-1.5">
                        {form.answer_format === "complex_mc" ? "🔢" : "🔘"} {lang === "id" ? "Pilihan Jawaban" : "Answer Options"}
                        {form.answer_format === "complex_mc" && <span className="text-xs font-normal text-muted-foreground">({lang === "id" ? "boleh >1 jawaban benar" : "multiple correct allowed"})</span>}
                      </Label>
                      {form.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-guru">{String.fromCharCode(65 + i)}.</span>
                          <Input value={opt} onChange={(e) => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }} placeholder={lang === "id" ? `Pilihan ${i + 1}` : `Option ${i + 1}`} />
                          {form.options.length > 2 && (
                            <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) })}><X className="size-4 text-destructive" /></Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, ""] })}><Plus className="size-4" /> {lang === "id" ? "Tambah pilihan" : "Add option"}</Button>
                    </div>
                  )}

                  {/* Muroja'ah Al-Qur'an */}
                  {form.answer_format === "muroja" && (
                    <div className="rounded-xl border-2 border-dashed border-guru/40 p-3 space-y-2">
                      <Label className="flex items-center gap-1.5">📖 {lang === "id" ? "Misi Muroja'ah Hafalan" : "Memorization Mission"}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Juz</Label>
                          <Select value={form.muroja_juz} onValueChange={(v) => setForm({ ...form, muroja_juz: v })}>
                            <SelectTrigger><SelectValue placeholder="Juz" /></SelectTrigger>
                            <SelectContent>{JUZ_LIST.map((j) => <SelectItem key={j} value={String(j)}>Juz {j}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Surah</Label>
                          <Select value={form.muroja_surah} onValueChange={(v) => setForm({ ...form, muroja_surah: v })}>
                            <SelectTrigger><SelectValue placeholder="Surah" /></SelectTrigger>
                            <SelectContent className="max-h-64">
                              {SURAHS.map((s) => <SelectItem key={s.number} value={s.name}>{s.number}. {s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">{lang === "id" ? "Ayat (mis. 1-10)" : "Verses (e.g. 1-10)"}</Label>
                        <Input value={form.muroja_ayat} onChange={(e) => setForm({ ...form, muroja_ayat: e.target.value })} placeholder={lang === "id" ? "Contoh: 1-10" : "e.g. 1-10"} />
                      </div>
                    </div>
                  )}

                  {/* Answer key — hidden from students */}
                  <div>
                    <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5 text-guru" /> {lang === "id" ? "Kunci Jawaban (rahasia)" : "Answer Key (secret)"}</Label>
                    {form.answer_format === "multiple_choice" ? (
                      <Select value={form.answer_key} onValueChange={(v) => setForm({ ...form, answer_key: v })}>
                        <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih jawaban benar" : "Select correct answer"} /></SelectTrigger>
                        <SelectContent>
                          {form.options.map((o) => o.trim()).filter(Boolean).map((o, i) => <SelectItem key={i} value={o}>{String.fromCharCode(65 + i)}. {o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : form.answer_format === "complex_mc" ? (
                      <div className="space-y-1.5">
                        {form.options.map((o) => o.trim()).filter(Boolean).map((o, i) => {
                          const keys = form.answer_key.split(", ").filter(Boolean);
                          const checked = keys.includes(o);
                          return (
                            <button
                              type="button"
                              key={i}
                              onClick={() => { const next = checked ? keys.filter((k) => k !== o) : [...keys, o]; setForm({ ...form, answer_key: next.join(", ") }); }}
                              className={`flex w-full items-center gap-2 rounded-lg border-2 p-2 text-left text-sm transition-colors ${checked ? "border-guru bg-guru/10" : "border-border hover:border-guru/40"}`}
                            >
                              <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${checked ? "border-guru bg-guru text-white" : "border-border text-transparent"}`}>✓</span>
                              {String.fromCharCode(65 + i)}. {o}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Textarea value={form.answer_key} onChange={(e) => setForm({ ...form, answer_key: e.target.value })} placeholder={lang === "id" ? "Hanya guru yang dapat melihat ini" : "Only teachers can see this"} />
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">🔒 {lang === "id" ? "Kunci jawaban tidak terlihat oleh siswa." : "The answer key is never visible to students."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("deadline")}</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
                    <div><Label>{t("maxScore")}</Label><Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: +e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("xpReward")}</Label><Input type="number" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: +e.target.value })} /></div>
                    <div><Label>{t("coinReward")}</Label><Input type="number" value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: +e.target.value })} /></div>
                  </div>
                  <LinkFields quizLink={form.quiz_link} gameLink={form.game_link} onQuiz={(v) => setForm({ ...form, quiz_link: v })} onGame={(v) => setForm({ ...form, game_link: v })} />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}><Send className="size-4" /> {t("saveShare")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {assignments.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-3">
            {groupedByClass.map(({ className, items, subjects }) => {
              const groupPending = items.reduce((n: number, a: any) => n + (a.submissions ?? []).filter((s: any) => s.status === "submitted").length, 0);
              const isOpen = openGroups[className] ?? true;
              return (
                <div key={className} className="rounded-2xl border-2 border-border bg-card shadow-soft">
                  <button
                    onClick={() => setOpenGroups((g) => ({ ...g, [className]: !isOpen }))}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left hover:bg-muted/40"
                  >
                    <span className="font-display font-bold">🏫 {className}</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display font-bold">{items.length}</span>
                      {groupPending > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-display font-bold text-destructive">{groupPending}</span>}
                      <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t-2 border-border p-2">
                      {subjects.map(({ subject, items: subItems }) => (
                        <div key={subject} className="space-y-2">
                          <div className="px-1 text-xs font-display font-bold uppercase tracking-wide text-muted-foreground">📚 {subject}</div>
                          {subItems.map((a: any) => {
                            const pending = (a.submissions ?? []).filter((s: any) => s.status === "submitted").length;
                            return (
                              <button key={a.id} onClick={() => setSelected(a.id)} className={`w-full text-left rounded-xl border-2 p-3 transition ${selected === a.id ? "border-guru bg-guru/10" : "border-border bg-card hover:border-guru/50"}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold truncate">{a.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {a.assigned_student_id ? (a.assignee?.full_name ?? t("personalTask")) : a.classes?.name} · {a.due_at ? format(new Date(a.due_at), "dd MMM") : "—"}
                                    </div>
                                  </div>
                                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  <span className="rounded-full bg-xp/15 px-2 py-0.5 font-display font-bold text-xp">+{a.xp_reward} XP</span>
                                  {a.exam_type && a.exam_type !== "harian" && <span className="rounded-full bg-guru/15 px-2 py-0.5 font-display font-bold uppercase text-guru">{a.exam_type}</span>}
                                  {a.halaqoh_kind && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-display font-bold text-emerald-700">🕌 {a.halaqoh_kind}</span>}
                                  {pending > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-display font-bold text-destructive">{pending} {lang === "id" ? "perlu nilai" : "to grade"}</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          <div className="lg:col-span-2">
            {currentAssignment ? (
              <AssignmentDetail assignment={currentAssignment} onDelete={() => { if (confirm(`${t("delete")}?`)) { deleteMut.mutate(currentAssignment.id); setSelected(null); } }} onEdited={() => qc.invalidateQueries({ queryKey: ["assignments"] })} />
            ) : (
              <EmptyState message={lang === "id" ? "Pilih tugas untuk melihat pengumpulan" : "Select an assignment to view submissions"} />
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function AssignmentDetail({ assignment, onDelete, onEdited }: { assignment: any; onDelete: () => void; onEdited: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const fmtLabel = ANSWER_FORMATS.find((f) => f.value === assignment.answer_format);
  const isQuiz = assignment.answer_format === "quiz";
  const [grading, setGrading] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "graded">("all");
  const [editOpen, setEditOpen] = useState(false);

  const { data: answerKey } = useQuery({
    queryKey: ["answer-key", assignment.id],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_answer_keys").select("answer_key").eq("assignment_id", assignment.id).maybeSingle();
      return data?.answer_key ?? null;
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["submissions", assignment.id],
    queryFn: async () => {
      const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id);
      const ids = (data ?? []).map((s: any) => s.student_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (data ?? []).map((s: any) => ({ ...s, profile: (profs ?? []).find((p: any) => p.id === s.student_id) }));
    },
  });

  // Roster of students expected to submit, so we can flag who missed the deadline.
  const { data: roster = [] } = useQuery({
    queryKey: ["assignment-roster", assignment.id, assignment.class_id, assignment.assigned_student_id],
    queryFn: async () => {
      if (assignment.assigned_student_id) {
        const { data } = await supabase.from("profiles").select("id, full_name").eq("id", assignment.assigned_student_id);
        return data ?? [];
      }
      if (!assignment.class_id) return [];
      const { data: en } = await supabase.from("class_enrollments").select("student_id").eq("class_id", assignment.class_id);
      const ids = (en ?? []).map((r: any) => r.student_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return profs ?? [];
    },
  });

  const pastDue = !!assignment.due_at && new Date(assignment.due_at) < new Date();
  const submittedIds = new Set((subs as any[]).map((s) => s.student_id));
  const missed = pastDue
    ? (roster as any[]).filter((r) => !submittedIds.has(r.id)).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
    : [];

  // Filter submissions for the grading toolbar (by student name + status).
  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (subs as any[]).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q && !(s.profile?.full_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subs, search, statusFilter]);
  const pendingCount = (subs as any[]).filter((s) => s.status === "submitted").length;
  const gradedCount = (subs as any[]).filter((s) => s.status === "graded").length;

  const gradeMut = useMutation({
    mutationFn: async ({ id, score, feedback, feedback_media_type, feedback_media_url }: { id: string; score: number; feedback: string; feedback_media_type: string | null; feedback_media_url: string | null }) => {
      const { error } = await supabase.from("submissions").update({ status: "graded", score, feedback, feedback_media_type, feedback_media_url }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "id" ? "Nilai disimpan ✅" : "Grade saved ✅"); qc.invalidateQueries({ queryKey: ["submissions", assignment.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Duplicate this assignment (with all metadata + optional answer key) so the
  // teacher can quickly craft a similar tugas and edit only what changed.
  const dupMut = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData.user?.id;
      if (!teacherId) throw new Error("no user");
      const src = assignment;
      const copyTitle = `${src.title ?? "Tugas"} (${lang === "id" ? "Salinan" : "Copy"})`;
      const payload: any = {
        teacher_id: teacherId,
        class_id: src.class_id ?? null,
        assigned_student_id: src.assigned_student_id ?? null,
        title: copyTitle,
        description: src.description ?? null,
        subject: src.subject ?? null,
        exam_type: src.exam_type ?? "harian",
        halaqoh_kind: src.halaqoh_kind ?? null,
        due_at: null,
        max_score: src.max_score ?? 100,
        xp_reward: src.xp_reward ?? 50,
        coin_reward: src.coin_reward ?? 10,
        quiz_link: src.quiz_link ?? null,
        game_link: src.game_link ?? null,
        answer_format: src.answer_format ?? "descriptive",
        options: src.options ?? null,
        questions: src.questions ?? null,
        muroja_juz: src.muroja_juz ?? null,
        muroja_surah: src.muroja_surah ?? null,
        muroja_ayat: src.muroja_ayat ?? null,
      };
      const { data: created, error } = await supabase.from("assignments").insert(payload).select("id").single();
      if (error) throw error;
      if (answerKey && created?.id) {
        await supabase.from("assignment_answer_keys").insert({ assignment_id: created.id, teacher_id: teacherId, answer_key: answerKey });
      }
      return created.id as string;
    },
    onSuccess: (newId) => {
      toast.success(lang === "id" ? "Tugas diduplikasi. Silakan edit sesuai kebutuhan." : "Assignment duplicated. Edit as needed.");
      qc.invalidateQueries({ queryKey: ["assignments"] });
      // Jump straight to the copy so teacher can tweak & set new deadline.
      setTimeout(() => { window.location.hash = ""; }, 0);
      // Signal parent to focus new item — reuse `selected` via URL hash trick isn't possible from here,
      // so just invalidate & let user pick from list. Also open edit dialog on the source is not desired.
      void newId;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportColumns = [
    { key: "name", header: lang === "id" ? "Nama Siswa" : "Student" },
    { key: "status", header: "Status" },
    { key: "score", header: lang === "id" ? "Nilai" : "Score" },
    { key: "feedback", header: lang === "id" ? "Umpan Balik" : "Feedback" },
  ];
  const exportRows = () => subs.map((s: any) => ({
    name: s.profile?.full_name ?? "—",
    status: s.status === "graded" ? (lang === "id" ? "Dinilai" : "Graded") : (lang === "id" ? "Terkumpul" : "Submitted"),
    score: s.score != null ? `${s.score}/${assignment.max_score}` : "—",
    feedback: s.feedback ?? "",
  }));

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
      {/* Breadcrumb toolbar: Kelas › Mata Pelajaran › Tugas */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-display font-semibold text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5">🏫 {assignment.assigned_student_id ? (assignment.assignee?.full_name ?? (lang === "id" ? "Personal" : "Personal")) : (assignment.classes?.name ?? (lang === "id" ? "Tanpa Kelas" : "No Class"))}</span>
        <ChevronRight className="size-3" />
        <span className="rounded-full bg-muted px-2 py-0.5">📚 {assignment.subject || (lang === "id" ? "Umum" : "General")}</span>
        <ChevronRight className="size-3" />
        <span className="rounded-full bg-guru/15 px-2 py-0.5 text-guru">📝 {assignment.title}</span>
      </div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2"><ScrollText className="size-5 text-guru" />{assignment.title}</h2>
          {assignment.description && <p className="mt-1 text-sm text-muted-foreground">{assignment.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {fmtLabel && <span className="rounded-full bg-guru/10 px-2.5 py-0.5 text-xs font-display font-bold text-guru">{fmtLabel.emoji} {lang === "id" ? fmtLabel.labelId : fmtLabel.labelEn}</span>}
            {assignment.answer_format === "muroja" && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-display font-bold text-emerald-600">
                📖 {assignment.muroja_juz ? `Juz ${assignment.muroja_juz} · ` : ""}{assignment.muroja_surah}{assignment.muroja_ayat ? ` : ${assignment.muroja_ayat}` : ""}
              </span>
            )}
          </div>
          {Array.isArray(assignment.options) && assignment.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {assignment.options.map((o: string, i: number) => <span key={i} className="rounded-md bg-muted px-2 py-0.5">{String.fromCharCode(65 + i)}. {o}</span>)}
            </div>
          )}
          <LinkBadges quizLink={assignment.quiz_link} gameLink={assignment.game_link} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} title={lang === "id" ? "Edit" : "Edit"}><Pencil className="size-4 text-guru" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      {answerKey && !isQuiz && (
        <div className="mb-3 rounded-xl border border-guru/30 bg-guru/5 p-3 text-sm">
          <div className="flex items-center gap-1.5 font-display font-bold text-guru"><KeyRound className="size-4" /> {lang === "id" ? "Kunci Jawaban" : "Answer Key"} <span className="text-xs font-normal text-muted-foreground">🔒 {lang === "id" ? "rahasia guru" : "teacher only"}</span></div>
          <p className="mt-1 whitespace-pre-wrap text-foreground/80">{answerKey}</p>
        </div>
      )}

      {isQuiz && Array.isArray(assignment.questions) && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
          <div className="font-display font-bold text-accent">📝 {assignment.questions.length} {lang === "id" ? "soal · koreksi otomatis + audio" : "questions · auto-grade + audio"}</div>
          <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Soal objektif dinilai otomatis. Buka penilaian untuk mendengar & meninjau jawaban audio/gambar, lalu beri nilai tiap jawaban." : "Objective questions auto-scored. Open grading to listen to & review audio/image answers, then score each one."}</p>
        </div>
      )}

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h3 className="font-display font-bold text-sm">📋 {t("submissions")} ({subs.length})</h3>
        {subs.length > 0 && <ExportMenu filename={`penilaian-${assignment.title}`} title={`${lang === "id" ? "Penilaian" : "Grades"}: ${assignment.title}`} columns={exportColumns} rows={exportRows} />}
      </div>
      {subs.length === 0 ? <EmptyState message={t("empty")} /> : (
        <>
          {/* Mini toolbar: cari nama siswa + filter status */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === "id" ? "Cari nama siswa…" : "Search student…"} className="h-8 pl-8 text-sm" />
            </div>
            {([
              { v: "all", label: lang === "id" ? "Semua" : "All", n: subs.length },
              { v: "submitted", label: lang === "id" ? "Perlu nilai" : "To grade", n: pendingCount },
              { v: "graded", label: lang === "id" ? "Dinilai" : "Graded", n: gradedCount },
            ] as const).map((f) => (
              <button
                key={f.v}
                onClick={() => setStatusFilter(f.v)}
                className={`rounded-full border-2 px-2.5 py-1 text-xs font-display font-bold transition ${statusFilter === f.v ? "border-guru bg-guru/10 text-guru" : "border-border text-muted-foreground hover:border-guru/40"}`}
              >
                {f.label} ({f.n})
              </button>
            ))}
          </div>
          {filteredSubs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{lang === "id" ? "Tidak ada siswa yang cocok." : "No matching students."}</p>
          ) : isQuiz ? (
            <div className="space-y-1">
              {filteredSubs.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="truncate font-display font-semibold">👤 {s.profile?.full_name ?? "—"}</span>
                  <div className="flex items-center gap-2">
                    {s.status === "submitted" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700">{lang === "id" ? "perlu nilai" : "to grade"}</span>}
                    <span className="font-display font-bold text-primary">{s.score ?? 0}<span className="text-xs text-muted-foreground">/{assignment.max_score}</span></span>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setGrading(s)}>{lang === "id" ? "Nilai" : "Grade"}</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map((s: any) => <GradeRow key={s.id} sub={s} maxScore={assignment.max_score} isVoice={assignment.answer_format === "voice" || assignment.answer_format === "muroja"} onGrade={(score, fb, media) => gradeMut.mutate({ id: s.id, score, feedback: fb, feedback_media_type: media.media_type, feedback_media_url: media.media_url })} />)}
            </div>
          )}
        </>
      )}

      {missed.length > 0 && (
        <div className="mt-5 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-destructive">⛔ {lang === "id" ? "Tidak Mengerjakan (tenggat lewat)" : "Missed the Deadline"} ({missed.length})</h3>
            <span className="text-xs text-muted-foreground">{lang === "id" ? "Sudah tidak bisa mengumpulkan lagi." : "Can no longer submit."}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missed.map((m: any) => (
              <span key={m.id} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-display font-semibold text-destructive">
                👤 {m.full_name ?? "—"}
              </span>
            ))}
          </div>
        </div>
      )}
      {grading && (
        <QuizGradeDialog
          quiz={assignment}
          submission={grading}
          studentName={grading.profile?.full_name ?? "—"}
          invalidateKey={["assignments"]}
          onClose={() => { setGrading(null); qc.invalidateQueries({ queryKey: ["submissions", assignment.id] }); }}
        />
      )}
      {editOpen && (
        <AssignmentEditDialog
          assignment={assignment}
          initialAnswerKey={answerKey ?? ""}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onEdited(); qc.invalidateQueries({ queryKey: ["answer-key", assignment.id] }); }}
        />
      )}
    </div>
  );
}

function GradeRow({ sub, maxScore, isVoice, onGrade }: { sub: any; maxScore: number; isVoice: boolean; onGrade: (score: number, feedback: string, media: MediaValue) => void }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [score, setScore] = useState<number | "">(sub.score ?? "");
  const [fb, setFb] = useState(sub.feedback ?? "");
  const [feedbackMedia, setFeedbackMedia] = useState<MediaValue>({ media_type: sub.feedback_media_type ?? null, media_url: sub.feedback_media_url ?? null });
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const signFile = useServerFn(signAnswerFile);

  // A non-http file_url on a non-voice task is a private path in the answer-images
  // bucket (photo answer / attachment) — resolve it via the teacher-only signer.
  const isPrivatePhoto = !isVoice && !!sub.file_url && !/^https?:\/\//i.test(sub.file_url);

  // Sign the student's voice recording via the teacher-only server function.
  // Using the admin-signed URL avoids storage RLS edge cases and works for
  // both class assignments and personal (assigned_student_id) tasks.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!isVoice || !sub.file_url) return;
      try {
        const r = await signFile({ data: { bucket: "voice-answers", path: sub.file_url } });
        if (!active) return;
        if (r?.url) setVoiceUrl(r.url); else setVoiceError(true);
      } catch {
        if (active) setVoiceError(true);
      }
    }
    load();
    return () => { active = false; };
  }, [isVoice, sub.file_url, signFile]);


  // Resolve a signed URL for a private uploaded photo answer.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!isPrivatePhoto) return;
      try {
        const r = await signFile({ data: { bucket: "answer-images", path: sub.file_url } });
        if (active && r?.url) setPhotoUrl(r.url);
      } catch { /* ignore missing file */ }
    }
    load();
    return () => { active = false; };
  }, [isPrivatePhoto, sub.file_url, signFile]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display font-semibold">👤 {sub.profile?.full_name ?? "—"}</div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-display font-bold ${sub.status === "graded" ? "bg-xp/20 text-xp" : "bg-primary/15 text-primary"}`}>{sub.status === "graded" ? `✅ ${t("graded")}` : `📤 ${t("submitted")}`}</span>
      </div>
      {sub.content && <p className="mt-2 whitespace-pre-wrap text-sm">{sub.content}</p>}
      {isVoice ? (
        sub.file_url ? (
          <div className="mt-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-display font-bold text-quest">🎙️ {lang === "id" ? "Rekaman jawaban siswa" : "Student voice answer"}</div>
            {voiceUrl ? (
              <audio controls preload="metadata" src={voiceUrl} className="w-full" />
            ) : voiceError ? (
              <p className="text-xs text-destructive">{lang === "id" ? "Gagal memuat rekaman." : "Failed to load recording."}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Play className="size-3.5" /> {lang === "id" ? "Memuat rekaman…" : "Loading recording…"}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{lang === "id" ? "Belum ada rekaman dikirim." : "No recording submitted yet."}</p>
        )
      ) : isPrivatePhoto ? (
        <div className="mt-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-display font-bold text-primary">🖼️ {lang === "id" ? "Foto jawaban siswa" : "Student photo answer"}</div>
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="block"><img src={photoUrl} alt="jawaban siswa" className="max-h-64 rounded-xl border-2 border-border object-contain" /></a>
          ) : (
            <p className="text-xs text-muted-foreground">{lang === "id" ? "Memuat foto…" : "Loading photo…"}</p>
          )}
        </div>
      ) : (!isVoice && sub.file_url && (
        /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(sub.file_url) ? (
          <a href={sub.file_url} target="_blank" rel="noreferrer" className="mt-2 block"><img src={sub.file_url} alt="jawaban siswa" className="max-h-64 rounded-xl border-2 border-border object-contain" /></a>
        ) : /\.(mp4|webm|mov|ogg)(\?|$)/i.test(sub.file_url) ? (
          <video controls src={sub.file_url} className="mt-2 max-h-64 w-full rounded-xl border-2 border-border" />
        ) : (
          <a href={sub.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">📎 {lang === "id" ? "Lihat lampiran" : "View attachment"}</a>
        )
      ))}
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px,1fr,auto] sm:items-end">
        <div>
          <Label className="text-xs">⭐ {t("score")} / {maxScore}</Label>
          <Input type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value === "" ? "" : +e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">💬 {t("feedback")}</Label>
          <Input value={fb} onChange={(e) => setFb(e.target.value)} />
        </div>
        <Button variant="guru" size="sm" disabled={score === ""} onClick={() => onGrade(Number(score), fb, feedbackMedia)}>🏆 {t("giveGrade")}</Button>
      </div>
      {user?.id && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-display font-bold text-guru">🎙️ {lang === "id" ? "Koreksi audio / gambar / video (opsional)" : "Audio / image / video correction (optional)"}</div>
          <MediaInput userId={user.id} value={feedbackMedia} onChange={setFeedbackMedia} />
          {feedbackMedia.media_url && <MediaViewer mediaType={feedbackMedia.media_type} mediaUrl={feedbackMedia.media_url} />}
        </div>
      )}
    </div>
  );
}

function AssignmentEditDialog({ assignment, initialAnswerKey, onClose, onSaved }: {
  assignment: any;
  initialAnswerKey: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [title, setTitle] = useState<string>(assignment.title ?? "");
  const [description, setDescription] = useState<string>(assignment.description ?? "");
  const [subject, setSubject] = useState<string>(assignment.subject ?? "");
  const [dueAt, setDueAt] = useState<string>(toLocal(assignment.due_at));
  const [maxScore, setMaxScore] = useState<number>(assignment.max_score ?? 100);
  const [xpReward, setXpReward] = useState<number>(assignment.xp_reward ?? 50);
  const [coinReward, setCoinReward] = useState<number>(assignment.coin_reward ?? 10);
  const [quizLink, setQuizLink] = useState<string>(assignment.quiz_link ?? "");
  const [gameLink, setGameLink] = useState<string>(assignment.game_link ?? "");
  const [answerKey, setAnswerKey] = useState<string>(initialAnswerKey);
  const [examType, setExamType] = useState<string>(assignment.exam_type ?? "harian");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!title.trim()) throw new Error(t("required"));
      const { error } = await supabase.from("assignments").update({
        title: title.trim(),
        description: description.trim() || null,
        subject: subject || null,
        exam_type: examType,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        max_score: maxScore,
        xp_reward: xpReward,
        coin_reward: coinReward,
        quiz_link: quizLink.trim() || null,
        game_link: gameLink.trim() || null,
      }).eq("id", assignment.id);
      if (error) throw error;
      // Upsert answer key (delete + insert if provided, otherwise delete)
      await supabase.from("assignment_answer_keys").delete().eq("assignment_id", assignment.id);
      if (answerKey.trim()) {
        const { error: kErr } = await supabase.from("assignment_answer_keys").insert({
          assignment_id: assignment.id, teacher_id: user.id, answer_key: answerKey.trim(),
        });
        if (kErr) throw kErr;
      }
    },
    onSuccess: () => { toast.success(lang === "id" ? "Perubahan disimpan ✅" : "Saved ✅"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lang === "id" ? "Edit Tugas" : "Edit Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("title")} <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>{t("subject")}</Label>
            <SubjectSelect value={subject} onChange={setSubject} /></div>
          <div>
            <Label>{lang === "id" ? "Jenis Penilaian" : "Assessment Type"}</Label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.emoji} {lang === "id" ? e.labelId : e.labelEn}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5 text-guru" /> {lang === "id" ? "Kunci Jawaban (rahasia)" : "Answer Key (secret)"}</Label>
            <Textarea value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} placeholder={lang === "id" ? "Hanya guru yang dapat melihat ini" : "Only teachers can see this"} />
            <p className="mt-1 text-xs text-muted-foreground">🔒 {lang === "id" ? "Kunci jawaban tidak terlihat oleh siswa." : "Never visible to students."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("deadline")}</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
            <div><Label>{t("maxScore")}</Label><Input type="number" value={maxScore} onChange={(e) => setMaxScore(+e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("xpReward")}</Label><Input type="number" value={xpReward} onChange={(e) => setXpReward(+e.target.value)} /></div>
            <div><Label>{t("coinReward")}</Label><Input type="number" value={coinReward} onChange={(e) => setCoinReward(+e.target.value)} /></div>
          </div>
          <LinkFields quizLink={quizLink} gameLink={gameLink} onQuiz={setQuizLink} onGame={setGameLink} />
          <p className="text-xs text-muted-foreground">
            {lang === "id"
              ? "Catatan: format jawaban, pilihan ganda, dan sasaran (kelas/siswa) tidak bisa diubah setelah dibuat. Hapus & buat baru bila perlu."
              : "Note: answer format, options, and target cannot be changed after creation."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button variant="guru" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
