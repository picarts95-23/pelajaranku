import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Database, Plus, Trash2, X } from "lucide-react";
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
  const emptyForm = {
    subject: "",
    topic: "",
    question: "",
    type: "multiple_choice",
    options: ["", "", "", ""] as string[],
    correctIndex: 0,
    answer: "",
    difficulty: "medium",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["qb", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("question_bank").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const setOption = (i: number, v: string) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? v : o)) }));
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, ""] }));
  const removeOption = (i: number) =>
    setForm((f) => {
      const options = f.options.filter((_, idx) => idx !== i);
      const correctIndex = f.correctIndex >= options.length ? Math.max(0, options.length - 1) : f.correctIndex;
      return { ...f, options, correctIndex };
    });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.question.trim()) throw new Error(t("required"));
      let opts: string[] | null = null;
      let answer: string | null = form.answer.trim() || null;
      if (form.type === "multiple_choice") {
        opts = form.options.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) throw new Error(lang === "id" ? "Minimal 2 pilihan jawaban" : "At least 2 answer options");
        const chosen = form.options[form.correctIndex]?.trim();
        if (!chosen) throw new Error(lang === "id" ? "Pilih jawaban yang benar" : "Select the correct answer");
        answer = chosen;
      }
      const { error } = await supabase.from("question_bank").insert({
        teacher_id: user.id, subject: form.subject || null, topic: form.topic || null,
        question: form.question.trim(), type: form.type as any, options: opts,
        answer, difficulty: form.difficulty as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Soal ditambah" : "Question added");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["qb"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("question_bank").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qb"] }),
  });

  const diffColor: Record<string, string> = { easy: "bg-xp/20 text-xp", medium: "bg-coin/20 text-coin", hard: "bg-destructive/20 text-destructive" };

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navQuestionBank")} subtitle={lang === "id" ? "Kumpulan soal untuk quiz & latihan" : "Question pool for quizzes & practice"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newQuestion")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("newQuestion")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("subject")}</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                  <div><Label>{t("topic")}</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
                </div>
                <div><Label>{t("question")}</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("qType")}</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">{t("multipleChoice")}</SelectItem>
                        <SelectItem value="essay">{t("essay")}</SelectItem>
                        <SelectItem value="true_false">{t("trueFalse")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("difficulty")}</Label>
                    <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">{t("easy")}</SelectItem>
                        <SelectItem value="medium">{t("medium")}</SelectItem>
                        <SelectItem value="hard">{t("hard")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.type === "multiple_choice" && (
                  <div><Label>{t("options")}</Label><Textarea rows={4} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="A. ...\nB. ...\nC. ...\nD. ..." /></div>
                )}
                <div><Label>{t("answer")}</Label><Input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      {items.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="space-y-3">
          {items.map((q: any) => (
            <div key={q.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="grid size-10 place-items-center rounded-xl bg-gradient-magic text-white shrink-0"><Database className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {q.subject && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{q.subject}</span>}
                      {q.topic && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{q.topic}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-display font-bold ${diffColor[q.difficulty]}`}>{t(q.difficulty as any)}</span>
                    </div>
                    <p className="mt-2 font-display font-semibold">{q.question}</p>
                    {q.options && <ul className="mt-2 ml-4 list-disc text-sm text-muted-foreground">{(q.options as string[]).map((o, i) => <li key={i}>{o}</li>)}</ul>}
                    {q.answer && <div className="mt-2 text-xs"><span className="font-display font-bold text-xp">{t("answer")}:</span> {q.answer}</div>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(q.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
