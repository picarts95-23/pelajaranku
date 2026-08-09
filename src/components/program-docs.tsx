import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, CalendarRange, Copy, FileSpreadsheet, NotebookPen, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard-shell";
import { SubjectSelect } from "@/components/subject-select";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAnnualTemplate,
  buildSemesterTemplate,
  hasSubjectPreset,
  stashProgramPrefill,
} from "@/lib/program-templates";


export type ProgramKind = "annual" | "semester";

const TABLE: Record<ProgramKind, "annual_programs" | "semester_programs"> = {
  annual: "annual_programs",
  semester: "semester_programs",
};

const MONTHS = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
];

export type ProgramItem = {
  material: string;
  hours: string;
  /** annual only: 1 | 2 */
  semester?: string;
  /** semester only */
  month?: string;
  weeks?: string;
  note?: string;
};

type Form = {
  class_id: string;
  subject: string;
  academic_year: string;
  semester: string;
  title: string;
  notes: string;
  items: ProgramItem[];
};

const emptyItem = (kind: ProgramKind): ProgramItem =>
  kind === "annual"
    ? { semester: "1", material: "", hours: "", note: "" }
    : { material: "", hours: "", month: MONTHS[0], weeks: "", note: "" };

const defaultYear = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
};

const emptyForm = (kind: ProgramKind): Form => ({
  class_id: "",
  subject: "",
  academic_year: defaultYear(),
  semester: "1",
  title: kind === "annual" ? "Program Tahunan" : "Program Semester",
  notes: "",
  items: [emptyItem(kind)],
});

/**
 * CRUD panel for Program Tahunan (annual) / Program Semester (semester) documents.
 * Every saved document stays fully editable, including its detail rows.
 */
export function ProgramPanel({ kind }: { kind: ProgramKind }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const table = TABLE[kind];
  const isAnnual = kind === "annual";

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(kind));

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: docs = [] } = useQuery({
    queryKey: [table, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const payload = () => ({
    teacher_id: user!.id,
    class_id: form.class_id || null,
    subject: form.subject || null,
    academic_year: form.academic_year.trim() || null,
    title: form.title.trim() || (isAnnual ? "Program Tahunan" : "Program Semester"),
    notes: form.notes.trim() || null,
    items: form.items.filter((i) => i.material.trim()) as any,
    ...(isAnnual ? {} : { semester: Number(form.semester) || 1 }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(lang === "id" ? "Belum masuk" : "Not signed in");
      if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas dahulu" : "Choose a class first");
      if (editId) {
        const { teacher_id: _t, ...rest } = payload();
        const { error } = await supabase.from(table).update(rest as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload() as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Dokumen disimpan" : "Document saved");
      setOpen(false);
      setEditId(null);
      setForm(emptyForm(kind));
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toForm = (d: any, copy = false): Form => ({
    class_id: d.class_id ?? "",
    subject: d.subject ?? "",
    academic_year: d.academic_year ?? defaultYear(),
    semester: String(d.semester ?? 1),
    title: copy ? `${d.title}${lang === "id" ? " (salinan)" : " (copy)"}` : (d.title ?? ""),
    notes: d.notes ?? "",
    items: Array.isArray(d.items) && d.items.length ? (d.items as ProgramItem[]) : [emptyItem(kind)],
  });

  const openNew = () => { setEditId(null); setForm(emptyForm(kind)); setOpen(true); };
  const openEdit = (d: any) => { setEditId(d.id); setForm(toForm(d)); setOpen(true); };
  const duplicate = (d: any) => { setEditId(null); setForm(toForm(d, true)); setOpen(true); };

  const setItem = (idx: number, patch: Partial<ProgramItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem(kind)] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  /** Fill the row list from an auto template based on subject + semester. */
  const applyTemplate = () => {
    if (!form.subject) {
      toast.error(lang === "id" ? "Pilih mata pelajaran dahulu" : "Choose a subject first");
      return;
    }
    const filled = form.items.some((i) => i.material.trim());
    if (filled && !confirm(lang === "id" ? "Ganti semua baris dengan template?" : "Replace all rows with the template?")) return;
    const items = isAnnual
      ? buildAnnualTemplate({ subject: form.subject })
      : buildSemesterTemplate({ subject: form.subject, semester: (Number(form.semester) === 2 ? 2 : 1) });
    setForm((f) => ({ ...f, items: items as ProgramItem[] }));
    toast.success(
      hasSubjectPreset(form.subject)
        ? (lang === "id" ? `Template ${form.subject} dimuat — silakan edit` : `${form.subject} template loaded — edit as needed`)
        : (lang === "id" ? "Template umum dimuat — silakan edit" : "Generic template loaded — edit as needed"),
    );
  };

  /** Send a program row to RPP or Kegiatan as prefilled data. */
  const sendTo = (target: "rpp" | "event", d: any, it: ProgramItem) => {
    stashProgramPrefill(target, {
      class_id: d.class_id ?? null,
      subject: d.subject ?? null,
      material: it.material,
      hours: it.hours ?? null,
      note: it.note ?? null,
      month: it.month ?? null,
      weeks: it.weeks ?? null,
      academic_year: d.academic_year ?? null,
      sourceTitle: d.title ?? null,
    });
    navigate({ to: target === "rpp" ? "/guru/rpp" : "/guru/event" });
  };


  const exportColumns = isAnnual
    ? [
        { key: "class", header: "Kelas" }, { key: "subject", header: "Mata Pelajaran" },
        { key: "year", header: "Tahun Ajaran" }, { key: "semester", header: "Semester" },
        { key: "material", header: "Materi / Kompetensi" }, { key: "hours", header: "Alokasi Jam" },
        { key: "note", header: "Keterangan" },
      ]
    : [
        { key: "class", header: "Kelas" }, { key: "subject", header: "Mata Pelajaran" },
        { key: "year", header: "Tahun Ajaran" }, { key: "semester", header: "Semester" },
        { key: "material", header: "Materi / Kompetensi" }, { key: "hours", header: "Alokasi Jam" },
        { key: "month", header: "Bulan" }, { key: "weeks", header: "Pekan" },
        { key: "note", header: "Keterangan" },
      ];

  const exportRows = () =>
    docs.flatMap((d: any) =>
      (Array.isArray(d.items) ? d.items : []).map((it: ProgramItem) => ({
        class: d.classes?.name ?? "—",
        subject: d.subject ?? "—",
        year: d.academic_year ?? "—",
        semester: isAnnual ? (it.semester ?? "—") : String(d.semester ?? "—"),
        material: it.material ?? "",
        hours: it.hours ?? "",
        month: it.month ?? "",
        weeks: it.weeks ?? "",
        note: it.note ?? "",
      })),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isAnnual
            ? lang === "id" ? "Rencana materi satu tahun ajaran per kelas & mata pelajaran." : "Yearly material plan per class & subject."
            : lang === "id" ? "Rincian materi per semester, bulan, dan pekan." : "Semester breakdown per month and week."}
        </p>
        <div className="flex flex-wrap gap-2">
          {docs.length > 0 && (
            <ExportMenu
              filename={isAnnual ? "program-tahunan" : "program-semester"}
              title={isAnnual ? "Program Tahunan" : "Program Semester"}
              columns={exportColumns}
              rows={exportRows}
            />
          )}
          <Button variant="guru" onClick={openNew}>
            <Plus className="size-4" /> {isAnnual ? (lang === "id" ? "Prota Baru" : "New Annual") : (lang === "id" ? "Prosem Baru" : "New Semester")}
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada dokumen." : "No documents yet."} />
      ) : (
        <div className="space-y-3">
          {docs.map((d: any) => {
            const items: ProgramItem[] = Array.isArray(d.items) ? d.items : [];
            const totalHours = items.reduce((s, it) => s + (Number(it.hours) || 0), 0);
            return (
              <div key={d.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-magic text-white">
                      {isAnnual ? <CalendarRange className="size-4" /> : <FileSpreadsheet className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display font-bold">{d.title}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{d.classes?.name ?? "—"}</span>
                        {d.subject && <><span>·</span><span className="rounded-full bg-muted px-2 py-0.5 font-display">{d.subject}</span></>}
                        {d.academic_year && <><span>·</span><span>{d.academic_year}</span></>}
                        {!isAnnual && <><span>·</span><span>{lang === "id" ? "Semester" : "Semester"} {d.semester}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" title={lang === "id" ? "Edit / revisi" : "Edit"} onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" title={lang === "id" ? "Salin" : "Duplicate"} onClick={() => duplicate(d)}><Copy className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(lang === "id" ? "Hapus dokumen ini?" : "Delete this document?")) deleteMut.mutate(d.id); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 -mx-1 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1">#</th>
                          {isAnnual && <th className="px-2 py-1">Smt</th>}
                          <th className="px-2 py-1">{lang === "id" ? "Materi / Kompetensi" : "Material"}</th>
                          <th className="px-2 py-1">{lang === "id" ? "Jam" : "Hours"}</th>
                          {!isAnnual && <th className="px-2 py-1">{lang === "id" ? "Bulan" : "Month"}</th>}
                          {!isAnnual && <th className="px-2 py-1">{lang === "id" ? "Pekan" : "Weeks"}</th>}
                          <th className="px-2 py-1">{lang === "id" ? "Keterangan" : "Note"}</th>
                          <th className="px-2 py-1 text-right">{lang === "id" ? "Kirim ke" : "Send to"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i} className="border-t border-border/60">
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            {isAnnual && <td className="px-2 py-1">{it.semester ?? "—"}</td>}
                            <td className="px-2 py-1 font-medium">{it.material}</td>
                            <td className="px-2 py-1">{it.hours || "—"}</td>
                            {!isAnnual && <td className="px-2 py-1">{it.month || "—"}</td>}
                            {!isAnnual && <td className="px-2 py-1">{it.weeks || "—"}</td>}
                            <td className="px-2 py-1 text-muted-foreground">{it.note || "—"}</td>
                            <td className="px-2 py-1">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title={lang === "id" ? "Buat RPP dari baris ini" : "Create lesson plan from this row"}
                                  onClick={() => sendTo("rpp", d, it)}
                                >
                                  <NotebookPen className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title={lang === "id" ? "Jadwalkan ke Kegiatan" : "Schedule as event"}
                                  onClick={() => sendTo("event", d, it)}
                                >
                                  <CalendarPlus className="size-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-2 text-xs font-display font-semibold text-guru">
                  {lang === "id" ? "Total alokasi" : "Total hours"}: {totalHours} {lang === "id" ? "jam" : "hrs"} · {items.length} {lang === "id" ? "baris" : "rows"}
                </div>
                {d.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{d.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm(kind)); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (lang === "id" ? "Edit Dokumen" : "Edit Document")
                : isAnnual ? (lang === "id" ? "Program Tahunan Baru" : "New Annual Program") : (lang === "id" ? "Program Semester Baru" : "New Semester Program")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>{lang === "id" ? "Judul dokumen" : "Title"}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{lang === "id" ? "Kelas" : "Class"}</Label>
                <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih kelas" : "Select class"} /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{lang === "id" ? "Mata pelajaran" : "Subject"}</Label>
                <SubjectSelect value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
              </div>
              <div>
                <Label>{lang === "id" ? "Tahun ajaran" : "Academic year"}</Label>
                <Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2026/2027" />
              </div>
              {!isAnnual && (
                <div>
                  <Label>Semester</Label>
                  <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 ({lang === "id" ? "Ganjil" : "Odd"})</SelectItem>
                      <SelectItem value="2">2 ({lang === "id" ? "Genap" : "Even"})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{lang === "id" ? "Rincian materi" : "Material rows"}</Label>
                <Button type="button" size="sm" variant="outline" onClick={applyTemplate}>
                  <Sparkles className="size-4" /> {lang === "id" ? "Isi otomatis (template)" : "Auto-fill template"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === "id"
                  ? "Template disusun otomatis dari mata pelajaran, semester, dan tahun ajaran — tinggal diedit sesuai kebutuhan."
                  : "The template is generated from subject, semester, and academic year — just edit as needed."}
              </p>

              {form.items.map((it, i) => (
                <div key={i} className="rounded-xl border-2 border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-muted-foreground">#{i + 1}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)}><X className="size-4" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {isAnnual && (
                      <div>
                        <Label className="text-xs">Semester</Label>
                        <Select value={it.semester ?? "1"} onValueChange={(v) => setItem(i, { semester: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 ({lang === "id" ? "Ganjil" : "Odd"})</SelectItem>
                            <SelectItem value="2">2 ({lang === "id" ? "Genap" : "Even"})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!isAnnual && (
                      <div>
                        <Label className="text-xs">{lang === "id" ? "Bulan" : "Month"}</Label>
                        <Select value={it.month ?? MONTHS[0]} onValueChange={(v) => setItem(i, { month: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">{lang === "id" ? "Alokasi jam" : "Hours"}</Label>
                      <Input inputMode="numeric" value={it.hours} onChange={(e) => setItem(i, { hours: e.target.value })} placeholder="4" />
                    </div>
                    {!isAnnual && (
                      <div>
                        <Label className="text-xs">{lang === "id" ? "Pekan (mis. 1,2)" : "Weeks (e.g. 1,2)"}</Label>
                        <Input value={it.weeks ?? ""} onChange={(e) => setItem(i, { weeks: e.target.value })} placeholder="1,2" />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{lang === "id" ? "Materi / Kompetensi" : "Material / competency"}</Label>
                      <Input value={it.material} onChange={(e) => setItem(i, { material: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{lang === "id" ? "Keterangan" : "Note"}</Label>
                      <Input value={it.note ?? ""} onChange={(e) => setItem(i, { note: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-4" /> {lang === "id" ? "Tambah baris" : "Add row"}
              </Button>
            </div>

            <div>
              <Label>{lang === "id" ? "Catatan" : "Notes"}</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
            <Button variant="guru" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {lang === "id" ? "Simpan" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
