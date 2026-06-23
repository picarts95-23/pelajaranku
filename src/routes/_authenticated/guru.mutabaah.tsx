import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { TAJWID_TOLERANCE, HELP_TOLERANCE, computeTotal, predikatOf } from "@/lib/mutabaah";

export const Route = createFileRoute("/_authenticated/guru/mutabaah")({
  head: () => ({ meta: [{ title: "Mutaba'ah Tahfidz · EduQuest Academy" }] }),
  component: GuruMutabaahPage,
});

type MForm = {
  class_id: string;
  student_id: string;
  session_date: string;
  session_type: string;
  surah: string;
  ayat_from: string;
  ayat_to: string;
  juz: string;
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
  const [form, setForm] = useState<MForm>(emptyForm());

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

  const total = computeTotal(form.tajwid_score, form.kelancaran_score, form.fashohah_score);
  const predikat = predikatOf(total, lang);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      if (!form.class_id) throw new Error(lang === "id" ? "Pilih kelas" : "Select a class");
      if (!form.student_id) throw new Error(lang === "id" ? "Pilih siswa" : "Select a student");
      if (!form.surah) throw new Error(lang === "id" ? "Pilih surah" : "Select a surah");
      const { error } = await (supabase as any).from("tahfidz_mutabaah").insert({
        teacher_id: user.id,
        student_id: form.student_id,
        class_id: form.class_id,
        session_date: form.session_date,
        session_type: form.session_type,
        surah: form.surah,
        ayat_from: form.ayat_from ? Number(form.ayat_from) : null,
        ayat_to: form.ayat_to ? Number(form.ayat_to) : null,
        juz: form.juz ? Number(form.juz) : null,
        tajwid_score: form.tajwid_score,
        tajwid_errors: form.tajwid_errors,
        kelancaran_score: form.kelancaran_score,
        kelancaran_helps: form.kelancaran_helps,
        fashohah_score: form.fashohah_score,
        adab_aurat: form.adab_aurat,
        adab_focus: form.adab_focus,
        adab_etika: form.adab_etika,
        total_score: computeTotal(form.tajwid_score, form.kelancaran_score, form.fashohah_score),
        predikat: predikatOf(computeTotal(form.tajwid_score, form.kelancaran_score, form.fashohah_score), "id"),
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Penilaian Mutaba'ah tersimpan" : "Mutaba'ah saved");
      setOpen(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["mutabaah"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("tahfidz_mutabaah").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Catatan dihapus" : "Deleted"); qc.invalidateQueries({ queryKey: ["mutabaah"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportColumns = [
    { key: "date", header: "Tanggal" }, { key: "student", header: "Siswa" }, { key: "surah", header: "Surah/Ayat" },
    { key: "type", header: "Jenis" }, { key: "tajwid", header: "Tajwid" }, { key: "kelancaran", header: "Kelancaran" },
    { key: "fashohah", header: "Fashohah & Adab" }, { key: "total", header: "Total" }, { key: "predikat", header: "Predikat" },
  ];
  const exportRows = () => (records as any[]).map((r) => ({
    date: format(new Date(r.session_date), "dd MMM yyyy"),
    student: r.profiles?.full_name ?? "—",
    surah: `${r.surah ?? "—"}${r.ayat_from ? ` (${r.ayat_from}${r.ayat_to ? `-${r.ayat_to}` : ""})` : ""}`,
    type: r.session_type === "murojaah" ? "Muroja'ah" : "Ziyadah",
    tajwid: `${r.tajwid_score} / ${r.tajwid_errors} err`,
    kelancaran: `${r.kelancaran_score} / ${r.kelancaran_helps} bantuan`,
    fashohah: r.fashohah_score,
    total: r.total_score, predikat: r.predikat ?? "—",
  }));

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={lang === "id" ? "Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"}
        subtitle={lang === "id" ? "Penilaian Halaqoh Tahfidz — Tajwid, Kelancaran, Fashohah & Adab" : "Halaqoh Tahfidz assessment — Tajwid, Fluency, Fashohah & Adab"}
        actions={
          <div className="flex flex-wrap gap-2">
            {(records as any[]).length > 0 && (
              <ExportMenu filename="mutabaah-tahfidz" title="Mutaba'ah Tahfidz" columns={exportColumns} rows={exportRows} />
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
              <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Nilai Setoran" : "New Assessment"}</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{lang === "id" ? "Penilaian Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"}</DialogTitle></DialogHeader>
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
                          <SelectItem value="ziyadah">{lang === "id" ? "Ziyadah (Hafalan Baru)" : "Ziyadah (New)"}</SelectItem>
                          <SelectItem value="murojaah">{lang === "id" ? "Muroja'ah (Mengulang)" : "Muroja'ah (Review)"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
                    <p className="font-display text-sm font-bold">{lang === "id" ? "3. Fashohah & Adab" : "3. Fashohah & Adab"}</p>
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
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
                  <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{lang === "id" ? "Simpan" : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {(records as any[]).length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada penilaian Mutaba'ah. Mulai nilai setoran hafalan siswa!" : "No Mutaba'ah records yet."} />
      ) : (
        <div className="space-y-3">
          {(records as any[]).map((r) => <RecordCard key={r.id} r={r} lang={lang} onDelete={() => deleteMut.mutate(r.id)} showStudent />)}
        </div>
      )}
    </DashboardShell>
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

export function RecordCard({ r, lang, onDelete, showStudent }: { r: any; lang: string; onDelete?: () => void; showStudent?: boolean }) {
  const tajwidOver = r.tajwid_errors > TAJWID_TOLERANCE;
  const helpsOver = r.kelancaran_helps > HELP_TOLERANCE;
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-magic text-white"><BookOpenCheck className="size-5" /></div>
          <div>
            <div className="font-display font-bold">
              {r.surah ?? "—"}{r.ayat_from ? ` : ${r.ayat_from}${r.ayat_to ? `-${r.ayat_to}` : ""}` : ""}
              {r.juz ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Juz {r.juz}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {showStudent && r.profiles?.full_name && <span className="font-semibold text-foreground">{r.profiles.full_name} ·</span>}
              <span>{format(new Date(r.session_date), "dd MMM yyyy")}</span>
              <span className="rounded-full bg-quest/15 px-2 py-0.5 font-display text-quest">{r.session_type === "murojaah" ? "Muroja'ah" : "Ziyadah"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
