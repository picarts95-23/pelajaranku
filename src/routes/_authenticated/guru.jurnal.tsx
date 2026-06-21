import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/guru/jurnal")({
  head: () => ({ meta: [{ title: "Jurnal · EduQuest" }] }),
  component: GuruJurnalPage,
});

function GuruJurnalPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", date: new Date().toISOString().slice(0, 10), topic: "", notes: "" });

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: journals = [] } = useQuery({
    queryKey: ["journals", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("journals").select("*, classes(name)").order("date", { ascending: false })).data ?? [],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.class_id || !form.topic) throw new Error(t("required"));
      const { error } = await supabase.from("journals").insert({ teacher_id: user.id, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Jurnal ditambah" : "Journal added");
      setOpen(false); setForm({ class_id: "", date: new Date().toISOString().slice(0, 10), topic: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("journals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journals"] }),
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navJournal")} subtitle={lang === "id" ? "Catat materi & refleksi pembelajaran" : "Log lesson topics & reflections"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newJournal")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newJournal")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("navClasses")}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>{t("topic")}</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
                <div><Label>{t("notes")}</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      {journals.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="space-y-3">
          {journals.map((j: any) => (
            <div key={j.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-gradient-magic text-white"><NotebookPen className="size-4" /></div>
                  <div>
                    <div className="font-display font-bold">{j.topic}</div>
                    <div className="text-xs text-muted-foreground">{j.classes?.name} · {format(new Date(j.date), "dd MMM yyyy")}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(j.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
              {j.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{j.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
