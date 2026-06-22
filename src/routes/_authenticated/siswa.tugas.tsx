import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sword, Sparkles, Coins, Send, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LinkBadges } from "@/components/link-fields";
import { VoiceRecorder } from "@/components/voice-recorder";
import { ANSWER_FORMATS } from "@/lib/quran-data";

export const Route = createFileRoute("/_authenticated/siswa/tugas")({
  head: () => ({ meta: [{ title: "Misi Saya · EduQuest Academy" }] }),
  component: SiswaTugasPage,
});

const FORMAT_EMOJI: Record<string, string> = Object.fromEntries(ANSWER_FORMATS.map((f) => [f.value, f.emoji]));

function SiswaTugasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: assignments = [] } = useQuery({
    queryKey: ["siswa-quests", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, classes(name), submissions(*)").order("due_at", { ascending: true, nullsFirst: false });
      return (data ?? []).map((a: any) => ({ ...a, mySubmission: a.submissions?.find((s: any) => s.student_id === user!.id) }));
    },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("navMyQuests")} subtitle={lang === "id" ? "Tunaikan misi untuk meraih XP & koin!" : "Complete missions to earn XP & coins!"} />
      {assignments.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada misi. Gabung ke kelas dulu!" : "No missions yet. Join a class first!"} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignments.map((a: any) => <QuestCard key={a.id} a={a} />)}
        </div>
      )}
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
  const [fileUrl, setFileUrl] = useState(a.mySubmission?.file_url ?? "");
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const isVoiceFmt = fmt === "voice" || fmt === "muroja";

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      let storedFileUrl: string | null = fileUrl || null;

      if (isVoiceFmt) {
        if (voiceBlob) {
          const ext = voiceBlob.type.includes("mp4") ? "mp4" : "webm";
          const path = `${user.id}/${a.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("voice-answers").upload(path, voiceBlob, { upsert: true, contentType: voiceBlob.type });
          if (upErr) throw upErr;
          storedFileUrl = path;
        } else if (!a.mySubmission?.file_url) {
          throw new Error(lang === "id" ? "Rekam jawaban suaramu dulu." : "Record your voice answer first.");
        } else {
          storedFileUrl = a.mySubmission.file_url;
        }
      }

      let finalContent: string | null = content || null;
      if (fmt === "multiple_choice") {
        if (!choice) throw new Error(lang === "id" ? "Pilih salah satu jawaban." : "Choose an answer.");
        finalContent = choice;
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
      qc.invalidateQueries({ queryKey: ["siswa-quests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = a.mySubmission?.status;
  const overdue = a.due_at && new Date(a.due_at) < new Date() && !status;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex items-start gap-3">
        <div className="grid size-12 place-items-center rounded-xl bg-gradient-quest text-quest-foreground shadow-soft"><Sword className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-lg font-bold">{FORMAT_EMOJI[fmt] ?? "📝"} {a.title}</div>
              <div className="text-xs text-muted-foreground">{a.classes?.name ?? t("personalTask")} · {a.due_at ? `${t("due")}: ${format(new Date(a.due_at), "dd MMM HH:mm")}` : ""}</div>
            </div>
            {status === "graded" ? <span className="rounded-full bg-xp/20 px-2 py-0.5 text-xs font-display font-bold text-xp">⭐ {a.mySubmission?.score}/{a.max_score}</span>
              : status === "submitted" ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-display font-bold text-primary">📤 {t("submitted")}</span>
              : overdue ? <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-display font-bold text-destructive">{lang === "id" ? "Lewat" : "Overdue"}</span>
              : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display font-bold">{t("notSubmitted")}</span>}
          </div>
          {a.description && <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{a.description}</p>}

          {fmt === "muroja" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-display font-bold text-emerald-600">
              <BookOpen className="size-3.5" /> {a.muroja_juz ? `Juz ${a.muroja_juz} · ` : ""}{a.muroja_surah}{a.muroja_ayat ? ` : ${a.muroja_ayat}` : ""}
            </div>
          )}

          <LinkBadges quizLink={a.quiz_link} gameLink={a.game_link} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-xp/15 px-2 py-1 font-display text-xs font-bold text-xp"><Sparkles className="size-3" /> +{a.xp_reward} XP</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-coin/15 px-2 py-1 font-display text-xs font-bold text-coin"><Coins className="size-3" /> +{a.coin_reward}</span>
            {a.mySubmission?.feedback && <span className="text-xs text-muted-foreground italic">💬 "{a.mySubmission.feedback}"</span>}
          </div>
          {status !== "graded" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="quest" className="mt-3"><Send className="size-4" /> {status === "submitted" ? (lang === "id" ? "Edit Pengumpulan" : "Edit Submission") : t("submit")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{FORMAT_EMOJI[fmt] ?? "📝"} {a.title}</DialogTitle></DialogHeader>
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
                  ) : isVoiceFmt ? (
                    <div>
                      <Label>{fmt === "muroja" ? (lang === "id" ? "Rekam bacaan hafalanmu" : "Record your recitation") : (lang === "id" ? "Rekam jawaban suaramu" : "Record your voice answer")}</Label>
                      <div className="mt-2"><VoiceRecorder onChange={({ blob }) => setVoiceBlob(blob)} /></div>
                      {a.mySubmission?.file_url && !voiceBlob && <p className="mt-1 text-xs text-muted-foreground">✅ {lang === "id" ? "Rekaman sebelumnya tersimpan. Rekam ulang untuk mengganti." : "Previous recording saved. Re-record to replace."}</p>}
                    </div>
                  ) : (
                    <>
                      <div><Label>{t("yourAnswer")}</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></div>
                      <div><Label>{t("fileUrl")}</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." /></div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button variant="quest" disabled={submitMut.isPending} onClick={() => submitMut.mutate()}>{t("submit")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
