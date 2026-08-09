import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2, CalendarRange, Pencil } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/guru/rpp")({
  head: () => ({ meta: [{ title: "RPP Pekanan · Pelajaranku" }] }),
  component: GuruRppPage,
});

type RForm = {
  id?: string;
  class_id: string;
  subject: string;
  week_label: string;
  start_date: string;
  end_date: string;
  objectives: string;
  materials: string;
  methods: string;
  media: string;
  assessment: string;
  notes: string;
};

const emptyForm = (): RForm => {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 6);
  return {
    class_id: "",
    subject: "",
    week_label: "",
    start_date: today.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    objectives: "",
    materials: "",
    methods: "",
    media: "",
    assessment: "",
    notes: "",
  };
};

function GuruRppPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RForm>(emptyForm());

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  // Prefill from a Prota/Prosem row ("Buat RPP dari baris ini").
  useEffect(() => {
    const p = takeProgramPrefill("rpp");
    if (!p) return;
    const start = programItemDate({ month: p.month, weeks: p.weeks, academic_year: p.academic_year });
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    setForm({
      ...emptyForm(),
      class_id: p.class_id ?? "",
      subject: p.subject ?? "",
      week_label: p.month ? `${p.month}${p.weeks ? ` pekan ${p.weeks}` : ""} — ${p.material}` : p.material,
      start_date: start,
      end_date: end.toISOString().slice(0, 10),
      objectives: p.material,
      materials: p.material,
      notes: [p.sourceTitle, p.note, p.hours ? `Alokasi ${p.hours} jam` : null].filter(Boolean).join(" · "),
    });
    setOpen(true);
    toast.info(lang === "id" ? "RPP diisi otomatis dari program — silakan sesuaikan." : "Plan prefilled from the program — adjust as needed.");
  }, []);


  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subjects, subject").order("name")).data ?? [],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["lesson-plans", user?.id], enabled: !!user,
    queryFn: async () => (await (supabase as any).from("lesson_plans").select("*, classes(name)").order("start_date", { ascending: false })).data ?? [],
  });

  // Subjects for the selected class only (its subjects[] + legacy subject).
  const classSubjects = useMemo(() => {
    const cls = (classes as any[]).find((c) => c.id === form.class_id);
    const set = new Set<string>();
    if (cls) {
      (cls.subjects as string[] | null ?? []).forEach((s) => { if (s) set.add(s); });
      if (cls.subject) set.add(cls.subject);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }));
  }, [classes, form.class_id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas" : "Select a class");
      if (!form.subject) throw new Error(lang === "id" ? "Pilih mata pelajaran" : "Select a subject");
      if (!form.objectives.trim()) throw new Error(lang === "id" ? "Isi tujuan pembelajaran" : "Fill in learning objectives");
      const payload = {
        teacher_id: user.id,
        class_id: form.class_id,
        subject: form.subject,
        week_label: form.week_label.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        objectives: form.objectives.trim(),
        materials: form.materials.trim() || null,
        methods: form.methods.trim() || null,
        media: form.media.trim() || null,
        assessment: form.assessment.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await (supabase as any).from("lesson_plans").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("lesson_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? (lang === "id" ? "RPP diperbarui" : "Plan updated") : (lang === "id" ? "RPP ditambah" : "Plan added"));
      setOpen(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["lesson-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("lesson_plans").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lesson-plans"] }),
  });

  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      class_id: p.class_id ?? "",
      subject: p.subject ?? "",
      week_label: p.week_label ?? "",
      start_date: p.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: p.end_date ?? "",
      objectives: p.objectives ?? "",
      materials: p.materials ?? "",
      methods: p.methods ?? "",
      media: p.media ?? "",
      assessment: p.assessment ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const exportColumns = [
    { key: "week", header: lang === "id" ? "Pekan" : "Week" },
    { key: "class", header: lang === "id" ? "Kelas" : "Class" },
    { key: "subject", header: lang === "id" ? "Mata Pelajaran" : "Subject" },
    { key: "range", header: lang === "id" ? "Tanggal" : "Date range" },
    { key: "objectives", header: lang === "id" ? "Tujuan" : "Objectives" },
    { key: "materials", header: lang === "id" ? "Materi" : "Materials" },
    { key: "methods", header: lang === "id" ? "Metode" : "Methods" },
    { key: "assessment", header: lang === "id" ? "Penilaian" : "Assessment" },
  ];
  const exportRows = () => (plans as any[]).map((p) => ({
    week: p.week_label ?? "—",
    class: p.classes?.name ?? "—",
    subject: p.subject ?? "—",
    range: `${format(new Date(p.start_date), "dd MMM")}${p.end_date ? " – " + format(new Date(p.end_date), "dd MMM yyyy") : ""}`,
    objectives: p.objectives ?? "",
    materials: p.materials ?? "",
    methods: p.methods ?? "",
    assessment: p.assessment ?? "",
  }));

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navRPP")}
        subtitle={lang === "id" ? "Susun rencana pembelajaran pekanan per kelas & mata pelajaran" : "Plan weekly lessons per class & subject"}
        actions={
          <div className="flex flex-wrap gap-2">
            {plans.length > 0 && (
              <ExportMenu filename="rpp-pekanan" title={lang === "id" ? "RPP Pekanan" : "Weekly Lesson Plans"} columns={exportColumns} rows={exportRows} />
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !form.id) setForm(emptyForm()); if (!o) setForm(emptyForm()); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "RPP Baru" : "New Plan"}</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{form.id ? (lang === "id" ? "Edit RPP" : "Edit Plan") : (lang === "id" ? "RPP Pekanan Baru" : "New Weekly Plan")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>{t("navClasses")}</Label>
                    <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v, subject: "" })}>
                      <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                      <SelectContent>{(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("subject")}</Label>
                    <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })} disabled={!form.class_id}>
                      <SelectTrigger><SelectValue placeholder={form.class_id ? (lang === "id" ? "Pilih mata pelajaran" : "Select subject") : t("selectClass")} /></SelectTrigger>
                      <SelectContent>{classSubjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.class_id && classSubjects.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{lang === "id" ? "Kelas ini belum punya mata pelajaran. Tambahkan di menu Kelas." : "This class has no subjects yet. Add them in Classes."}</p>
                    )}
                  </div>
                  <div><Label>{lang === "id" ? "Pekan / Judul" : "Week / Title"}</Label>
                    <Input placeholder={lang === "id" ? "cth. Pekan 1 — Aljabar Dasar" : "e.g. Week 1 — Basic Algebra"} value={form.week_label} onChange={(e) => setForm({ ...form, week_label: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{lang === "id" ? "Mulai" : "Start"}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                    <div><Label>{lang === "id" ? "Selesai" : "End"}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  </div>
                  <div><Label>{lang === "id" ? "Tujuan Pembelajaran" : "Learning Objectives"}</Label><Textarea rows={3} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></div>
                  <div><Label>{lang === "id" ? "Materi Pokok" : "Main Materials"}</Label><Textarea rows={2} value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} /></div>
                  <div><Label>{lang === "id" ? "Metode & Kegiatan" : "Methods & Activities"}</Label><Textarea rows={2} value={form.methods} onChange={(e) => setForm({ ...form, methods: e.target.value })} /></div>
                  <div><Label>{lang === "id" ? "Media & Sumber Belajar" : "Media & Resources"}</Label><Textarea rows={2} value={form.media} onChange={(e) => setForm({ ...form, media: e.target.value })} /></div>
                  <div><Label>{lang === "id" ? "Penilaian" : "Assessment"}</Label><Textarea rows={2} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} /></div>
                  <div><Label>{t("notes")}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button variant="guru" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>{t("save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      {plans.length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada RPP. Buat rencana pembelajaran pekanan pertamamu." : "No lesson plans yet. Create your first weekly plan."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(plans as any[]).map((p) => (
            <div key={p.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-magic text-white"><NotebookPen className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="font-display font-bold">{p.week_label || (lang === "id" ? "RPP Pekanan" : "Weekly Plan")}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{p.classes?.name}</span>
                      {p.subject && <><span>·</span><span className="rounded-full bg-muted px-2 py-0.5 font-display">{p.subject}</span></>}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarRange className="size-3" />
                      {format(new Date(p.start_date), "dd MMM")}{p.end_date ? ` – ${format(new Date(p.end_date), "dd MMM yyyy")}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(p.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <Field label={lang === "id" ? "Tujuan" : "Objectives"} value={p.objectives} />
                <Field label={lang === "id" ? "Materi" : "Materials"} value={p.materials} />
                <Field label={lang === "id" ? "Metode & Kegiatan" : "Methods"} value={p.methods} />
                <Field label={lang === "id" ? "Media & Sumber" : "Media"} value={p.media} />
                <Field label={lang === "id" ? "Penilaian" : "Assessment"} value={p.assessment} />
                <Field label={t("notes")} value={p.notes} />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap text-foreground/85">{value}</p>
    </div>
  );
}
