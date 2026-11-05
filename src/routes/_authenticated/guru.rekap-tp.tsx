import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { computeTpRecap, validateWeights, type Weights } from "@/lib/tp-recap";
import { draftObjectives } from "@/lib/tp-ai.functions";

export const Route = createFileRoute("/_authenticated/guru/rekap-tp")({
  head: () => ({ meta: [{ title: "Rekap Sumatif per TP · Pelajaranku" },
    { name: "description", content: "Rekap nilai sumatif per Tujuan Pembelajaran, bobot nilai akhir, dan deskripsi rapor otomatis." },
    { property: "og:title", content: "Rekap Sumatif per TP · Pelajaranku" },
    { property: "og:description", content: "Rekap nilai sumatif per Tujuan Pembelajaran dan deskripsi rapor otomatis." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: RekapTpPage,
});

function RekapTpPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draftFn = useServerFn(draftObjectives);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [weights, setWeights] = useState<Weights>({ sumatif: 60, adab: 20, absensi: 20 });
  const [newTp, setNewTp] = useState({ code: "", description: "" });
  const [ai, setAi] = useState({ grade: "", topic: "", count: 5 });
  const [drafts, setDrafts] = useState<{ code: string; description: string }[]>([]);

  const { data: classes = [] } = useQuery({ queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name, subjects, subject").order("name")).data ?? [] });
  const cls = classes.find((c) => c.id === classId);
  const subjects = useMemo(() => Array.from(new Set([...(cls?.subjects ?? []), cls?.subject].filter(Boolean) as string[])), [cls]);

  const { data: savedWeights } = useQuery({ queryKey: ["grade-weights", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("grade_weights").select("sumatif, adab, absensi").eq("teacher_id", user!.id).maybeSingle()).data });
  useEffect(() => { if (savedWeights) setWeights(savedWeights); }, [savedWeights]);

  const ready = !!classId && !!subject;
  const { data: objectives = [] } = useQuery({ queryKey: ["learning-objectives", subject, classId], enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_objectives").select("id, code, description, class_id, sort_order").eq("subject", subject).or(`class_id.is.null,class_id.eq.${classId}`).order("sort_order");
      if (error) throw error; return data ?? [];
    } });
  const { data: students = [] } = useQuery({ queryKey: ["rekap-students", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: en } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = (en ?? []).map((e) => e.student_id);
      if (!ids.length) return [];
      return ((await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name")).data ?? []);
    } });
  const { data: assignments = [] } = useQuery({ queryKey: ["tp-assignments", classId, subject], enabled: ready,
    queryFn: async () => (await supabase.from("assignments").select("id, objective_id, objective_weights, assessment_kind, max_score, submissions(student_id, score, status, feedback)").eq("class_id", classId).eq("subject", subject)).data ?? [] });
  const { data: attendance = [] } = useQuery({ queryKey: ["rekap-attendance", classId], enabled: !!classId,
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId)).data ?? [] });
  const { data: adab = [] } = useQuery({ queryKey: ["rekap-adab", classId, subject], enabled: ready,
    queryFn: async () => (await supabase.from("adab_scores").select("student_id, score").eq("class_id", classId).eq("subject", subject)).data ?? [] });

  const weightError = validateWeights(weights);
  const rows = useMemo(() => weightError ? [] : computeTpRecap({ students, objectives, assignments: assignments as any, attendance, adab, weights }),
    [students, objectives, assignments, attendance, adab, weights, weightError]);

  const invalidateTp = () => qc.invalidateQueries({ queryKey: ["learning-objectives"] });
  const saveWeights = useMutation({
    mutationFn: async () => {
      if (weightError) throw new Error(weightError);
      const { error } = await supabase.from("grade_weights").upsert({ teacher_id: user!.id, ...weights, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bobot nilai disimpan"); qc.invalidateQueries({ queryKey: ["grade-weights"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addTps = useMutation({
    mutationFn: async (list: { code: string; description: string }[]) => {
      const base = objectives.length;
      const { error } = await supabase.from("learning_objectives").insert(list.map((o, i) => ({
        teacher_id: user!.id, class_id: classId, subject, code: o.code.trim() || `TP${base + i + 1}`, description: o.description.trim(), sort_order: base + i,
      })));
      if (error) throw error;
    },
    onSuccess: () => { toast.success("TP disimpan"); setNewTp({ code: "", description: "" }); setDrafts([]); invalidateTp(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateTp = useMutation({
    mutationFn: async (o: { id: string; code: string; description: string }) => {
      const { error } = await supabase.from("learning_objectives").update({ code: o.code, description: o.description }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("TP diperbarui"); invalidateTp(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteTp = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("learning_objectives").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidateTp, onError: (e: Error) => toast.error(e.message),
  });
  const genAi = useMutation({
    mutationFn: async () => {
      const r = await draftFn({ data: { subject, grade: ai.grade || cls?.name || "", topic: ai.topic, count: ai.count } });
      if (r.error) throw new Error(r.error);
      return r.objectives;
    },
    onSuccess: (list) => setDrafts(list.map((o, i) => ({ ...o, code: `TP${objectives.length + i + 1}` }))),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader title="Rekap Sumatif per TP" subtitle="Sumatif direkap per Tujuan Pembelajaran; formatif menjadi umpan balik. Bobot nilai akhir diatur sekolah." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Kelas</Label>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSubject(""); }}>
            <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label>Mata Pelajaran</Label>
          <Select value={subject} onValueChange={setSubject} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
      </div>

      <section className="mt-4 rounded-xl border-2 border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold">Bobot Nilai Akhir</h2>
        <p className="text-sm text-muted-foreground">Atur sesuai kebijakan sekolah. Total harus 100%.</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {(["sumatif", "adab", "absensi"] as const).map((k) => (
            <div key={k}><Label className="capitalize">{k === "sumatif" ? "Sumatif (TP)" : k} %</Label>
              <Input type="number" min={0} max={100} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} /></div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={weightError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>Total: {weights.sumatif + weights.adab + weights.absensi}% {weightError && `— ${weightError}`}</span>
          <Button size="sm" onClick={() => saveWeights.mutate()} disabled={!!weightError || saveWeights.isPending}><Save className="size-4" /> Simpan Bobot</Button>
        </div>
      </section>

      {!ready ? <div className="mt-4"><EmptyState message="Pilih kelas dan mata pelajaran untuk melihat TP dan rekap nilai." /></div> : (<>
        <section className="mt-4 rounded-xl border-2 border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold">Tujuan Pembelajaran (TP)</h2>
          <div className="mt-3 space-y-2">
            {objectives.map((o) => <TpRow key={o.id + o.code + o.description} o={o} onSave={(v) => updateTp.mutate(v)} onDelete={() => deleteTp.mutate(o.id)} />)}
            {!objectives.length && <p className="text-sm text-muted-foreground">Belum ada TP. Tambahkan manual atau buat draft dengan AI.</p>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[6rem_1fr_auto]">
            <Input placeholder={`TP${objectives.length + 1}`} value={newTp.code} onChange={(e) => setNewTp({ ...newTp, code: e.target.value })} />
            <Input placeholder="Deskripsi TP, mis. Menjelaskan proses fotosintesis" value={newTp.description} onChange={(e) => setNewTp({ ...newTp, description: e.target.value })} />
            <Button onClick={() => addTps.mutate([newTp])} disabled={!newTp.description.trim()}><Plus className="size-4" /> Tambah</Button>
          </div>
          <div className="mt-4 rounded-lg border-2 border-dashed border-border p-3">
            <div className="flex items-center gap-2 font-display font-bold"><Sparkles className="size-4 text-primary" /> Draft TP dengan AI</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_6rem]">
              <Input placeholder="Kelas/Fase (opsional), mis. Fase D Kelas 7" value={ai.grade} onChange={(e) => setAi({ ...ai, grade: e.target.value })} />
              <Input type="number" min={1} max={10} value={ai.count} onChange={(e) => setAi({ ...ai, count: Number(e.target.value) })} aria-label="Jumlah TP" />
            </div>
            <Textarea className="mt-2" placeholder="Materi atau Capaian Pembelajaran (CP)" value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} />
            <Button className="mt-2" variant="outline" onClick={() => genAi.mutate()} disabled={genAi.isPending}><Sparkles className="size-4" /> {genAi.isPending ? "Membuat..." : "Buat Draft TP"}</Button>
            {drafts.length > 0 && <div className="mt-3 space-y-2">
              {drafts.map((d, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[6rem_1fr_auto]">
                  <Input value={d.code} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} />
                  <Input value={d.description} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <Button size="icon" variant="ghost" aria-label="Buang draft" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}><Trash2 className="size-4 text-destructive" /></Button>
                </div>))}
              <Button onClick={() => addTps.mutate(drafts.filter((d) => d.description.trim()))}><Save className="size-4" /> Simpan Semua Draft</Button>
            </div>}
          </div>
        </section>

        <section className="mt-4 rounded-xl border-2 border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold">Rekap Nilai & Deskripsi Rapor</h2>
          <p className="text-sm text-muted-foreground">Hubungkan tugas ke TP dan pilih jenis asesmen di form Tugas. Hanya tugas sumatif yang sudah dinilai masuk rekap.</p>
          {!students.length ? <p className="mt-3 text-sm text-muted-foreground">Belum ada siswa di kelas ini.</p> : weightError ? <p className="mt-3 text-sm text-destructive">{weightError}</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left">
                  <th className="p-2">Siswa</th>
                  {objectives.map((o) => <th key={o.id} className="p-2" title={o.description}>{o.code}</th>)}
                  <th className="p-2">Sumatif</th><th className="p-2">Adab</th><th className="p-2">Absensi</th><th className="p-2">Akhir</th><th className="p-2">Formatif (umpan balik)</th>
                </tr></thead>
                <tbody>{rows.map((r) => (<>
                  <tr key={r.student_id} className="border-b">
                    <td className="p-2 font-semibold">{r.name}</td>
                    {objectives.map((o) => <td key={o.id} className="p-2">{r.perTp[o.id] ?? "-"}</td>)}
                    <td className="p-2">{r.sumatif ?? "-"}</td><td className="p-2">{r.adab ?? "-"}</td><td className="p-2">{r.absensi ?? "-"}</td>
                    <td className="p-2 font-bold">{r.final ?? "-"} <span className="text-xs text-muted-foreground">({r.predikat})</span></td>
                    <td className="p-2 text-xs text-muted-foreground">{r.formatif.count ? `${r.formatif.count} tugas · rata² ${r.formatif.avg}${r.formatif.lastFeedback ? ` · "${r.formatif.lastFeedback}"` : ""}` : "-"}</td>
                  </tr>
                  <tr key={r.student_id + "-d"} className="border-b bg-muted/30">
                    <td colSpan={objectives.length + 6} className="p-2 text-xs">
                      <div className="flex items-start gap-2"><span className="flex-1">{r.description}</span>
                        <Button size="sm" variant="ghost" aria-label="Salin deskripsi" onClick={() => { navigator.clipboard.writeText(r.description); toast.success("Deskripsi disalin"); }}><Copy className="size-4" /></Button></div>
                    </td>
                  </tr></>))}
                </tbody>
              </table>
            </div>)}
        </section>
      </>)}
    </DashboardShell>
  );
}

function TpRow({ o, onSave, onDelete }: { o: { id: string; code: string; description: string }; onSave: (v: { id: string; code: string; description: string }) => void; onDelete: () => void }) {
  const [code, setCode] = useState(o.code);
  const [desc, setDesc] = useState(o.description);
  const dirty = code !== o.code || desc !== o.description;
  return (
    <div className="grid gap-2 sm:grid-cols-[6rem_1fr_auto_auto]">
      <Input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Kode TP" />
      <Input value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Deskripsi TP" />
      <Button size="sm" variant="outline" disabled={!dirty || !desc.trim()} onClick={() => onSave({ id: o.id, code, description: desc })}><Save className="size-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Hapus TP" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
    </div>
  );
}
