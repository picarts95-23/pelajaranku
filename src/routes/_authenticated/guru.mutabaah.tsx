import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Plus, Trash2, AlertTriangle, CheckCircle2, Search, Filter, Pencil } from "lucide-react";
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
import { SURAHS, JUZ_LIST } from "@/lib/quran-data";
import {
  TAJWID_TOLERANCE, HELP_TOLERANCE, computeTotal, predikatOf, setoranLabel,
  HIJAIYAH_LETTERS, IQRO_JILID, SETORAN_TYPES,
  type HalaqohDaily,
} from "@/lib/mutabaah";

export const Route = createFileRoute("/_authenticated/guru/mutabaah")({
  head: () => ({ meta: [{ title: "Mutaba'ah Tahfidz · Pelajaranku" }] }),
  component: GuruMutabaahPage,
});

type MForm = {
  class_id: string;
  student_id: string;
  session_date: string;
  session_type: string;
  // Qur'an fields
  surah: string;
  ayat_from: string;
  ayat_to: string;
  juz: string;
  // Iqro fields
  iqro_jilid: string;
  iqro_page: string;
  iqro_letters: string[];
  // Scoring
  tajwid_score: number;
  tajwid_errors: number;
  kelancaran_score: number;
  kelancaran_helps: number;
  fashohah_score: number;
  adab_aurat: boolean;
  adab_focus: boolean;
  adab_etika: boolean;
  notes: string;
};

const emptyForm = (): MForm => ({
  class_id: "",
  student_id: "",
  session_date: new Date().toISOString().slice(0, 10),
  session_type: "ziyadah",
  surah: "",
  ayat_from: "",
  ayat_to: "",
  juz: "",
  iqro_jilid: "",
  iqro_page: "",
  iqro_letters: [],
  tajwid_score: 90,
  tajwid_errors: 0,
  kelancaran_score: 90,
  kelancaran_helps: 0,
  fashohah_score: 90,
  adab_aurat: true,
  adab_focus: true,
  adab_etika: true,
  notes: "",
});

function GuruMutabaahPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MForm>(emptyForm());
  const [viewClass, setViewClass] = useState("");

  // List-view filters (make daily checking easier)
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: classStudents = [] } = useQuery({
    queryKey: ["mutabaah-students", form.class_id], enabled: !!form.class_id,
    queryFn: async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", form.class_id);
      const ids = (enr ?? []).map((e: any) => e.student_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profs ?? []).sort((a: any, b: any) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "id", { sensitivity: "base" }));
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["mutabaah", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("tahfidz_mutabaah").select("*, classes(name)").order("session_date", { ascending: false });
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.student_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return rows.map((r) => ({ ...r, profiles: (profs ?? []).find((p: any) => p.id === r.student_id) ?? null }));
    },
  });

  const { data: accum = [] } = useQuery({
    queryKey: ["mutabaah-accum", viewClass], enabled: !!viewClass,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("halaqoh_daily_scores", { _class_id: viewClass });
      if (error) throw error;
      return (data ?? []) as HalaqohDaily[];
    },
  });
  const { data: accumStudents = [] } = useQuery({
    queryKey: ["mutabaah-accum-students", viewClass], enabled: !!viewClass,
    queryFn: async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", viewClass);
      const ids = (enr ?? []).map((e: any) => e.student_id).filter(Boolean);
      if (ids.length === 0) return [] as { id: string; full_name: string }[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profs ?? []) as { id: string; full_name: string }[];
    },
  });

  const total = computeTotal(form.tajwid_score, form.kelancaran_score, form.fashohah_score);
  const predikat = predikatOf(total, lang);
  const isIqro = form.session_type === "iqro";

  const saveOne = async () => {
    if (!user) throw new Error("no user");
    if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas" : "Select a class");
    if (!form.student_id) throw new Error(lang === "id" ? "Pilih siswa" : "Select a student");
    if (isIqro) {
      if (!form.iqro_jilid) throw new Error(lang === "id" ? "Pilih jilid Iqro" : "Select Iqro jilid");
      if (form.iqro_letters.length === 0 && !form.iqro_page) throw new Error(lang === "id" ? "Pilih minimal 1 huruf atau isi halaman" : "Pick a letter or fill a page");
    } else {
      if (!form.surah) throw new Error(lang === "id" ? "Pilih surah" : "Select a surah");
    }
    const t = computeTotal(form.tajwid_score, form.kelancaran_score, form.fashohah_score);
    const payload = {
      teacher_id: user.id,
      student_id: form.student_id,
      class_id: form.class_id,
      session_date: form.session_date,
      session_type: form.session_type,
      setoran_kind: form.session_type,
      surah: isIqro ? null : form.surah,
      ayat_from: !isIqro && form.ayat_from ? Number(form.ayat_from) : null,
      ayat_to: !isIqro && form.ayat_to ? Number(form.ayat_to) : null,
      juz: !isIqro && form.juz ? Number(form.juz) : null,
      iqro_jilid: isIqro && form.iqro_jilid ? Number(form.iqro_jilid) : null,
      iqro_page: isIqro && form.iqro_page ? Number(form.iqro_page) : null,
      iqro_letters: isIqro && form.iqro_letters.length ? form.iqro_letters : null,
      tajwid_score: form.tajwid_score,
      tajwid_errors: form.tajwid_errors,
      kelancaran_score: form.kelancaran_score,
      kelancaran_helps: form.kelancaran_helps,
      fashohah_score: form.fashohah_score,
      adab_aurat: form.adab_aurat,
      adab_focus: form.adab_focus,
      adab_etika: form.adab_etika,
      total_score: t,
      predikat: predikatOf(t, "id"),
      notes: form.notes.trim() || null,
    });
    if (error) throw error;
  };

  const createMut = useMutation({
    mutationFn: async () => { await saveOne(); },
    onSuccess: () => {
      toast.success(lang === "id" ? "Penilaian tersimpan" : "Saved");
      setOpen(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["mutabaah"] });
      qc.invalidateQueries({ queryKey: ["mutabaah-accum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // "Simpan & Siswa Berikutnya" — mempercepat input harian: menyimpan lalu
  // mengosongkan hanya bagian siswa/nilai, kelas & tanggal tetap.
  const saveNextMut = useMutation({
    mutationFn: async () => { await saveOne(); },
    onSuccess: () => {
      toast.success(lang === "id" ? "Tersimpan — lanjut siswa berikutnya" : "Saved — next student");
      setForm((f) => ({
        ...emptyForm(),
        class_id: f.class_id,
        session_date: f.session_date,
        session_type: f.session_type,
      }));
      qc.invalidateQueries({ queryKey: ["mutabaah"] });
      qc.invalidateQueries({ queryKey: ["mutabaah-accum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("tahfidz_mutabaah").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Catatan dihapus" : "Deleted"); qc.invalidateQueries({ queryKey: ["mutabaah"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Apply filters + search to records
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (records as any[]).filter((r) => {
      if (filterClass !== "all" && r.class_id !== filterClass) return false;
      if (filterDate && r.session_date !== filterDate) return false;
      if (filterType !== "all" && (r.session_type ?? "").toLowerCase() !== filterType) return false;
      if (q) {
        const hay = `${r.profiles?.full_name ?? ""} ${r.surah ?? ""} ${(r.iqro_letters ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filterClass, filterDate, filterType, search]);

  // Group filtered records by date for scannable daily overview.
  const grouped = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const r of filtered) {
      const k = r.session_date;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(r);
    }
    return Array.from(g.entries());
  }, [filtered]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = (records as any[]).filter((r) => r.session_date === todayStr).length;
  const totalCount = (records as any[]).length;
  const avgAll = totalCount ? Math.round((records as any[]).reduce((s, r) => s + (r.total_score ?? 0), 0) / totalCount) : 0;

  const exportColumns = [
    { key: "date", header: "Tanggal" }, { key: "student", header: "Siswa" },
    { key: "type", header: "Jenis" }, { key: "material", header: "Materi" },
    { key: "tajwid", header: "Tajwid" }, { key: "kelancaran", header: "Kelancaran" },
    { key: "fashohah", header: "Fashohah & Adab" }, { key: "total", header: "Total" }, { key: "predikat", header: "Predikat" },
  ];
  const exportRows = () => filtered.map((r) => ({
    date: format(new Date(r.session_date), "dd MMM yyyy"),
    student: r.profiles?.full_name ?? "—",
    type: setoranLabel(r.session_type, "id"),
    material: materialLabel(r),
    tajwid: `${r.tajwid_score} / ${r.tajwid_errors} err`,
    kelancaran: `${r.kelancaran_score} / ${r.kelancaran_helps} bantuan`,
    fashohah: r.fashohah_score,
    total: r.total_score, predikat: r.predikat ?? "—",
  }));

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={lang === "id" ? "Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"}
        subtitle={lang === "id" ? "Penilaian harian — Tajwid, Kelancaran, Fashohah & Adab (Al-Qur'an & Iqro)" : "Daily assessment — Tajwid, Fluency, Fashohah & Adab (Qur'an & Iqro)"}
        actions={
          <div className="flex flex-wrap gap-2">
            {totalCount > 0 && (
              <ExportMenu filename="mutabaah-tahfidz" title="Mutaba'ah Tahfidz" columns={exportColumns} rows={exportRows} />
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Nilai Setoran" : "New Assessment"}</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{lang === "id" ? "Penilaian Mutaba'ah" : "Mutaba'ah Assessment"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{lang === "id" ? "Kelas" : "Class"} <span className="text-destructive">*</span></Label>
                      <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v, student_id: "" })}>
                        <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih kelas" : "Select class"} /></SelectTrigger>
                        <SelectContent>{(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{lang === "id" ? "Siswa" : "Student"} <span className="text-destructive">*</span></Label>
                      <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })} disabled={!form.class_id}>
                        <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih siswa" : "Select student"} /></SelectTrigger>
                        <SelectContent>{(classStudents as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>{lang === "id" ? "Tanggal" : "Date"}</Label><Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} /></div>
                    <div><Label>{lang === "id" ? "Jenis Setoran" : "Type"}</Label>
                      <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETORAN_TYPES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{lang === "id" ? s.id : s.en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isIqro ? (
                    <div className="rounded-xl border-2 border-guru/30 bg-guru/5 p-3 space-y-3">
                      <p className="font-display text-sm font-bold text-guru">{lang === "id" ? "📖 Detail Bacaan Iqro" : "Iqro Reading Detail"}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>{lang === "id" ? "Jilid" : "Jilid"} <span className="text-destructive">*</span></Label>
                          <Select value={form.iqro_jilid} onValueChange={(v) => setForm({ ...form, iqro_jilid: v })}>
                            <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih jilid" : "Select jilid"} /></SelectTrigger>
                            <SelectContent>{IQRO_JILID.map((j) => <SelectItem key={j} value={String(j)}>Iqro {j}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>{lang === "id" ? "Halaman" : "Page"}</Label>
                          <Input type="number" min={1} max={50} value={form.iqro_page} onChange={(e) => setForm({ ...form, iqro_page: e.target.value })} placeholder={lang === "id" ? "mis. 12" : "e.g. 12"} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>{lang === "id" ? "Huruf Hijaiyyah (boleh lebih dari 2)" : "Hijaiyah letters (multi)"}</Label>
                          {form.iqro_letters.length > 0 && (
                            <button type="button" onClick={() => setForm({ ...form, iqro_letters: [] })} className="text-xs text-muted-foreground hover:text-destructive">
                              {lang === "id" ? "Bersihkan" : "Clear"}
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {HIJAIYAH_LETTERS.map((h) => {
                            const on = form.iqro_letters.includes(h);
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => setForm({
                                  ...form,
                                  iqro_letters: on ? form.iqro_letters.filter((x) => x !== h) : [...form.iqro_letters, h],
                                })}
                                className={`min-w-9 rounded-lg border-2 px-2.5 py-1.5 text-lg leading-none transition ${on ? "border-guru bg-guru text-white shadow-md" : "border-border bg-card hover:border-guru/50"}`}
                                aria-pressed={on}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                        {form.iqro_letters.length > 0 && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {lang === "id" ? "Terpilih" : "Selected"}: <span className="font-display font-bold text-guru">{form.iqro_letters.length}</span> — {form.iqro_letters.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>{lang === "id" ? "Surah" : "Surah"} <span className="text-destructive">*</span></Label>
                          <Select value={form.surah} onValueChange={(v) => setForm({ ...form, surah: v })}>
                            <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih surah" : "Select surah"} /></SelectTrigger>
                            <SelectContent className="max-h-64">{SURAHS.map((s) => <SelectItem key={s.number} value={s.name}>{s.number}. {s.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>Juz</Label>
                          <Select value={form.juz} onValueChange={(v) => setForm({ ...form, juz: v })}>
                            <SelectTrigger><SelectValue placeholder="Juz" /></SelectTrigger>
                            <SelectContent className="max-h-64">{JUZ_LIST.map((j) => <SelectItem key={j} value={String(j)}>Juz {j}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>{lang === "id" ? "Ayat dari" : "Ayah from"}</Label><Input type="number" min={1} value={form.ayat_from} onChange={(e) => setForm({ ...form, ayat_from: e.target.value })} /></div>
                        <div><Label>{lang === "id" ? "Ayat sampai" : "Ayah to"}</Label><Input type="number" min={1} value={form.ayat_to} onChange={(e) => setForm({ ...form, ayat_to: e.target.value })} /></div>
                      </div>
                    </>
                  )}

                  <ComponentScore
                    title="1. Tajwid & Makhraj"
                    hint={lang === "id" ? "Sifat huruf, mad, gunnah, idgham." : "Letter traits, mad, gunnah, idgham."}
                    score={form.tajwid_score} onScore={(v) => setForm({ ...form, tajwid_score: v })}
                    countLabel={lang === "id" ? "Kesalahan kecil" : "Minor errors"}
                    count={form.tajwid_errors} onCount={(v) => setForm({ ...form, tajwid_errors: v })}
                    tolerance={TAJWID_TOLERANCE} lang={lang}
                  />
                  <ComponentScore
                    title={lang === "id" ? "2. Kelancaran (Hifdz)" : "2. Fluency (Hifdz)"}
                    hint={lang === "id" ? "Menyambung ayat tanpa jeda, tidak tertukar." : "Connecting verses without long pauses."}
                    score={form.kelancaran_score} onScore={(v) => setForm({ ...form, kelancaran_score: v })}
                    countLabel={lang === "id" ? "Bantuan/pancingan guru" : "Teacher prompts"}
                    count={form.kelancaran_helps} onCount={(v) => setForm({ ...form, kelancaran_helps: v })}
                    tolerance={HELP_TOLERANCE} lang={lang}
                  />
                  <div className="rounded-xl border-2 border-border bg-muted/20 p-3">
                    <p className="font-display text-sm font-bold">3. Fashohah & Adab</p>
                    <p className="text-xs text-muted-foreground">{lang === "id" ? "Kefasihan, waqaf & ibtida', kerapian & adab halaqoh." : "Fluency, waqf & ibtida', manners."}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs w-14">{lang === "id" ? "Nilai" : "Score"}</Label>
                      <Input type="number" min={0} max={100} value={form.fashohah_score} onChange={(e) => setForm({ ...form, fashohah_score: Number(e.target.value) })} className="h-8" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <Check label={lang === "id" ? "Menutup aurat" : "Aurah covered"} checked={form.adab_aurat} onChange={(v) => setForm({ ...form, adab_aurat: v })} />
                      <Check label={lang === "id" ? "Fokus" : "Focused"} checked={form.adab_focus} onChange={(v) => setForm({ ...form, adab_focus: v })} />
                      <Check label={lang === "id" ? "Menjaga etika" : "Good manners"} checked={form.adab_etika} onChange={(v) => setForm({ ...form, adab_etika: v })} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gradient-magic px-4 py-3 text-white">
                    <span className="font-display text-sm font-bold">{lang === "id" ? "Nilai Total" : "Total Score"}</span>
                    <span className="font-display text-2xl font-bold">{total} <span className="text-sm opacity-90">· {predikat}</span></span>
                  </div>

                  <div><Label>{lang === "id" ? "Catatan Guru" : "Notes"}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="ghost" onClick={() => setOpen(false)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
                  <Button variant="outline" disabled={saveNextMut.isPending} onClick={() => saveNextMut.mutate()}>
                    {lang === "id" ? "Simpan & Siswa Berikutnya" : "Save & Next"}
                  </Button>
                  <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{lang === "id" ? "Simpan" : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label={lang === "id" ? "Setoran Hari Ini" : "Today's sessions"} value={todayCount} tone="guru" />
        <SummaryCard label={lang === "id" ? "Total Setoran" : "Total sessions"} value={totalCount} />
        <SummaryCard label={lang === "id" ? "Rata-rata Nilai" : "Avg score"} value={avgAll || "—"} tone="primary" />
      </div>

      {/* Akumulasi Nilai Harian Halaqoh — what syncs to Rekap Nilai */}
      <div className="mb-6 rounded-3xl border-2 border-guru/30 bg-guru/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm font-bold text-guru">{lang === "id" ? "Akumulasi Nilai Harian Halaqoh" : "Halaqoh Daily Accumulation"}</p>
            <p className="text-xs text-muted-foreground">{lang === "id" ? "Ziyadah 30% · Muroja'ah 40% · Tilawah 30% → tersinkron otomatis ke Rekap Nilai." : "Ziyadah 30% · Muroja'ah 40% · Tilawah 30% → auto-synced to Rekap Nilai."}</p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={viewClass} onValueChange={setViewClass}>
              <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih kelas" : "Select class"} /></SelectTrigger>
              <SelectContent>{(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {viewClass && (
          (accumStudents as any[]).length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{lang === "id" ? "Belum ada siswa di kelas ini." : "No students in this class."}</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-border bg-card">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{lang === "id" ? "Siswa" : "Student"}</th>
                    <th className="px-3 py-2 text-center">Ziyadah<br /><span className="normal-case">30%</span></th>
                    <th className="px-3 py-2 text-center">Muroja'ah<br /><span className="normal-case">40%</span></th>
                    <th className="px-3 py-2 text-center">Tilawah<br /><span className="normal-case">30%</span></th>
                    <th className="px-3 py-2 text-center font-bold">{lang === "id" ? "Nilai Harian" : "Daily"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(accumStudents as any[]).map((s) => {
                    const a = (accum as HalaqohDaily[]).find((x) => x.student_id === s.id);
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 font-display font-semibold">{s.full_name}</td>
                        <td className="px-3 py-2 text-center">{a?.ziyadah ?? "—"}</td>
                        <td className="px-3 py-2 text-center">{a?.murojaah ?? "—"}</td>
                        <td className="px-3 py-2 text-center">{a?.tilawah ?? "—"}</td>
                        <td className="px-3 py-2 text-center font-display text-lg font-bold text-guru">{a?.daily ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Filter bar for daily checking */}
      {totalCount > 0 && (
        <div className="mb-4 rounded-2xl border-2 border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-display font-bold text-muted-foreground">
            <Filter className="size-3.5" /> {lang === "id" ? "Saring & Cari" : "Filter & Search"}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === "id" ? "Cari siswa / surah / huruf" : "Search"} className="pl-8" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "id" ? "Semua kelas" : "All classes"}</SelectItem>
                {(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "id" ? "Semua jenis" : "All types"}</SelectItem>
                {SETORAN_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{lang === "id" ? s.id : s.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          {(filterClass !== "all" || filterDate || filterType !== "all" || search) && (
            <button
              type="button"
              onClick={() => { setFilterClass("all"); setFilterDate(""); setFilterType("all"); setSearch(""); }}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
            >
              {lang === "id" ? "Bersihkan filter" : "Reset filters"}
            </button>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada penilaian Mutaba'ah. Mulai nilai setoran hafalan siswa!" : "No Mutaba'ah records yet."} />
      ) : filtered.length === 0 ? (
        <EmptyState message={lang === "id" ? "Tidak ada catatan sesuai filter." : "No records match your filter."} />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, rows]) => (
            <section key={date}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground">
                  {format(new Date(date), "EEEE, dd MMM yyyy")}
                </h3>
                <span className="text-xs text-muted-foreground">{rows.length} {lang === "id" ? "setoran" : "sessions"}</span>
              </div>
              <div className="space-y-2">
                {rows.map((r: any) => <RecordCard key={r.id} r={r} lang={lang} onDelete={() => deleteMut.mutate(r.id)} showStudent />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: "guru" | "primary" }) {
  const cls = tone === "guru" ? "border-guru/40 bg-guru/5 text-guru"
    : tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : "border-border bg-card text-foreground";
  return (
    <div className={`rounded-2xl border-2 p-3 ${cls}`}>
      <div className="text-xs font-display font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function ComponentScore({ title, hint, score, onScore, countLabel, count, onCount, tolerance, lang }: {
  title: string; hint: string; score: number; onScore: (v: number) => void;
  countLabel: string; count: number; onCount: (v: number) => void; tolerance: number; lang: string;
}) {
  const over = count > tolerance;
  return (
    <div className="rounded-xl border-2 border-border bg-muted/20 p-3">
      <p className="font-display text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs w-14">{lang === "id" ? "Nilai" : "Score"}</Label>
          <Input type="number" min={0} max={100} value={score} onChange={(e) => onScore(Number(e.target.value))} className="h-8" />
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} value={count} onChange={(e) => onCount(Number(e.target.value))} className="h-8" />
        </div>
      </div>
      <div className={`mt-1.5 flex items-center gap-1 text-xs ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
        {over ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5 text-emerald-600" />}
        {countLabel}: {count} · {lang === "id" ? "batas toleransi" : "tolerance"} {tolerance}
        {over && (lang === "id" ? " — melebihi batas!" : " — exceeded!")}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-semibold ${checked ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground"}`}>
      <span className={`grid size-4 place-items-center rounded-full ${checked ? "bg-emerald-500 text-white" : "bg-muted"}`}>{checked && <CheckCircle2 className="size-3" />}</span>
      {label}
    </button>
  );
}

// Compact material label: "QS. Al-Baqarah : 1-5 · Juz 1" or "Iqro 2 hal.12 · ا ب ت"
function materialLabel(r: any): string {
  const kind = (r.session_type ?? "").toLowerCase();
  if (kind.startsWith("iqro")) {
    const parts: string[] = [];
    if (r.iqro_jilid) parts.push(`Iqro ${r.iqro_jilid}`);
    if (r.iqro_page) parts.push(`hal. ${r.iqro_page}`);
    const letters = (r.iqro_letters ?? []) as string[];
    if (letters.length) parts.push(letters.join(" "));
    return parts.join(" · ") || "Iqro";
  }
  let s = r.surah ?? "—";
  if (r.ayat_from) s += ` : ${r.ayat_from}${r.ayat_to ? `-${r.ayat_to}` : ""}`;
  if (r.juz) s += ` · Juz ${r.juz}`;
  return s;
}

export function RecordCard({ r, lang, onDelete, showStudent }: { r: any; lang: string; onDelete?: () => void; showStudent?: boolean }) {
  const tajwidOver = r.tajwid_errors > TAJWID_TOLERANCE;
  const helpsOver = r.kelancaran_helps > HELP_TOLERANCE;
  const isIqro = (r.session_type ?? "").toLowerCase().startsWith("iqro");
  const letters = (r.iqro_letters ?? []) as string[];
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl text-white ${isIqro ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-magic"}`}>
            <BookOpenCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold truncate">
              {isIqro ? (
                <>Iqro {r.iqro_jilid ?? "—"}{r.iqro_page ? <span className="ml-2 text-sm font-normal text-muted-foreground">hal. {r.iqro_page}</span> : null}</>
              ) : (
                <>{r.surah ?? "—"}{r.ayat_from ? ` : ${r.ayat_from}${r.ayat_to ? `-${r.ayat_to}` : ""}` : ""}
                  {r.juz ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Juz {r.juz}</span> : null}</>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {showStudent && r.profiles?.full_name && <span className="font-semibold text-foreground">{r.profiles.full_name} ·</span>}
              <span>{format(new Date(r.session_date), "dd MMM yyyy")}</span>
              <span className={`rounded-full px-2 py-0.5 font-display ${isIqro ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-quest/15 text-quest"}`}>
                {setoranLabel(r.session_type, lang)}
              </span>
            </div>
            {isIqro && letters.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {letters.map((h, i) => (
                  <span key={`${h}-${i}`} className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-base leading-none text-amber-700 dark:text-amber-400">{h}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-primary">{r.total_score}</div>
            <div className="text-xs font-semibold text-muted-foreground">{r.predikat ?? "—"}</div>
          </div>
          {onDelete && <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="Tajwid" value={r.tajwid_score} extra={`${r.tajwid_errors} ${lang === "id" ? "salah" : "err"}`} warn={tajwidOver} />
        <Metric label={lang === "id" ? "Kelancaran" : "Fluency"} value={r.kelancaran_score} extra={`${r.kelancaran_helps} ${lang === "id" ? "bantuan" : "help"}`} warn={helpsOver} />
        <Metric label="Fashohah & Adab" value={r.fashohah_score} extra={[r.adab_aurat ? "🧕" : "", r.adab_focus ? "🎯" : "", r.adab_etika ? "🤝" : ""].filter(Boolean).join(" ")} />
      </div>
      {r.notes && <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{r.notes}</p>}
    </div>
  );
}

function Metric({ label, value, extra, warn }: { label: string; value: number; extra?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {extra && <div className={`text-[10px] ${warn ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{extra}</div>}
    </div>
  );
}
