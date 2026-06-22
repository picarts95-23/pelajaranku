import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Plus, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/kelas")({
  head: () => ({ meta: [{ title: "Kelas Saya · EduQuest Academy" }] }),
  component: SiswaKelasPage,
});

function SiswaKelasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-classes", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("class_enrollments")
        .select("id, joined_at, classes(*)")
        .eq("student_id", user!.id)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      const classes = (rows ?? []).map((r: any) => r.classes).filter(Boolean);
      const teacherIds = Array.from(new Set(classes.map((c: any) => c.teacher_id).filter(Boolean)));
      let teachers: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
        teachers = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (rows ?? []).map((r: any) => ({
        ...r,
        teacherName: teachers[r.classes?.teacher_id] ?? "—",
      }));
    },
  });

  const joinMut = useMutation({
    mutationFn: async () => {
      if (!user || !code) throw new Error(t("required"));
      const { data: cls, error: e1 } = await supabase.from("classes").select("id").eq("code", code.trim().toUpperCase()).maybeSingle();
      if (e1 || !cls) throw new Error(lang === "id" ? "Kode kelas tidak ditemukan" : "Class code not found");
      const { error } = await supabase.from("class_enrollments").insert({ class_id: cls.id, student_id: user.id });
      if (error) {
        if (error.code === "23505") throw new Error(lang === "id" ? "Anda sudah tergabung" : "You are already enrolled");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Berhasil bergabung!" : "Joined successfully!");
      setOpen(false); setCode("");
      qc.invalidateQueries({ queryKey: ["my-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_enrollments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Keluar kelas" : "Left class"); qc.invalidateQueries({ queryKey: ["my-classes"] }); },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("myClasses")} subtitle={lang === "id" ? "Kelas tempat kamu menuntut ilmu" : "Classes where you study"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="quest"><Plus className="size-4" /> {t("joinClass")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("joinClass")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{lang === "id" ? "Mintalah kode kelas dari guru kamu." : "Ask your teacher for the class code."}</p>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("enterCode")} className="font-mono uppercase" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="quest" disabled={!code || joinMut.isPending} onClick={() => joinMut.mutate()}>{t("joinClass")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      {enrollments.length === 0 ? <EmptyState message={lang === "id" ? "Belum tergabung di kelas manapun. Gunakan kode dari guru!" : "No classes yet. Use a code from your teacher!"} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e: any) => (
            <div key={e.id} className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="grid size-12 place-items-center rounded-xl bg-gradient-hero text-white"><BookOpen className="size-5" /></div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(lang === "id" ? "Keluar dari kelas ini?" : "Leave this class?")) leaveMut.mutate(e.id); }}><LogOut className="size-4 text-destructive" /></Button>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold">{e.classes?.name}</h3>
              <div className="text-xs text-muted-foreground">{e.classes?.subject ?? "—"} · {e.classes?.academic_year ?? "—"}</div>
              {e.classes?.description && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{e.classes.description}</p>}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
