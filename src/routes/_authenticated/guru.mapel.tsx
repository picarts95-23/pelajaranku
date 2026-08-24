import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, GraduationCap, Plus, Trash2, ExternalLink, Library, Loader2, CheckCircle2, ChevronDown, ChevronRight, Folder, FolderOpen, BookOpen, Pencil, Copy } from "lucide-react";
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
import { useTeacherSubjects } from "@/components/subject-select";
import { MediaInput, MediaViewer } from "@/components/media-input";
import { ShareMenu } from "@/components/share-menu";

export const Route = createFileRoute("/_authenticated/guru/mapel")({
  head: () => ({ meta: [{ title: "Mata Pelajaran · Pelajaranku" }] }),
  component: GuruMapelPage,
});

type MForm = { class_id: string; subject: string; title: string; description: string; content: string; link: string; media_type: string | null; media_url: string | null };
const emptyForm = (): MForm => ({ class_id: "", subject: "", title: "", description: "", content: "", link: "", media_type: null, media_url: null });


function GuruMapelPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MForm>(emptyForm());
  const [newSubject, setNewSubject] = useState("");
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const toggleClass = (id: string) => setOpenClasses((s) => ({ ...s, [id]: !s[id] }));
  const toggleSubject = (key: string) => setOpenSubjects((s) => ({ ...s, [key]: !s[key] }));

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: subjects = [] } = useTeacherSubjects();

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials-guru", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials").select("*, classes(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Which students have finished reading each material (synced from the student
  // dashboard's "tandai sudah dibaca" action). Teachers can read these rows via
  // the "Teachers view reads of their materials" policy.
  const materialIds = (materials as any[]).map((m) => m.id).join(",");
  const { data: reads = [] } = useQuery({
    queryKey: ["material-reads-guru", materialIds], enabled: !!user && materialIds.length > 0,
    queryFn: async () => {
      const ids = materialIds.split(",").filter(Boolean);
      const { data } = await supabase
        .from("material_reads").select("material_id, user_id, updated_at, note").in("material_id", ids);
      const readerIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const names: Record<string, string> = {};
      if (readerIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", readerIds);
        (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name; });
      }
      return (data ?? []).map((r: any) => ({ ...r, full_name: names[r.user_id] ?? "Siswa" }));
    },
  });

  // Per-class enrollment counts to show "X/Y siswa membaca".
  const { data: enrollCounts = {} } = useQuery({
    queryKey: ["class-enroll-counts", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("class_enrollments").select("class_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((e: any) => { counts[e.class_id] = (counts[e.class_id] ?? 0) + 1; });
      return counts;
    },
  });

  const addSubjectMut = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error(t("required"));
      const { error } = await supabase.from("teacher_subjects").insert({ teacher_id: user!.id, name: trimmed });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => { setNewSubject(""); qc.invalidateQueries({ queryKey: ["teacher-subjects"] }); toast.success(lang === "id" ? "Mapel ditambahkan" : "Subject added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delSubjectMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("teacher_subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-subjects"] }),
  });

  const createMat = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error(t("required"));
      if (!form.class_id) throw new Error(t("selectClass"));
      if (!form.subject) throw new Error(t("selectSubject"));
      const { error } = await supabase.from("materials").insert({
        teacher_id: user.id, class_id: form.class_id, subject: form.subject,
        title: form.title.trim(), description: form.description.trim() || null,
        content: form.content.trim() || null, link: form.link.trim() || null,
        media_type: form.media_url ? form.media_type : null, media_url: form.media_url,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("materialShared")); setOpen(false); setForm(emptyForm()); qc.invalidateQueries({ queryKey: ["materials-guru"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("materials").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("materialDeleted")); qc.invalidateQueries({ queryKey: ["materials-guru"] }); },
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navSubjects")}
        subtitle={t("manageSubjects")}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("shareMaterial")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("newMaterial")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("navClasses")}</Label>
                    <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                      <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("subject")}</Label>
                    <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                      <SelectTrigger><SelectValue placeholder={t("selectSubject")} /></SelectTrigger>
                      <SelectContent>
                        {subjects.length === 0
                          ? <div className="px-3 py-2 text-xs text-muted-foreground">{lang === "id" ? "Tambah mapel dulu di bawah" : "Add a subject below first"}</div>
                          : subjects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>{t("title")} <span className="text-destructive">*</span></Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>{t("content")}</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={lang === "id" ? "Tulis ringkasan / isi materi…" : "Write material content…"} /></div>
                {user && <MediaInput userId={user.id} value={{ media_type: form.media_type, media_url: form.media_url }} onChange={(v) => setForm({ ...form, media_type: v.media_type, media_url: v.media_url })} />}
                <div><Label>{t("link")}</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMat.isPending} onClick={() => createMat.mutate()}>{t("saveShare")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Subjects manager */}
      <div className="mb-6 rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><GraduationCap className="size-5 text-guru" /> {t("mySubjects")}</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {subjects.length === 0 && <span className="text-sm text-muted-foreground">{lang === "id" ? "Belum ada mapel." : "No subjects yet."}</span>}
          {subjects.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border-2 border-guru/40 bg-guru/10 px-3 py-1 text-sm font-display font-semibold text-guru">
              <BookMarked className="size-3.5" /> {s.name}
              <button onClick={() => delSubjectMut.mutate(s.id)} aria-label="hapus" className="ml-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubjectMut.mutate(newSubject); } }}
            placeholder={lang === "id" ? "Nama mapel baru…" : "New subject…"}
            className="max-w-xs"
          />
          <Button variant="guru" disabled={addSubjectMut.isPending || !newSubject.trim()} onClick={() => addSubjectMut.mutate(newSubject)}>
            {addSubjectMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {lang === "id" ? "Tambah" : "Add"}
          </Button>
        </div>
      </div>

      {/* Materials — structured Class › Subject › Material */}
      <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Library className="size-5 text-quest" /> {t("materials")}</h2>
      {materials.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada materi dibagikan." : "No materials shared yet."} /> : (() => {
        const renderMaterial = (m: any) => {
          const readers = (reads as any[]).filter((r) => r.material_id === m.id);
          const total = enrollCounts[m.class_id] ?? 0;
          return (
            <div key={m.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy")}</span>
                    {m.media_type && <span className="rounded-full bg-quest/15 px-2 py-0.5 text-xs font-display font-bold text-quest capitalize">{m.media_type}</span>}
                  </div>
                  <div className="mt-1.5 font-display font-bold">{m.title}</div>
                  {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                  {m.content && <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>}
                  <MediaViewer mediaType={m.media_type} mediaUrl={m.media_url} />
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-quest/10 px-2.5 py-1 text-xs font-display font-bold text-quest hover:bg-quest/20">
                      <ExternalLink className="size-3.5" /> {t("openLink")}
                    </a>
                  )}
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-display font-bold text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      {lang === "id" ? "Sudah membaca" : "Read"}: {readers.length}{total ? `/${total}` : ""} {lang === "id" ? "siswa" : "students"}
                    </div>
                    {readers.length > 0 && (
                      <div className="mt-1.5 space-y-1.5">
                        {readers.map((r) => (
                          <div key={r.user_id} className="rounded-lg bg-emerald-500/5 px-2 py-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              <CheckCircle2 className="size-3" /> {r.full_name}
                            </span>
                            {r.note && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">
                                <span className="font-display font-semibold text-muted-foreground">{lang === "id" ? "Catatan: " : "Note: "}</span>
                                {r.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) delMat.mutate(m.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          );
        };

        // Group materials by class, then by subject.
        const groups = (classes as any[]).map((c) => {
          const mats = (materials as any[]).filter((m) => m.class_id === c.id);
          const subjMap: Record<string, any[]> = {};
          mats.forEach((m) => { const s = m.subject || (lang === "id" ? "Umum" : "General"); (subjMap[s] ||= []).push(m); });
          return { cls: c, mats, subjects: Object.entries(subjMap) };
        }).filter((g) => g.mats.length > 0);
        // Orphan materials whose class was deleted.
        const orphan = (materials as any[]).filter((m) => !(classes as any[]).some((c) => c.id === m.class_id));

        return (
          <div className="space-y-3">
            {groups.map(({ cls, mats, subjects }) => {
              const classOpen = openClasses[cls.id] ?? false;
              return (
                <div key={cls.id} className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card-rpg">
                  <button type="button" onClick={() => toggleClass(cls.id)} className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted/40">
                    {classOpen ? <FolderOpen className="size-5 text-guru" /> : <Folder className="size-5 text-guru" />}
                    <span className="font-display text-base font-bold">{cls.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{subjects.length} {lang === "id" ? "mapel" : "subjects"} · {mats.length} {lang === "id" ? "materi" : "materials"}</span>
                    {classOpen ? <ChevronDown className="ml-auto size-4 text-muted-foreground" /> : <ChevronRight className="ml-auto size-4 text-muted-foreground" />}
                  </button>
                  {classOpen && (
                    <div className="space-y-2 border-t-2 border-border bg-muted/20 p-3">
                      {subjects.map(([subj, subjMats]) => {
                        const sKey = `${cls.id}::${subj}`;
                        const subjOpen = openSubjects[sKey] ?? false;
                        return (
                          <div key={sKey} className="overflow-hidden rounded-xl border border-border bg-card">
                            <button type="button" onClick={() => toggleSubject(sKey)} className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40">
                              <BookOpen className="size-4 text-guru" />
                              <span className="font-display text-sm font-bold text-guru">{subj}</span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-display">{(subjMats as any[]).length}</span>
                              {subjOpen ? <ChevronDown className="ml-auto size-4 text-muted-foreground" /> : <ChevronRight className="ml-auto size-4 text-muted-foreground" />}
                            </button>
                            {subjOpen && <div className="space-y-2 border-t border-border p-3">{(subjMats as any[]).map(renderMaterial)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {orphan.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-display font-bold text-muted-foreground">{lang === "id" ? "Materi tanpa kelas" : "Unassigned materials"}</p>
                {orphan.map(renderMaterial)}
              </div>
            )}
          </div>
        );
      })()}
    </DashboardShell>
  );
}
