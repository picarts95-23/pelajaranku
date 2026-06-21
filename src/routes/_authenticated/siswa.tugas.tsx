import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sword, Sparkles, Coins, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/tugas")({
  head: () => ({ meta: [{ title: "Misi Saya · EduQuest Academy" }] }),
  component: SiswaTugasPage,
});

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
  const [content, setContent] = useState(a.mySubmission?.content ?? "");
  const [fileUrl, setFileUrl] = useState(a.mySubmission?.file_url ?? "");

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const payload = { assignment_id: a.id, student_id: user.id, content, file_url: fileUrl || null, status: "submitted" as const, submitted_at: new Date().toISOString() };
      const { error } = await supabase.from("submissions").upsert(payload, { onConflict: "assignment_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Misi terkirim! ✨" : "Mission submitted! ✨");
      setOpen(false);
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
              <div className="font-display text-lg font-bold">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.classes?.name} · {a.due_at ? `${t("due")}: ${format(new Date(a.due_at), "dd MMM HH:mm")}` : ""}</div>
            </div>
            {status === "graded" ? <span className="rounded-full bg-xp/20 px-2 py-0.5 text-xs font-display font-bold text-xp">{a.mySubmission?.score}/{a.max_score}</span>
              : status === "submitted" ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-display font-bold text-primary">{t("submitted")}</span>
              : overdue ? <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-display font-bold text-destructive">{lang === "id" ? "Lewat" : "Overdue"}</span>
              : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display font-bold">{t("notSubmitted")}</span>}
          </div>
          {a.description && <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{a.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-xp/15 px-2 py-1 font-display text-xs font-bold text-xp"><Sparkles className="size-3" /> +{a.xp_reward} XP</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-coin/15 px-2 py-1 font-display text-xs font-bold text-coin"><Coins className="size-3" /> +{a.coin_reward}</span>
            {a.mySubmission?.feedback && <span className="text-xs text-muted-foreground italic">"{a.mySubmission.feedback}"</span>}
          </div>
          {status !== "graded" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="quest" className="mt-3"><Send className="size-4" /> {status === "submitted" ? (lang === "id" ? "Edit Pengumpulan" : "Edit Submission") : t("submit")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{a.title}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>{t("yourAnswer")}</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></div>
                  <div><Label>{t("fileUrl")}</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." /></div>
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
