import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sword, Sparkles, Coins, Send, BookOpen, FileQuestion, CheckCircle2, Trophy, Clock, Camera, ImageIcon, HelpCircle, X, Inbox, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LinkBadges } from "@/components/link-fields";
import { AssignmentFileLink } from "@/components/assignment-file-input";
import { VoiceRecorder } from "@/components/voice-recorder";
import { ANSWER_FORMATS } from "@/lib/quran-data";
import { useMarkSeen } from "@/lib/notifications";
import { compressImage } from "@/lib/compress-image";
import { MAX_ANSWER_PHOTOS, joinAnswerFiles, parseAnswerFiles } from "@/lib/answer-files";

import { assertMediaSize } from "@/lib/media-limits";

export const Route = createFileRoute("/_authenticated/siswa/tugas")({
  head: () => ({ meta: [{ title: "Tugas & Latihan · Pelajaranku" }] }),
  component: SiswaTugasPage,
});

const FORMAT_EMOJI: Record<string, string> = Object.fromEntries(ANSWER_FORMATS.map((f) => [f.value, f.emoji]));

function SiswaTugasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  // Regular tasks / missions (everything except quiz-format assignments).
  const { data: assignments = [] } = useQuery({
    queryKey: ["siswa-quests", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, classes(name), submissions(*)").neq("answer_format", "quiz").order("due_at", { ascending: true, nullsFirst: false });
      return (data ?? []).map((a: any) => ({ ...a, mySubmission: a.submissions?.find((s: any) => s.student_id === user!.id) }));
    },
  });

  // Mixed-question quizzes.
  const { data: quizzes = [] } = useQuery({
    queryKey: ["siswa-quizzes", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, classes(name), submissions(*)").eq("answer_format", "quiz").order("created_at", { ascending: false });
      return (data ?? []).map((a: any) => ({ ...a, mySubmission: a.submissions?.find((s: any) => s.student_id === user!.id) }));
    },
  });

  // Mark assignments as seen so the "new task" badge clears.
  const markSeen = useMarkSeen(user?.id, "assignments");
  useEffect(() => { if (assignments.length || quizzes.length) markSeen(); }, [assignments.length, quizzes.length, markSeen]);

  return (
    <DashboardShell accent="siswa">
      <PageHeader
        title={lang === "id" ? "Tugas & Latihan" : "Tasks & Practice"}
        subtitle={lang === "id" ? "Semua misi, tugas, dan kuis kamu — tunaikan untuk meraih XP & koin!" : "All your missions, tasks, and quizzes — complete them to earn XP & coins!"}
        actions={
          <>
            <Link to="/siswa/permintaan"><Button size="sm" variant="outline"><Inbox className="size-4" /> {lang === "id" ? "Minta Tugas" : "Request Task"}</Button></Link>
            <HowToDialog />
          </>
        }
      />

      <Tabs defaultValue="tugas">
        <TabsList className="mb-4">
          <TabsTrigger value="tugas">
            <Sword className="mr-1.5 size-4" /> {lang === "id" ? "Tugas & Misi" : "Tasks & Missions"}
            {assignments.length > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{assignments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="kuis">
            <FileQuestion className="mr-1.5 size-4" /> {lang === "id" ? "Kuis & Latihan" : "Quizzes & Practice"}
            {quizzes.length > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{quizzes.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tugas">
          {assignments.length === 0 ? (
            <EmptyState message={lang === "id" ? "Belum ada tugas. Gabung ke kelas dulu!" : "No tasks yet. Join a class first!"} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {assignments.map((a: any) => <QuestCard key={a.id} a={a} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kuis">
          {(quizzes as any[]).length === 0 ? (
            <EmptyState message={lang === "id" ? "Belum ada kuis. Gabung ke kelas dulu ya!" : "No quizzes yet. Join a class first!"} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(quizzes as any[]).map((q) => <QuizCard key={q.id} quiz={q} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function QuestCard({ a }: { a: any }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const fmt: string = a.answer_format ?? "descriptive";
  const [content, setContent] = useState(a.mySubmission?.content ?? "");
  const [choice, setChoice] = useState(a.mySubmission?.content ?? "");
  const [choices, setChoices] = useState<string[]>(() => (a.mySubmission?.content ? String(a.mySubmission.content).split(", ").filter(Boolean) : []));
  const [fileUrl, setFileUrl] = useState(a.mySubmission?.file_url ?? "");
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [answerMode, setAnswerMode] = useState<"photo" | "file">("photo");
  const isVoiceFmt = fmt === "voice" || fmt === "muroja";
  const isPhotoFmt = fmt === "photo";
  const prevPhotoCount = parseAnswerFiles(a.mySubmission?.file_url).length;


  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      let storedFileUrl: string | null = fileUrl || null;

      if (isVoiceFmt) {
        if (voiceBlob) {
          if (voiceBlob.size === 0) throw new Error(lang === "id" ? "Rekaman kosong. Coba rekam ulang." : "Empty recording. Please re-record.");
          assertMediaSize(voiceBlob, "voiceAnswer", lang as "id" | "en");
          const rawType = voiceBlob.type || "audio/webm";
          const baseType = rawType.split(";")[0].trim() || "audio/webm";
          const ext = baseType.includes("mp4") || baseType.includes("m4a") || baseType.includes("aac") ? "m4a"
            : baseType.includes("ogg") ? "ogg"
            : baseType.includes("mpeg") ? "mp3"
            : baseType.includes("wav") ? "wav"
            : "webm";
          const path = `${user.id}/${a.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("voice-answers")
            .upload(path, voiceBlob, { upsert: true, contentType: baseType });
          if (upErr) throw new Error(`Upload rekaman gagal: ${upErr.message}`);
          storedFileUrl = path;
        } else if (!a.mySubmission?.file_url) {
          throw new Error(lang === "id" ? "Rekam jawaban suaramu dulu." : "Record your voice answer first.");
        } else {
          storedFileUrl = a.mySubmission.file_url;
        }
      }

      if (imageFiles.length > 0 || docFiles.length > 0) {
        const paths: string[] = [];
        // Kompres dulu (client-side), lalu validasi ukuran akhir tiap foto.
        for (let i = 0; i < imageFiles.length; i++) {
          const compressed = await compressImage(imageFiles[i]);
          assertMediaSize(compressed, "answerImage", lang as "id" | "en");
          const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
          const path = `${user.id}/${a.id}-${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from("answer-images").upload(path, compressed, { upsert: true, contentType: compressed.type || "image/jpeg" });
          if (upErr) throw new Error(`Upload foto ${i + 1} gagal: ${upErr.message}`);
          paths.push(path);
        }
        // Berkas dokumen (PDF/Word/Excel/PPT/ZIP) diunggah apa adanya.
        for (let i = 0; i < docFiles.length; i++) {
          const doc = docFiles[i];
          assertMediaSize(doc, "answerFile", lang as "id" | "en");
          const ext = (doc.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
          const path = `${user.id}/${a.id}-doc-${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from("answer-images").upload(path, doc, { upsert: true, contentType: doc.type || "application/octet-stream" });
          if (upErr) throw new Error(`Upload berkas ${i + 1} gagal: ${upErr.message}`);
          paths.push(path);
        }
        storedFileUrl = joinAnswerFiles(paths);
      } else if (isPhotoFmt && !a.mySubmission?.file_url) {
        throw new Error(lang === "id" ? "Unggah foto atau berkas jawabanmu dulu." : "Upload your photo or file answer first.");
      }


      let finalContent: string | null = content || null;
      if (fmt === "multiple_choice") {
        if (!choice) throw new Error(lang === "id" ? "Pilih salah satu jawaban." : "Choose an answer.");
        finalContent = choice;
      } else if (fmt === "complex_mc") {
        if (choices.length === 0) throw new Error(lang === "id" ? "Pilih minimal satu jawaban." : "Choose at least one answer.");
        finalContent = choices.join(", ");
      }

      const payload = {
        assignment_id: a.id, student_id: user.id, content: finalContent,
        file_url: storedFileUrl, status: "submitted" as const, submitted_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("submissions").upsert(payload, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Misi terkirim! ✨" : "Mission submitted! ✨");
      setOpen(false);
      setVoiceBlob(null);
      setImageFiles([]);
      setDocFiles([]);
      qc.invalidateQueries({ queryKey: ["siswa-quests"] });
    },
    onError: (e: Error) => {
      const raw = e.message || "";
      // Only map to "deadline passed" when the DB itself rejected the submissions insert —
      // storage/network/permission errors get their real message so the student can act on it.
      const isDeadline = /new row violates row-level security policy for table "submissions"/i.test(raw)
        || /assignments\.due_at/i.test(raw);
      toast.error(isDeadline
        ? (lang === "id" ? "Tenggat tugas sudah lewat." : "Task deadline has passed.")
        : raw);
    },
  });

  const status = a.mySubmission?.status;
  const pastDue = !!a.due_at && new Date(a.due_at) < new Date();
  const overdue = pastDue && !status;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-quest text-quest-foreground shadow-soft sm:size-12"><Sword className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-bold break-words sm:text-lg">{FORMAT_EMOJI[fmt] ?? "📝"} {a.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground break-words">{a.classes?.name ?? t("personalTask")}{a.due_at ? ` · ${t("due")}: ${format(new Date(a.due_at), "dd MMM HH:mm")}` : ""}</div>
            </div>
            {status === "graded" ? <span className="shrink-0 rounded-full bg-xp/20 px-2 py-0.5 text-xs font-display font-bold text-xp">⭐ {a.mySubmission?.score}/{a.max_score}</span>
              : status === "submitted" ? <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-display font-bold text-primary">📤 {t("submitted")}</span>
              : overdue ? <span className="shrink-0 rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-display font-bold text-destructive">{lang === "id" ? "Lewat" : "Overdue"}</span>
              : <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-display font-bold">{t("notSubmitted")}</span>}
          </div>
          {a.description && <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{a.description}</p>}

          {fmt === "muroja" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-display font-bold text-emerald-600">
              <BookOpen className="size-3.5" /> {a.muroja_juz ? `Juz ${a.muroja_juz} · ` : ""}{a.muroja_surah}{a.muroja_ayat ? ` : ${a.muroja_ayat}` : ""}
            </div>
          )}

          <LinkBadges quizLink={a.quiz_link} gameLink={a.game_link} />
          <AssignmentFileLink attachmentUrl={a.attachment_url} attachmentName={a.attachment_name} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-xp/15 px-2 py-1 font-display text-xs font-bold text-xp"><Sparkles className="size-3" /> +{a.xp_reward} XP</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-coin/15 px-2 py-1 font-display text-xs font-bold text-coin"><Coins className="size-3" /> +{a.coin_reward}</span>
            {a.mySubmission?.feedback && <span className="text-xs text-muted-foreground italic">💬 "{a.mySubmission.feedback}"</span>}
          </div>
          {overdue && (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-display font-bold text-destructive">
              ⛔ {lang === "id" ? "Tenggat sudah lewat — tugas ini tidak dikerjakan." : "Deadline passed — this task was not completed."}
            </p>
          )}
          {status !== "graded" && !overdue && !(status === "submitted" && pastDue) && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="quest" className="mt-3"><Send className="size-4" /> {status === "submitted" ? (lang === "id" ? "Edit Pengumpulan" : "Edit Submission") : t("submit")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{FORMAT_EMOJI[fmt] ?? "📝"} {a.title}</DialogTitle></DialogHeader>
                <TaskTypeGuide fmt={fmt} hasLink={!!(a.quiz_link || a.game_link)} />
                <div className="space-y-3">
                  {fmt === "multiple_choice" && Array.isArray(a.options) ? (
                    <div>
                      <Label>{lang === "id" ? "Pilih jawaban" : "Choose your answer"}</Label>
                      <RadioGroup value={choice} onValueChange={setChoice} className="mt-2 space-y-2">
                        {a.options.map((o: string, i: number) => (
                          <label key={i} htmlFor={`opt-${a.id}-${i}`} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-border p-3 hover:border-siswa/50 has-[:checked]:border-siswa has-[:checked]:bg-siswa/10">
                            <RadioGroupItem value={o} id={`opt-${a.id}-${i}`} />
                            <span className="font-display text-sm font-semibold">{String.fromCharCode(65 + i)}. {o}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  ) : fmt === "complex_mc" && Array.isArray(a.options) ? (
                    <div>
                      <Label>{lang === "id" ? "Pilih semua jawaban benar" : "Select all correct answers"}</Label>
                      <div className="mt-2 space-y-2">
                        {a.options.map((o: string, i: number) => {
                          const checked = choices.includes(o);
                          return (
                            <button
                              type="button"
                              key={i}
                              onClick={() => setChoices(checked ? choices.filter((c) => c !== o) : [...choices, o])}
                              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${checked ? "border-siswa bg-siswa/10" : "border-border hover:border-siswa/50"}`}
                            >
                              <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${checked ? "border-siswa bg-siswa text-white" : "border-border text-transparent"}`}>✓</span>
                              <span className="font-display text-sm font-semibold">{String.fromCharCode(65 + i)}. {o}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : isVoiceFmt ? (
                    <div>
                      <Label>{fmt === "muroja" ? (lang === "id" ? "Rekam bacaan hafalanmu" : "Record your recitation") : (lang === "id" ? "Rekam jawaban suaramu" : "Record your voice answer")}</Label>
                      <div className="mt-2"><VoiceRecorder onChange={({ blob }) => setVoiceBlob(blob)} /></div>
                      {a.mySubmission?.file_url && !voiceBlob && <p className="mt-1 text-xs text-muted-foreground">✅ {lang === "id" ? "Rekaman sebelumnya tersimpan. Rekam ulang untuk mengganti." : "Previous recording saved. Re-record to replace."}</p>}
                    </div>
                  ) : isPhotoFmt ? (
                    <div>
                      <Label>{lang === "id" ? "Pilih cara mengirim jawaban" : "Choose how to submit"}</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={answerMode === "photo" ? "siswa" : "outline"} onClick={() => setAnswerMode("photo")}>
                          <ImageIcon className="size-4" /> {lang === "id" ? "Foto" : "Photo"}
                        </Button>
                        <Button type="button" size="sm" variant={answerMode === "file" ? "siswa" : "outline"} onClick={() => setAnswerMode("file")}>
                          <Paperclip className="size-4" /> {lang === "id" ? "Berkas (PDF/Word/dll)" : "File (PDF/Word/etc)"}
                        </Button>
                      </div>
                      {answerMode === "photo" ? (
                        <div className="mt-3">
                          <Label>{lang === "id" ? "Unggah foto/gambar jawabanmu (bisa lebih dari 1)" : "Upload your photo/image answers (multiple allowed)"}</Label>
                          <PhotoInput files={imageFiles} onChange={setImageFiles} idPrefix={`p-${a.id}`} />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Label>{lang === "id" ? "Unggah berkas jawabanmu (PDF/Word/Excel/PPT/ZIP, maks 20 MB)" : "Upload your answer file (PDF/Word/Excel/PPT/ZIP, max 20 MB)"}</Label>
                          <DocInput files={docFiles} onChange={setDocFiles} idPrefix={`d-${a.id}`} />
                        </div>
                      )}
                      {imageFiles.length === 0 && docFiles.length === 0 && prevPhotoCount > 0 && <p className="mt-1 text-xs text-muted-foreground">✅ {lang === "id" ? `${prevPhotoCount} berkas sebelumnya tersimpan. Pilih yang baru untuk mengganti semuanya.` : `${prevPhotoCount} previous file(s) saved. Choose new ones to replace them.`}</p>}
                    </div>
                  ) : (
                    <>
                      <div><Label>{t("yourAnswer")}</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></div>
                      <div>
                        <Label>{lang === "id" ? "Lampiran foto (opsional, bisa lebih dari 1)" : "Photo attachments (optional, multiple allowed)"}</Label>
                        <PhotoInput files={imageFiles} onChange={setImageFiles} idPrefix={`opt-${a.id}`} />
                      </div>
                      <div>
                        <Label>{lang === "id" ? "Lampiran berkas (opsional, PDF/Word/dll)" : "File attachments (optional, PDF/Word/etc)"}</Label>
                        <DocInput files={docFiles} onChange={setDocFiles} idPrefix={`optd-${a.id}`} />
                      </div>
                      <div><Label>{t("fileUrl")}</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." /></div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button
                    variant="quest"
                    disabled={
                      submitMut.isPending
                      || (isVoiceFmt && !voiceBlob && !a.mySubmission?.file_url)
                      || (isPhotoFmt && imageFiles.length === 0 && docFiles.length === 0 && prevPhotoCount === 0)
                    }

                    onClick={() => submitMut.mutate()}
                  >
                    {submitMut.isPending ? (lang === "id" ? "Mengirim…" : "Sending…") : t("submit")}
                  </Button>
                </DialogFooter>

              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}

type QResult = { auto_correct: number; total: number; manual_pending: number; score: number; max_score: number; status: string };

function QuizCard({ quiz }: { quiz: any }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const questions: any[] = Array.isArray(quiz.questions) ? quiz.questions : [];
  const [answers, setAnswers] = useState<any[]>(() => questions.map(() => null));
  const [voiceBlobs, setVoiceBlobs] = useState<Record<number, Blob | null>>({});
  const [imageFiles, setImageFiles] = useState<Record<number, File | null>>({});
  const [result, setResult] = useState<QResult | null>(null);
  const done = !!quiz.mySubmission;

  const setAns = (i: number, v: any) => setAnswers((a) => a.map((x, idx) => (idx === i ? v : x)));

  const submitMut = useMutation({
    mutationFn: async () => {
      const finalAnswers = [...answers];
      for (let i = 0; i < questions.length; i++) {
        const type = questions[i]?.type ?? "multiple_choice";
        if (type === "voice") {
          const blob = voiceBlobs[i];
          if (!blob) throw new Error(lang === "id" ? `Rekam jawaban soal ${i + 1}` : `Record answer for Q${i + 1}`);
          assertMediaSize(blob, "voiceAnswer", lang as "id" | "en");
          const path = `${user!.id}/${quiz.id}-${i}-${crypto.randomUUID()}.webm`;
          const { error: upErr } = await supabase.storage.from("voice-answers").upload(path, blob);
          if (upErr) throw upErr;
          finalAnswers[i] = path;
        } else if (type === "image") {
          const raw = imageFiles[i];
          if (!raw) throw new Error(lang === "id" ? `Unggah foto jawaban soal ${i + 1}` : `Upload photo for Q${i + 1}`);
          const file = await compressImage(raw);
          assertMediaSize(file, "answerImage", lang as "id" | "en");
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${user!.id}/${quiz.id}-${i}-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("answer-images").upload(path, file, { contentType: file.type });
          if (upErr) throw upErr;
          finalAnswers[i] = path;
        } else if (finalAnswers[i] === null || finalAnswers[i] === undefined || String(finalAnswers[i]).trim() === "") {
          throw new Error(lang === "id" ? `Jawab soal ${i + 1} dulu ya!` : `Answer Q${i + 1} first!`);
        }
      }
      const { data, error } = await (supabase as any).rpc("grade_quiz_submission", {
        _assignment_id: quiz.id,
        _answers: finalAnswers,
      });
      if (error) throw error;
      return data as QResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.manual_pending > 0) {
        toast.success(lang === "id" ? "Jawaban terkirim, menunggu penilaian guru 📝" : "Submitted, awaiting teacher grading 📝");
      } else {
        toast.success(lang === "id" ? `Skor kamu ${data.score}/${data.max_score} 🎉` : `Your score ${data.score}/${data.max_score} 🎉`);
      }
      qc.invalidateQueries({ queryKey: ["siswa-quizzes"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("ALREADY_SUBMITTED")
        ? (lang === "id" ? "Kamu sudah mengerjakan kuis ini." : "You already took this quiz.")
        : e.message.includes("DEADLINE_PASSED")
        ? (lang === "id" ? "Tenggat kuis sudah lewat." : "Quiz deadline has passed.")
        : e.message;
      toast.error(msg);
    },
  });

  const pendingGrade = done && quiz.mySubmission.status === "submitted";
  const overdue = !!quiz.due_at && new Date(quiz.due_at) < new Date() && !done;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg sm:p-5">
      <div className="flex items-start gap-2">
        <FileQuestion className="size-5 shrink-0 text-accent mt-0.5" />
        <h3 className="min-w-0 flex-1 font-display text-base font-bold break-words sm:text-lg">{quiz.title}</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground break-words">
        {quiz.classes?.name ?? "—"} · {questions.length} {lang === "id" ? "soal" : "questions"}
        {quiz.due_at ? ` · ${lang === "id" ? "tenggat" : "due"} ${format(new Date(quiz.due_at), "dd MMM")}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-quest/15 px-3 py-1 font-display font-bold text-quest"><Sparkles className="mr-1 inline size-3" />{quiz.xp_reward} XP</span>
        <span className="rounded-full bg-coin/15 px-3 py-1 font-display font-bold text-coin"><Coins className="mr-1 inline size-3" />{quiz.coin_reward}</span>
      </div>

      {done ? (
        pendingGrade ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-display font-bold text-amber-700">
            <Clock className="size-5" /> {lang === "id" ? "Terkirim · menunggu nilai guru" : "Submitted · awaiting grade"}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-xp/10 px-4 py-3 text-sm font-display font-bold text-xp">
            <Trophy className="size-5" /> {lang === "id" ? "Selesai" : "Done"} · {quiz.mySubmission.score ?? 0}/{quiz.max_score}
          </div>
        )
      ) : overdue ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-display font-bold text-destructive">
          ⛔ {lang === "id" ? "Tenggat sudah lewat — kuis ini tidak dikerjakan." : "Deadline passed — this quiz was not completed."}
        </div>
      ) : (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAnswers(questions.map(() => null)); setVoiceBlobs({}); setResult(null); } }}>
          <DialogTrigger asChild>
            <Button variant="siswa" className="mt-4 w-full"><FileQuestion className="size-4" /> {lang === "id" ? "Kerjakan" : "Take Quiz"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{quiz.title}</DialogTitle></DialogHeader>
            <TaskTypeGuide fmt="quiz" />

            {result ? (
              <div className="space-y-4 py-4 text-center">
                <div className="text-5xl">{result.manual_pending > 0 ? "📝" : "🎉"}</div>
                {result.manual_pending > 0 ? (
                  <p className="text-sm text-muted-foreground">{lang === "id" ? "Jawabanmu terkirim. Sebagian soal dinilai guru secara manual." : "Submitted. Some answers will be graded by your teacher."}</p>
                ) : (
                  <>
                    <div className="font-display text-3xl font-bold text-primary">{result.score}<span className="text-lg text-muted-foreground">/{result.max_score}</span></div>
                    <p className="text-sm text-muted-foreground">{lang === "id" ? `Benar ${result.auto_correct} dari ${result.total} soal` : `${result.auto_correct} of ${result.total} correct`}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((qq, qi) => {
                  const type = qq.type ?? "multiple_choice";
                  return (
                    <div key={qi} className="rounded-xl border-2 border-border bg-muted/20 p-3">
                      <p className="font-display text-sm font-bold">{qi + 1}. {qq.q}</p>

                      {type === "multiple_choice" && (
                        <div className="mt-2 space-y-1.5">
                          {(qq.options ?? []).map((opt: string, oi: number) => {
                            const selected = answers[qi] === oi;
                            return (
                              <button key={oi} type="button" onClick={() => setAns(qi, oi)}
                                className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors ${selected ? "border-siswa bg-siswa/10 font-semibold" : "border-border hover:bg-muted"}`}>
                                <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-siswa bg-siswa text-white" : "border-muted-foreground/40"}`}>
                                  {selected && <CheckCircle2 className="size-3.5" />}
                                </span>
                                <span className="font-display text-xs font-bold text-muted-foreground">{String.fromCharCode(65 + oi)}</span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {type === "true_false" && (
                        <div className="mt-2 flex gap-2">
                          {[["true", lang === "id" ? "Benar" : "True"], ["false", lang === "id" ? "Salah" : "False"]].map(([val, label]) => {
                            const selected = answers[qi] === val;
                            return (
                              <button key={val} type="button" onClick={() => setAns(qi, val)}
                                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${selected ? "border-siswa bg-siswa/10 text-siswa" : "border-border hover:bg-muted"}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {type === "short_answer" && (
                        <Input className="mt-2" placeholder={lang === "id" ? "Tulis jawaban singkat…" : "Short answer…"} value={answers[qi] ?? ""} onChange={(e) => setAns(qi, e.target.value)} />
                      )}

                      {type === "essay" && (
                        <Textarea className="mt-2" rows={3} placeholder={lang === "id" ? "Tulis jawaban esai…" : "Write your essay…"} value={answers[qi] ?? ""} onChange={(e) => setAns(qi, e.target.value)} />
                      )}

                      {type === "voice" && (
                        <div className="mt-2">
                          <VoiceRecorder onChange={({ blob }) => setVoiceBlobs((v) => ({ ...v, [qi]: blob }))} />
                        </div>
                      )}

                      {type === "image" && (
                        <div className="mt-2">
                          <PhotoInput
                            files={imageFiles[qi] ? [imageFiles[qi] as File] : []}
                            onChange={(f) => setImageFiles((v) => ({ ...v, [qi]: f[f.length - 1] ?? null }))}
                            idPrefix={`qi-${quiz.id}-${qi}`}
                            max={1}
                          />

                        </div>
                      )}

                      {(type === "essay" || type === "voice" || type === "image") && (
                        <p className="mt-1.5 text-xs text-muted-foreground">{lang === "id" ? "Dinilai oleh guru." : "Graded by teacher."}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              {result ? (
                <Button variant="siswa" onClick={() => setOpen(false)}>{lang === "id" ? "Tutup" : "Close"}</Button>
              ) : (
                <Button variant="siswa" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                  {submitMut.isPending ? (lang === "id" ? "Mengirim…" : "Submitting…") : (lang === "id" ? "Kirim Jawaban" : "Submit Answers")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Mobile-friendly photo picker: kamera + galeri, mendukung beberapa foto sekaligus. */
function PhotoInput({
  files,
  onChange,
  idPrefix,
  max = MAX_ANSWER_PHOTOS,
}: { files: File[]; onChange: (f: File[]) => void; idPrefix: string; max?: number }) {
  const { lang } = useLang();
  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);
  const full = files.length >= max;

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = Math.max(0, max - files.length);
    const picked = Array.from(list).slice(0, room);
    if (Array.from(list).length > room) {
      toast.error(lang === "id" ? `Maksimal ${max} foto.` : `Maximum ${max} photos.`);
    }
    const compressed = await Promise.all(picked.map((f) => compressImage(f)));
    onChange([...files, ...compressed]);
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="siswa" disabled={full} onClick={() => camRef.current?.click()}>
          <Camera className="size-4" /> {lang === "id" ? "Ambil Foto" : "Take Photo"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={full} onClick={() => galRef.current?.click()}>
          <ImageIcon className="size-4" /> {lang === "id" ? "Pilih dari Galeri" : "Choose from Gallery"}
        </Button>
        {files.length > 0 && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange([])}>
            <X className="size-4" /> {lang === "id" ? "Hapus semua" : "Clear all"}
          </Button>
        )}
      </div>
      <input
        ref={camRef}
        id={`${idPrefix}-cam`}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => { await addFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={galRef}
        id={`${idPrefix}-gal`}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => { await addFiles(e.target.files); e.target.value = ""; }}
      />

      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="shrink-0 font-display font-bold">{i + 1}.</span>
              <span className="truncate">{f.name}</span>
              <span className="ml-auto shrink-0 text-emerald-600/70">{(f.size / 1024).toFixed(0)} KB</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-destructive"
                aria-label={lang === "id" ? "Hapus foto" : "Remove photo"}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {lang === "id"
          ? `Format: JPG/PNG/HEIC. Bisa kirim sampai ${max} foto (maks 15 MB per foto). Pastikan tulisan terbaca jelas.`
          : `JPG/PNG/HEIC, up to ${max} photos (max 15 MB each). Make sure your writing is legible.`}
      </p>
    </div>
  );
}


/** Panduan singkat "Cara Kirim Tugas" untuk siswa. */
function HowToDialog() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="quest"><HelpCircle className="size-4" /> {lang === "id" ? "Panduan Kirim" : "How to Submit"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{lang === "id" ? "Cara Mengumpulkan Tugas" : "How to Submit Assignments"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <Step n={1} title={lang === "id" ? "Buka tugas" : "Open the task"}>
            {lang === "id" ? "Ketuk kartu tugas, lalu tekan tombol Kirim." : "Tap a task card, then press Submit."}
          </Step>
          <Step n={2} title={lang === "id" ? "Rekaman Suara 🎙️" : "Voice Recording 🎙️"}>
            {lang === "id"
              ? "Tekan Mulai rekam. Bila muncul permintaan izin mikrofon, pilih Izinkan. Ketuk Berhenti saat selesai lalu Putar untuk memeriksa. Jika tidak keluar suara, ulangi rekam."
              : "Tap Start recording. If prompted, allow the microphone. Tap Stop when done, then Play to review. Re-record if needed."}
          </Step>
          <Step n={3} title={lang === "id" ? "Foto Jawaban 📷" : "Photo Answer 📷"}>
            {lang === "id"
              ? "Ketuk Ambil Foto untuk memakai kamera HP, atau Pilih dari Galeri untuk memilih foto yang sudah ada. Pastikan tulisan jelas dan tidak buram."
              : "Tap Take Photo to use your camera, or Choose from Gallery. Ensure the writing is clear and not blurry."}
          </Step>
          <Step n={4} title={lang === "id" ? "Kirim ✨" : "Submit ✨"}>
            {lang === "id"
              ? "Tekan Kirim. Kalau berhasil, statusnya berubah jadi Terkirim 📤. Selama tenggat belum lewat, kamu boleh Edit Pengumpulan."
              : "Tap Submit. On success the status becomes Submitted 📤. You can edit before the deadline passes."}
          </Step>
          <Step n={5} title={lang === "id" ? "Kalau gagal ⚠️" : "If it fails ⚠️"}>
            {lang === "id"
              ? "Cek koneksi internet, pastikan izin mikrofon/kamera menyala, ukuran foto ≤ 15 MB, dan tenggat belum lewat. Pesan error akan muncul di layar."
              : "Check your connection, mic/camera permissions, keep photos ≤ 15 MB, and confirm the deadline hasn't passed. Error toasts show details."}
          </Step>
        </div>
        <DialogFooter>
          <Button variant="siswa" onClick={() => setOpen(false)}>{lang === "id" ? "Siap!" : "Got it!"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-siswa font-display text-xs font-bold text-white">{n}</div>
      <div className="min-w-0">
        <div className="font-display text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Panduan langkah spesifik yang muncul di dalam dialog kirim tugas, menyesuaikan format tugas. */
function TaskTypeGuide({ fmt, hasLink }: { fmt: string; hasLink?: boolean }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const id = lang === "id";

  const guides: Record<string, { emoji: string; title: string; steps: string[] }> = {
    voice: {
      emoji: "🎙️",
      title: id ? "Panduan Tugas Rekaman Suara" : "Voice Recording Guide",
      steps: id ? [
        "Tekan tombol Mulai rekam. Jika muncul permintaan izin mikrofon, pilih Izinkan.",
        "Bicara jelas dekat mikrofon. Cari tempat yang tidak berisik.",
        "Tekan Berhenti saat selesai, lalu Putar untuk memeriksa hasilnya.",
        "Kalau kurang jelas, tekan Rekam ulang. Kalau sudah oke, tekan Kirim.",
      ] : [
        "Tap Start recording. Allow the microphone if asked.",
        "Speak clearly, close to the mic, in a quiet place.",
        "Tap Stop when done, then Play to review.",
        "Re-record if unclear, then tap Submit.",
      ],
    },
    muroja: {
      emoji: "📖",
      title: id ? "Panduan Setor Hafalan" : "Muroja'ah Guide",
      steps: id ? [
        "Perhatikan surat/ayat yang harus disetor pada label di kartu.",
        "Tekan Mulai rekam, lalu baca hafalanmu dengan tartil.",
        "Tekan Berhenti, lalu Putar untuk memastikan bacaan tidak terpotong.",
        "Tekan Kirim untuk menyetor hafalanmu ke guru.",
      ] : [
        "Note the surah/ayat shown on the card.",
        "Tap Start recording and recite calmly.",
        "Tap Stop, then Play to make sure nothing was cut off.",
        "Tap Submit to send your recitation.",
      ],
    },
    photo: {
      emoji: "📷",
      title: id ? "Panduan Tugas Foto" : "Photo Task Guide",
      steps: id ? [
        "Kerjakan jawabanmu di buku/kertas dulu dengan tulisan yang jelas.",
        "Tekan Ambil Foto untuk memakai kamera, atau Pilih dari Galeri.",
        "Pastikan foto terang, tidak buram, dan seluruh jawaban terlihat.",
        "Ukuran foto maksimal 15 MB. Tekan Kirim setelah foto muncul.",
      ] : [
        "Do the work on paper with clear handwriting.",
        "Tap Take Photo or Choose from Gallery.",
        "Make sure the photo is bright, sharp, and shows the whole answer.",
        "Max 15 MB. Tap Submit once the photo appears.",
      ],
    },
    multiple_choice: {
      emoji: "🔘",
      title: id ? "Panduan Pilihan Ganda" : "Multiple Choice Guide",
      steps: id ? [
        "Baca soal dan semua opsi dengan teliti.",
        "Ketuk satu opsi jawaban — kotak akan berwarna bila terpilih.",
        "Kamu masih bisa mengubah pilihan sebelum menekan Kirim.",
        "Tekan Kirim untuk mengunci jawabanmu.",
      ] : [
        "Read the question and every option carefully.",
        "Tap one option — it highlights when selected.",
        "You can change your choice before submitting.",
        "Tap Submit to lock in your answer.",
      ],
    },
    complex_mc: {
      emoji: "☑️",
      title: id ? "Panduan Pilihan Ganda Kompleks" : "Multi-Select Guide",
      steps: id ? [
        "Boleh memilih LEBIH DARI SATU jawaban yang benar.",
        "Ketuk sekali untuk memilih, ketuk lagi untuk membatalkan.",
        "Pastikan minimal satu jawaban dicentang sebelum Kirim.",
      ] : [
        "You may pick MORE THAN ONE correct answer.",
        "Tap to select, tap again to unselect.",
        "Ensure at least one is selected before Submit.",
      ],
    },
    quiz: {
      emoji: "🧠",
      title: id ? "Panduan Kuis" : "Quiz Guide",
      steps: id ? [
        "Jawab setiap soal berurutan — kamu bisa menggulir ke bawah.",
        "Tiap soal punya format berbeda (pilihan, isian, esai, suara, foto). Ikuti tampilannya.",
        "Kamu hanya bisa mengirim SATU KALI, jadi periksa dulu sebelum Kirim Jawaban.",
        "Nilai otomatis muncul setelah kirim; soal esai/suara/foto menunggu penilaian guru.",
      ] : [
        "Answer each question in order — scroll down to see them all.",
        "Each question type looks different (choice, short, essay, voice, photo).",
        "You can submit only ONCE — review before pressing Submit Answers.",
        "Auto-graded score shows up immediately; essay/voice/photo await teacher grading.",
      ],
    },
    descriptive: {
      emoji: "✍️",
      title: id ? "Panduan Tugas Uraian" : "Descriptive Task Guide",
      steps: id ? [
        "Tulis jawabanmu di kolom teks. Boleh panjang, boleh singkat sesuai perintah.",
        "Opsional: lampirkan foto pendukung lewat tombol foto.",
        "Opsional: tempel tautan (Google Drive/Docs) di kolom URL bila diminta.",
        "Periksa ejaan, lalu tekan Kirim.",
      ] : [
        "Type your answer in the text box.",
        "Optional: attach a supporting photo.",
        "Optional: paste a link (Drive/Docs) if requested.",
        "Proofread, then tap Submit.",
      ],
    },
  };

  const key = fmt === "voice" || fmt === "muroja" || fmt === "photo" || fmt === "multiple_choice" || fmt === "complex_mc" || fmt === "quiz"
    ? fmt : "descriptive";
  const g = guides[key];

  return (
    <div className="rounded-xl border-2 border-siswa/30 bg-siswa/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="inline-flex items-center gap-2 font-display text-sm font-bold text-siswa">
          <HelpCircle className="size-4" /> {g.emoji} {g.title}
        </span>
        <span className="text-xs text-muted-foreground">{open ? (id ? "Sembunyikan" : "Hide") : (id ? "Lihat langkah" : "Show steps")}</span>
      </button>
      {open && (
        <ol className="space-y-1.5 border-t border-siswa/20 px-3 py-2.5 text-xs text-foreground/80">
          {g.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-siswa font-display text-[10px] font-bold text-white">{i + 1}</span>
              <span className="min-w-0">{s}</span>
            </li>
          ))}
          {hasLink && (
            <li className="flex gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary font-display text-[10px] font-bold text-white">🔗</span>
              <span className="min-w-0">{id ? "Ada tautan kuis/permainan pada kartu tugas — buka & kerjakan dulu, baru kembali ke sini untuk mengirim." : "This task has a quiz/game link — open it first, then come back to submit."}</span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

