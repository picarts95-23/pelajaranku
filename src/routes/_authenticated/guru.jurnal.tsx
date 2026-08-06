import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, NotebookPen, Pencil, Plus, Trash2, User } from "lucide-react";
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
import { ExportMenu } from "@/components/export-menu";

export const Route = createFileRoute("/_authenticated/guru/jurnal")({
  head: () => ({ meta: [{ title: "Jurnal · Pelajaranku" }] }),
  component: GuruJurnalPage,
});

const SUBJECTS = [
  "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "Fisika", "Kimia",
  "Biologi", "IPS", "Sejarah", "Geografi", "Ekonomi", "PKn", "Informatika",
  "Pendidikan Agama Islam", "Al-Qur'an Hadits", "Akidah Akhlak", "Fikih", "SKI",
  "Bahasa Arab", "PJOK", "Seni Budaya", "Prakarya",
];

const ALL_STUDENTS = "__all__";

type JForm = { class_id: string; subject: string; student_id: string; date: string; topic: string; notes: string };
const emptyForm = (): JForm => ({ class_id: "", subject: "", student_id: ALL_STUDENTS, date: new Date().toISOString().slice(0, 10), topic: "", notes: "" });

// Students enrolled in the selected class (synced with class members).
// class_enrollments.student_id references auth.users (not profiles), so we
// fetch the enrollment ids first and then resolve their profiles separately.
function useClassStudents(classId: string) {
  return useQuery({
    queryKey: ["jurnal-students", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", classId);
      const ids = (enr ?? []).map((e: any) => e.student_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return (profs ?? [])
        .filter(Boolean)
        .sort((a: any, b: any) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "id", { sensitivity: "base" }));
    },
  });
}

function GuruJurnalPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JForm>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<JForm>(emptyForm());

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: classStudents = [] } = useClassStudents(form.class_id);
  const { data: editStudents = [] } = useClassStudents(editForm.class_id);

  const { data: journals = [] } = useQuery({
    queryKey: ["journals", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("journals").select("*, classes(name), profiles(full_name)").order("date", { ascending: false })).data ?? [],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.class_id || !form.topic.trim()) throw new Error(t("required"));
      const { error } = await supabase.from("journals").insert({
        teacher_id: user.id,
        class_id: form.class_id,
        subject: form.subject || null,
        student_id: form.student_id === ALL_STUDENTS ? null : form.student_id,
        date: form.date,
        topic: form.topic.trim(),
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Jurnal ditambah" : "Journal added");
      setOpen(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editId || !editForm.class_id || !editForm.topic.trim()) throw new Error(t("required"));
      const { error } = await supabase.from("journals").update({
        class_id: editForm.class_id,
        subject: editForm.subject || null,
        student_id: editForm.student_id === ALL_STUDENTS ? null : editForm.student_id,
        date: editForm.date,
        topic: editForm.topic.trim(),
        notes: editForm.notes.trim() || null,
      }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Jurnal diperbarui" : "Journal updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (j: any) => {
    setEditId(j.id);
    setEditForm({
      class_id: j.class_id ?? "",
      subject: j.subject ?? "",
      student_id: j.student_id ?? ALL_STUDENTS,
      date: j.date,
      topic: j.topic ?? "",
      notes: j.notes ?? "",
    });
  };

  const duplicate = (j: any) => {
    setForm({
      class_id: j.class_id ?? "",
      subject: j.subject ?? "",
      student_id: j.student_id ?? ALL_STUDENTS,
      date: new Date().toISOString().slice(0, 10),
      topic: `${j.topic ?? ""}${lang === "id" ? " (salinan)" : " (copy)"}`,
      notes: j.notes ?? "",
    });
    setOpen(true);
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("journals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journals"] }),
  });


  const exportColumns = [
    { key: "date", header: lang === "id" ? "Tanggal" : "Date" },
    { key: "class", header: lang === "id" ? "Kelas" : "Class" },
    { key: "subject", header: lang === "id" ? "Mata Pelajaran" : "Subject" },
    { key: "student", header: lang === "id" ? "Siswa" : "Student" },
    { key: "topic", header: lang === "id" ? "Topik" : "Topic" },
    { key: "notes", header: lang === "id" ? "Catatan" : "Notes" },
  ];
  const exportRows = () => journals.map((j: any) => ({
    date: format(new Date(j.date), "dd MMM yyyy"),
    class: j.classes?.name ?? "—",
    subject: j.subject ?? "—",
    student: j.profiles?.full_name ?? (lang === "id" ? "Semua siswa" : "All students"),
    topic: j.topic,
    notes: j.notes ?? "",
  }));

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navJournal")} subtitle={lang === "id" ? "Catat materi & refleksi pembelajaran" : "Log lesson topics & reflections"}
        actions={
          <div className="flex flex-wrap gap-2">
            {journals.length > 0 && (
              <ExportMenu filename="jurnal" title={lang === "id" ? "Jurnal Mengajar" : "Teaching Journal"} columns={exportColumns} rows={exportRows} />
            )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(emptyForm()); }}>
            <DialogTrigger asChild><Button variant="guru" onClick={() => setForm(emptyForm())}><Plus className="size-4" /> {t("newJournal")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newJournal")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("navClasses")}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v, student_id: ALL_STUDENTS })}>
                    <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("subject")}</Label>
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                    <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih mata pelajaran" : "Select a subject"} /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("selectStudent")}</Label>
                  <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })} disabled={!form.class_id}>
                    <SelectTrigger><SelectValue placeholder={form.class_id ? t("selectStudent") : t("selectClass")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STUDENTS}>{lang === "id" ? "Semua siswa (kelas)" : "All students (class)"}</SelectItem>
                      {classStudents.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.class_id && classStudents.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Belum ada siswa di kelas ini." : "No students in this class yet."}</p>
                  )}
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
          </div>
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
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{j.classes?.name}</span>
                      {j.subject && <><span>·</span><span className="rounded-full bg-muted px-2 py-0.5 font-display">{j.subject}</span></>}
                      <span>·</span><span>{format(new Date(j.date), "dd MMM yyyy")}</span>
                    </div>
                    {j.profiles?.full_name && (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-display font-semibold text-primary">
                        <User className="size-3" /> {j.profiles.full_name}
                      </div>
                    )}
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
