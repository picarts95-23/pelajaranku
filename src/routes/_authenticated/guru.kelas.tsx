import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, Plus, Trash2, Users, Search, UserPlus, X, Loader2 } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Kelas · EduQuest Academy" }] }),
  component: GuruKelasPage,
});

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

interface ClassRow {
  id: string;
  name: string;
  code: string;
  subject: string | null;
  academic_year: string | null;
  description: string | null;
  class_enrollments?: { count: number }[];
}

function GuruKelasPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", academic_year: "", description: "" });
  const [manageClass, setManageClass] = useState<ClassRow | null>(null);

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
      return (data ?? []) as ClassRow[];
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
        subtitle={lang === "id" ? "Kelola kelas, undang siswa, dan atur anggota" : "Manage classes, invite students, and manage members"}
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
          {classes.map((c) => (
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
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setManageClass(c)}>
                    <Users className="size-4" /> {lang === "id" ? "Anggota" : "Members"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(c.id); }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ManageMembersDialog
        klass={manageClass}
        onClose={() => setManageClass(null)}
      />
    </DashboardShell>
  );
}

interface StudentProfile {
  id: string;
  full_name: string;
  class_name: string | null;
  school_id_number: string | null;
}

function ManageMembersDialog({ klass, onClose }: { klass: ClassRow | null; onClose: () => void }) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const enrolledQ = useQuery({
    queryKey: ["enrollments", klass?.id],
    enabled: !!klass,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("class_enrollments")
        .select("id, student_id, joined_at")
        .eq("class_id", klass!.id);
      if (error) throw error;
      const enrollments = rows ?? [];
      const ids = enrollments.map((r) => r.student_id);
      let profiles: StudentProfile[] = [];
      if (ids.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, class_name, school_id_number")
          .in("id", ids);
        if (pErr) throw pErr;
        profiles = (profs ?? []) as StudentProfile[];
      }
      const map = new Map(profiles.map((p) => [p.id, p]));
      return enrollments.map((e) => ({
        id: e.id,
        student_id: e.student_id,
        profiles: map.get(e.student_id) ?? null,
      }));
    },
  });

  const enrolledIds = useMemo(
    () => new Set((enrolledQ.data ?? []).map((e) => e.student_id)),
    [enrolledQ.data]
  );

  // Search students (only those with role 'siswa') matching name / school id
  const searchQ = useQuery({
    queryKey: ["student-search", klass?.id, search],
    enabled: !!klass && search.trim().length >= 2,
    queryFn: async () => {
      const term = search.trim();
      // Get user ids with siswa role
      const { data: roles, error: rErr } = await supabase
        .from("user_roles").select("user_id").eq("role", "siswa");
      if (rErr) throw rErr;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as StudentProfile[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, class_name, school_id_number")
        .in("id", ids)
        .or(`full_name.ilike.%${term}%,school_id_number.ilike.%${term}%`)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as StudentProfile[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (studentId: string) => {
      if (!klass) throw new Error("no class");
      const { error } = await supabase
        .from("class_enrollments")
        .insert({ class_id: klass.id, student_id: studentId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Siswa ditambahkan" : "Student added");
      qc.invalidateQueries({ queryKey: ["enrollments", klass?.id] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from("class_enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Siswa dikeluarkan" : "Student removed");
      qc.invalidateQueries({ queryKey: ["enrollments", klass?.id] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyJoinInfo = () => {
    if (!klass) return;
    const text = lang === "id"
      ? `Gabung kelas "${klass.name}" di EduQuest Academy dengan kode: ${klass.code}`
      : `Join class "${klass.name}" on EduQuest Academy with code: ${klass.code}`;
    navigator.clipboard.writeText(text);
    toast.success(lang === "id" ? "Undangan disalin" : "Invite copied");
  };

  return (
    <Dialog open={!!klass} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {lang === "id" ? "Anggota Kelas" : "Class Members"} · {klass?.name}
          </DialogTitle>
        </DialogHeader>

        {/* Invite block */}
        <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {lang === "id" ? "Kode Gabung" : "Join Code"}
              </div>
              <div className="font-mono text-2xl font-bold tracking-widest">{klass?.code}</div>
            </div>
            <Button variant="outline" size="sm" onClick={copyJoinInfo}>
              <Copy className="size-4" /> {lang === "id" ? "Salin Undangan" : "Copy Invite"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {lang === "id"
              ? "Siswi dapat menggabungkan diri di menu Kelas mereka menggunakan kode ini."
              : "Students can self-join from their Classes menu using this code."}
          </p>
        </div>

        {/* Add by search */}
        <div>
          <Label className="mb-1.5 block">
            {lang === "id" ? "Daftarkan siswa langsung" : "Enroll students directly"}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "id" ? "Cari nama atau NIS…" : "Search name or student ID…"}
              className="pl-9"
            />
          </div>
          {search.trim().length >= 2 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border-2 border-border">
              {searchQ.isLoading ? (
                <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {lang === "id" ? "Mencari…" : "Searching…"}
                </div>
              ) : (searchQ.data ?? []).length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {lang === "id" ? "Tidak ada hasil" : "No results"}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {(searchQ.data ?? []).map((s) => {
                    const already = enrolledIds.has(s.id);
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate font-display text-sm font-semibold">{s.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.class_name ?? "—"} {s.school_id_number ? `· ${s.school_id_number}` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={already ? "ghost" : "siswa"}
                          disabled={already || addMut.isPending}
                          onClick={() => addMut.mutate(s.id)}
                        >
                          {already ? (
                            lang === "id" ? "Sudah anggota" : "Enrolled"
                          ) : (
                            <><UserPlus className="size-4" /> {lang === "id" ? "Tambah" : "Add"}</>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Member list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>
              {lang === "id" ? "Daftar Anggota" : "Member List"} ({enrolledQ.data?.length ?? 0})
            </Label>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-border">
            {enrolledQ.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {lang === "id" ? "Memuat…" : "Loading…"}
              </div>
            ) : (enrolledQ.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {lang === "id" ? "Belum ada anggota di kelas ini." : "No members yet in this class."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(enrolledQ.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm font-semibold">
                        {e.profiles?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.profiles?.class_name ?? "—"}
                        {e.profiles?.school_id_number ? ` · ${e.profiles.school_id_number}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeMut.isPending}
                      onClick={() => {
                        if (confirm(lang === "id" ? "Keluarkan siswa ini?" : "Remove this student?"))
                          removeMut.mutate(e.id);
                      }}
                    >
                      <X className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "id" ? "Selesai" : "Done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
