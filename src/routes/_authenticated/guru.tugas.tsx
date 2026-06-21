import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollText, Plus, Trash2, ChevronRight } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/guru/tugas")({
  head: () => ({ meta: [{ title: "Tugas · EduQuest Academy" }] }),
  component: GuruTugasPage,
});

function GuruTugasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ class_id: "", title: "", description: "", due_at: "", max_score: 100, xp_reward: 50, coin_reward: 10 });

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments").select("*, classes(name), submissions(id, status, score, student_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.class_id || !form.title) throw new Error(t("required"));
      const { error } = await supabase.from("assignments").insert({
        teacher_id: user.id, class_id: form.class_id, title: form.title,
        description: form.description || null, due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        max_score: form.max_score, xp_reward: form.xp_reward, coin_reward: form.coin_reward,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Tugas dibuat" : "Assignment created");
      setOpen(false);
      setForm({ class_id: "", title: "", description: "", due_at: "", max_score: 100, xp_reward: 50, coin_reward: 10 });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Tugas dihapus" : "Deleted"); qc.invalidateQueries({ queryKey: ["assignments"] }); },
  });

  const currentAssignment = useMemo(() => assignments.find((a: any) => a.id === selected), [assignments, selected]);

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navAssignments")}
        subtitle={lang === "id" ? "Buat tugas dan beri nilai pengumpulan siswa" : "Create tasks and grade student submissions"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newAssignment")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("newAssignment")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("navClasses")}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("deadline")}</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
                  <div><Label>{t("maxScore")}</Label><Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("xpReward")}</Label><Input type="number" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: +e.target.value })} /></div>
                  <div><Label>{t("coinReward")}</Label><Input type="number" value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: +e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {assignments.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-2">
            {assignments.map((a: any) => {
              const subs = a.submissions ?? [];
              const pending = subs.filter((s: any) => s.status === "submitted").length;
              return (
                <button key={a.id} onClick={() => setSelected(a.id)} className={`w-full text-left rounded-2xl border-2 p-4 shadow-soft transition ${selected === a.id ? "border-guru bg-guru/10" : "border-border bg-card hover:border-guru/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display font-bold truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.classes?.name} · {a.due_at ? format(new Date(a.due_at), "dd MMM") : "—"}</div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="rounded-full bg-xp/15 px-2 py-0.5 font-display font-bold text-xp">+{a.xp_reward} XP</span>
                    {pending > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-display font-bold text-destructive">{pending} {lang === "id" ? "perlu nilai" : "to grade"}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            {currentAssignment ? (
              <AssignmentDetail assignment={currentAssignment} onDelete={() => { if (confirm(`${t("delete")}?`)) { deleteMut.mutate(currentAssignment.id); setSelected(null); } }} />
            ) : (
              <EmptyState message={lang === "id" ? "Pilih tugas untuk melihat pengumpulan" : "Select an assignment to view submissions"} />
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function AssignmentDetail({ assignment, onDelete }: { assignment: any; onDelete: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
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

  const gradeMut = useMutation({
    mutationFn: async ({ id, score, feedback }: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase.from("submissions").update({ status: "graded", score, feedback }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "id" ? "Nilai disimpan" : "Grade saved"); qc.invalidateQueries({ queryKey: ["submissions", assignment.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2"><ScrollText className="size-5 text-guru" />{assignment.title}</h2>
          {assignment.description && <p className="mt-1 text-sm text-muted-foreground">{assignment.description}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
      </div>

      <h3 className="mt-4 mb-2 font-display font-bold text-sm">{t("submissions")} ({subs.length})</h3>
      {subs.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="space-y-2">
          {subs.map((s: any) => <GradeRow key={s.id} sub={s} maxScore={assignment.max_score} onGrade={(score, fb) => gradeMut.mutate({ id: s.id, score, feedback: fb })} />)}
        </div>
      )}
    </div>
  );
}

function GradeRow({ sub, maxScore, onGrade }: { sub: any; maxScore: number; onGrade: (score: number, feedback: string) => void }) {
  const { t } = useLang();
  const [score, setScore] = useState<number | "">(sub.score ?? "");
  const [fb, setFb] = useState(sub.feedback ?? "");
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display font-semibold">{sub.profile?.full_name ?? "—"}</div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-display font-bold ${sub.status === "graded" ? "bg-xp/20 text-xp" : "bg-primary/15 text-primary"}`}>{sub.status === "graded" ? t("graded") : t("submitted")}</span>
      </div>
      {sub.content && <p className="mt-2 whitespace-pre-wrap text-sm">{sub.content}</p>}
      {sub.file_url && <a href={sub.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">📎 {sub.file_url}</a>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px,1fr,auto] sm:items-end">
        <div>
          <Label className="text-xs">{t("score")} / {maxScore}</Label>
          <Input type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value === "" ? "" : +e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t("feedback")}</Label>
          <Input value={fb} onChange={(e) => setFb(e.target.value)} />
        </div>
        <Button variant="guru" size="sm" disabled={score === ""} onClick={() => onGrade(Number(score), fb)}>{t("giveGrade")}</Button>
      </div>
    </div>
  );
}
