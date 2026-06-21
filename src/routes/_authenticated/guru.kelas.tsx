import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/kelas")({
  head: () => ({ meta: [{ title: "Kelas · EduQuest Madrasah" }] }),
  component: GuruKelasPage,
});

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function GuruKelasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", academic_year: "", description: "" });

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes").select("*, class_enrollments(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: typeof form) => {
      if (!user) throw new Error("not signed in");
      const { error } = await supabase.from("classes").insert({
        teacher_id: user.id, name: payload.name, code: genCode(),
        subject: payload.subject || null, academic_year: payload.academic_year || null,
        description: payload.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kelas dibuat" : "Class created");
      setOpen(false); setForm({ name: "", subject: "", academic_year: "", description: "" });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kelas dihapus" : "Class deleted");
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navClasses")}
        subtitle={lang === "id" ? "Kelola kelas dan kode gabung untuk siswa" : "Manage classes and join codes for students"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="guru"><Plus className="size-4" /> {t("newClass")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newClass")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("className2")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VIII-A" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("subject")}</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Matematika" /></div>
                  <div><Label>{t("academicYear")}</Label><Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2025/2026" /></div>
                </div>
                <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={!form.name || createMut.isPending} onClick={() => createMut.mutate(form)}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {classes.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c: any) => (
            <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="grid size-12 place-items-center rounded-xl bg-gradient-magic text-white shadow-soft">
                  <BookOpen className="size-5" />
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(c.code); toast.success(t("codeCopied")); }}
                  className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-mono text-xs font-bold hover:bg-muted/70"
                  title={t("copyCode")}
                >
                  {c.code} <Copy className="size-3" />
                </button>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold">{c.name}</h3>
              <div className="text-xs text-muted-foreground">{c.subject ?? "—"} · {c.academic_year ?? "—"}</div>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{c.description}</p>}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" /> {c.class_enrollments?.[0]?.count ?? 0} {t("members").toLowerCase()}
                </div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(c.id); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
