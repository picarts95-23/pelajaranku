import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck, ChevronDown, Copy, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExportMenu } from "@/components/export-menu";
import { TpFields } from "@/components/tp-fields";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { computeTpRecap, tpShares, validateTpWeights, validateWeights, type Weights } from "@/lib/tp-recap";
import { draftObjectives } from "@/lib/tp-ai.functions";

type Student = { id: string; full_name: string };
type Objective = { id: string; code: string; description: string; sort_order?: number };
type PracticeAttempt = {
  id: string; student_id: string; topic: string; score: number; correct_count: number;
  question_count: number; feedback: string; weak_concepts: string[]; created_at: string;
};
type TaggedA = {
  id: string; title: string; description: string | null; exam_type: string | null;
  assessment_kind: string; objective_id: string | null; objective_weights: Record<string, number> | null;
};

export function TpRecapWorkspace({ classId, subject, className, students }: {
  classId: string; subject: string; className: string; students: Student[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draftFn = useServerFn(draftObjectives);
  const [weights, setWeights] = useState<Weights>({ sumatif: 60, adab: 20, absensi: 20 });
  const [adabDraft, setAdabDraft] = useState<Record<string, number>>({});
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [newTp, setNewTp] = useState({ code: "", description: "" });
  const [ai, setAi] = useState({ grade: "", topic: "", count: 5 });
  const [drafts, setDrafts] = useState<{ code: string; description: string }[]>([]);

  const { data: savedWeights } = useQuery({
    queryKey: ["grade-weights", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("grade_weights").select("sumatif, adab, absensi").eq("teacher_id", user!.id).maybeSingle()).data,
  });
  useEffect(() => { if (savedWeights) setWeights(savedWeights); }, [savedWeights]);

  const { data: objectives = [] } = useQuery({
    queryKey: ["learning-objectives", subject, classId],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_objectives").select("id, code, description, sort_order").eq("subject", subject).or(`class_id.is.null,class_id.eq.${classId}`).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Objective[];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["tp-assignments", classId, subject],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("id, title, description, exam_type, created_at, objective_id, objective_weights, assessment_kind, max_score, submissions(student_id, score, status, feedback)").eq("class_id", classId).eq("subject", subject);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["rekap-attendance", classId],
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId)).data ?? [],
  });
  const { data: adab = [] } = useQuery({
    queryKey: ["rekap-adab", classId, subject],
    queryFn: async () => (await supabase.from("adab_scores").select("student_id, score").eq("class_id", classId).eq("subject", subject)).data ?? [],
  });
  const { data: attempts = [], error: practiceError } = useQuery({
    queryKey: ["practice-attempts", classId, subject],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("practice_attempts").select("id, student_id, topic, score, correct_count, question_count, feedback, weak_concepts, created_at").eq("class_id", classId).eq("subject", subject).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PracticeAttempt[];
    },
  });

  useEffect(() => {
    const next: Record<string, number> = {};
    (adab as { student_id: string; score: number }[]).forEach((a) => { next[a.student_id] = a.score; });
    setAdabDraft(next);
  }, [adab]);

  const adabForRecap = useMemo(() => students.map((s) => ({ student_id: s.id, score: Math.max(0, Math.min(100, adabDraft[s.id] ?? 0)) })), [students, adabDraft]);
  const weightError = validateWeights(weights);
  const rows = useMemo(() => weightError ? [] : computeTpRecap({ students, objectives, assignments: assignments as any, attendance, adab: adabForRecap, weights }), [students, objectives, assignments, attendance, adabForRecap, weights, weightError]);
  const attemptsFor = (studentId: string) => attempts.filter((a) => a.student_id === studentId);
  const aiAverage = (studentId: string) => {
    const list = attemptsFor(studentId);
    return list.length ? Math.round(list.reduce((sum, a) => sum + a.score, 0) / list.length) : null;
  };

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
  const saveAdab = useMutation({
    mutationFn: async () => {
      const rowsToSave = students.map((s) => ({ teacher_id: user!.id, student_id: s.id, class_id: classId, subject, score: Math.max(0, Math.min(100, adabDraft[s.id] ?? 0)) }));
      const { error } = await supabase.from("adab_scores").upsert(rowsToSave, { onConflict: "teacher_id,student_id,class_id,subject" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nilai adab disimpan"); qc.invalidateQueries({ queryKey: ["rekap-adab"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addTps = useMutation({
    mutationFn: async (list: { code: string; description: string }[]) => {
      const base = objectives.length;
      const { error } = await supabase.from("learning_objectives").insert(list.map((o, i) => ({ teacher_id: user!.id, class_id: classId, subject, code: o.code.trim() || `TP${base + i + 1}`, description: o.description.trim(), sort_order: base + i })));
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
    onSuccess: invalidateTp,
    onError: (e: Error) => toast.error(e.message),
  });
  const genAi = useMutation({
    mutationFn: async () => {
      const r = await draftFn({ data: { subject, grade: ai.grade || className, topic: ai.topic, count: ai.count } });
      if (r.error) throw new Error(r.error);
      return r.objectives;
    },
    onSuccess: (list) => setDrafts(list.map((o, i) => ({ ...o, code: `TP${objectives.length + i + 1}` }))),
    onError: (e: Error) => toast.error(e.message),
  });

  const exportColumns = [
    { key: "name", header: "Nama Siswa" },
    ...objectives.map((o) => ({ key: `tp_${o.id}`, header: `${o.code} — ${o.description}` })),
    { key: "sumatif", header: "Rata-rata Sumatif TP" },
    { key: "adab", header: `Adab (${weights.adab}%)` },
    { key: "absensi", header: `Absensi (${weights.absensi}%)` },
    { key: "ai", header: "Nilai Tambahan Latihan AI" },
    { key: "ai_feedback", header: "Umpan Balik Latihan AI Terbaru" },
    { key: "final", header: "Nilai Akhir" },
    { key: "predikat", header: "Predikat" },
    { key: "description", header: "Deskripsi Rapor" },
  ];
  const exportRows = () => rows.map((r) => ({
    name: r.name,
    ...Object.fromEntries(objectives.map((o) => [`tp_${o.id}`, r.perTp[o.id] ?? ""])),
    sumatif: r.sumatif ?? "", adab: r.adab ?? "", absensi: r.absensi ?? "",
    ai: aiAverage(r.student_id) ?? "", ai_feedback: attemptsFor(r.student_id)[0]?.feedback ?? "",
    final: r.final ?? "", predikat: r.predikat, description: r.description,
  }));

  return (
    <div className="space-y-4">
      <details className="rounded-2xl border-2 border-border bg-card p-4">
        <summary className="cursor-pointer font-display font-bold">Pengaturan TP, bobot nilai, dan tagging penilaian</summary>
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <section>
            <h2 className="font-display text-lg font-bold">Bobot Nilai Akhir</h2>
            <p className="text-sm text-muted-foreground">Nilai akhir memakai rata-rata TP sumatif, adab, dan absensi. Total bobot harus 100%.</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["sumatif", "adab", "absensi"] as const).map((k) => <div key={k}><Label>{k === "sumatif" ? "Sumatif TP" : k === "adab" ? "Adab" : "Absensi"} %</Label><Input type="number" min={0} max={100} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} /></div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3"><span className={weightError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>Total: {weights.sumatif + weights.adab + weights.absensi}% {weightError && `— ${weightError}`}</span><Button size="sm" onClick={() => saveWeights.mutate()} disabled={!!weightError || saveWeights.isPending}><Save className="size-4" /> Simpan Bobot</Button></div>
          </section>

          <section className="border-t border-border pt-4">
            <h2 className="font-display text-lg font-bold">Tujuan Pembelajaran</h2>
            <div className="mt-3 space-y-2">{objectives.map((o) => <TpRow key={o.id + o.code + o.description} o={o} onSave={(v) => updateTp.mutate(v)} onDelete={() => deleteTp.mutate(o.id)} />)}{!objectives.length && <p className="text-sm text-muted-foreground">Belum ada TP. Tambahkan manual atau buat draft dengan AI.</p>}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[6rem_1fr_auto]"><Input placeholder={`TP${objectives.length + 1}`} value={newTp.code} onChange={(e) => setNewTp({ ...newTp, code: e.target.value })} /><Input placeholder="Deskripsi TP" value={newTp.description} onChange={(e) => setNewTp({ ...newTp, description: e.target.value })} /><Button onClick={() => addTps.mutate([newTp])} disabled={!newTp.description.trim()}><Plus className="size-4" /> Tambah</Button></div>
            <details className="mt-3 rounded-xl border border-dashed border-border p-3"><summary className="cursor-pointer font-display font-semibold"><Sparkles className="mr-2 inline size-4 text-primary" />Buat draft TP dengan AI</summary><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem]"><Input placeholder="Kelas/Fase (opsional)" value={ai.grade} onChange={(e) => setAi({ ...ai, grade: e.target.value })} /><Input type="number" min={1} max={10} value={ai.count} onChange={(e) => setAi({ ...ai, count: Number(e.target.value) })} aria-label="Jumlah TP" /></div><Textarea className="mt-2" placeholder="Materi atau Capaian Pembelajaran (CP)" value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} /><Button className="mt-2" variant="outline" onClick={() => genAi.mutate()} disabled={genAi.isPending}><Sparkles className="size-4" /> {genAi.isPending ? "Membuat..." : "Buat Draft TP"}</Button>{drafts.length > 0 && <div className="mt-3 space-y-2">{drafts.map((d, i) => <div key={i} className="grid gap-2 sm:grid-cols-[6rem_1fr_auto]"><Input value={d.code} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} /><Input value={d.description} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /><Button size="icon" variant="ghost" aria-label="Buang draft" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}><Trash2 className="size-4 text-destructive" /></Button></div>)}<Button onClick={() => addTps.mutate(drafts.filter((d) => d.description.trim()))}><Save className="size-4" /> Simpan Semua Draft</Button></div>}</details>
          </section>
          <TaggedAssessments subject={subject} classId={classId} objectives={objectives} assignments={assignments as any[]} onSaved={() => qc.invalidateQueries({ queryKey: ["tp-assignments"] })} />
        </div>
      </details>

      <section className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold">Rekap Nilai per Siswa & TP</h2><p className="text-sm text-muted-foreground">Nilai Latihan AI adalah nilai tambahan dan tidak mengubah nilai akhir. Tekan nama siswa untuk melihat umpan balik.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={saveAdab.isPending} onClick={() => saveAdab.mutate()}><Save className="size-4" /> Simpan Adab</Button>{rows.length > 0 && <ExportMenu backupGrades filename={`rekap-tp-${subject}`} title={`Rekap Nilai & TP · ${subject}`} columns={exportColumns} rows={exportRows} />}</div>
        </div>
        {practiceError && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Nilai Latihan AI belum dapat dimuat: {practiceError.message}</p>}
        {weightError ? <p className="mt-3 text-sm text-destructive">{weightError}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Siswa</th>{objectives.map((o) => <th key={o.id} className="p-2 text-center" title={o.description}>{o.code}</th>)}<th className="p-2 text-center">Sumatif</th><th className="p-2 text-center">Adab</th><th className="p-2 text-center">Absensi</th><th className="p-2 text-center">Latihan AI<br /><span className="text-xs font-normal">tambahan</span></th><th className="p-2 text-center">Akhir</th></tr></thead><tbody>{rows.map((r) => {
          const studentAttempts = attemptsFor(r.student_id);
          const open = openStudent === r.student_id;
          return <Fragment key={r.student_id}><tr className="border-b"><td className="p-2"><button className="flex items-center gap-1 text-left font-semibold" onClick={() => setOpenStudent(open ? null : r.student_id)}><ChevronDown className={`size-4 transition ${open ? "rotate-180" : "-rotate-90"}`} />{r.name}</button></td>{objectives.map((o) => <td key={o.id} className="p-2 text-center">{r.perTp[o.id] ?? "—"}</td>)}<td className="p-2 text-center">{r.sumatif ?? "—"}</td><td className="p-1"><Input aria-label={`Adab ${r.name}`} type="number" min={0} max={100} value={adabDraft[r.student_id] ?? 0} onChange={(e) => setAdabDraft((d) => ({ ...d, [r.student_id]: Number(e.target.value) }))} className="mx-auto h-9 w-16 text-center" /></td><td className="p-2 text-center">{r.absensi ?? "—"}</td><td className="p-2 text-center"><span className="font-display font-bold text-primary">{aiAverage(r.student_id) ?? "—"}</span>{studentAttempts.length > 0 && <span className="block text-xs text-muted-foreground">{studentAttempts.length} latihan</span>}</td><td className="p-2 text-center font-bold">{r.final ?? "—"} <span className="text-xs text-muted-foreground">({r.predikat})</span></td></tr>{open && <tr className="border-b bg-muted/30"><td colSpan={objectives.length + 6} className="p-3"><div className="space-y-3"><div className="flex items-start gap-2"><p className="flex-1 text-sm"><b>Deskripsi rapor:</b> {r.description}</p><Button size="sm" variant="ghost" aria-label={`Salin deskripsi ${r.name}`} onClick={() => { navigator.clipboard.writeText(r.description); toast.success("Deskripsi disalin"); }}><Copy className="size-4" /></Button></div><p className="text-xs text-muted-foreground"><b>Formatif:</b> {r.formatif.count ? `${r.formatif.count} penilaian · rata-rata ${r.formatif.avg}${r.formatif.lastFeedback ? ` · ${r.formatif.lastFeedback}` : ""}` : "Belum ada umpan balik formatif."}</p>{studentAttempts.length > 0 && <div className="space-y-2"><p className="flex items-center gap-2 text-sm font-semibold"><BookOpenCheck className="size-4 text-primary" />Nilai tambahan & umpan balik Latihan AI</p>{studentAttempts.map((a) => <div key={a.id} className="rounded-xl border border-border bg-card p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold">{a.topic}</span><span className="font-bold text-primary">{a.score}/100 · {a.correct_count}/{a.question_count} benar</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("id-ID")}</p><p className="mt-2 text-sm">{a.feedback}</p></div>)}</div>}</div></td></tr>}</Fragment>;
        })}</tbody></table></div>}
      </section>
    </div>
  );
}

function TpRow({ o, onSave, onDelete }: { o: Objective; onSave: (v: { id: string; code: string; description: string }) => void; onDelete: () => void }) {
  const [code, setCode] = useState(o.code);
  const [desc, setDesc] = useState(o.description);
  const dirty = code !== o.code || desc !== o.description;
  return <div className="grid gap-2 sm:grid-cols-[6rem_1fr_auto_auto]"><Input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Kode TP" /><Input value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Deskripsi TP" /><Button size="sm" variant="outline" disabled={!dirty || !desc.trim()} onClick={() => onSave({ id: o.id, code, description: desc })}><Save className="size-4" /></Button><Button size="icon" variant="ghost" aria-label="Hapus TP" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button></div>;
}

function TaggedAssessments({ subject, classId, objectives, assignments, onSaved }: { subject: string; classId: string; objectives: Objective[]; assignments: TaggedA[]; onSaved: () => void }) {
  const [edit, setEdit] = useState<TaggedA | null>(null);
  const [kind, setKind] = useState("sumatif");
  const [oid, setOid] = useState("");
  const [w, setW] = useState<Record<string, number>>({});
  const code = (id: string) => objectives.find((o) => o.id === id)?.code ?? "TP?";
  const open = (a: TaggedA) => { setEdit(a); setKind(a.assessment_kind); setOid(a.objective_id ?? ""); setW(a.objective_weights ?? {}); };
  const save = useMutation({
    mutationFn: async () => {
      const err = validateTpWeights(w); if (err) throw new Error(err);
      const { error } = await supabase.from("assignments").update({ assessment_kind: kind, objective_id: oid || null, objective_weights: Object.keys(w).length > 1 ? w : {} }).eq("id", edit!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tagging TP diperbarui"); setEdit(null); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <section className="border-t border-border pt-4"><h2 className="font-display text-lg font-bold">Penilaian & Tagging TP</h2><p className="text-sm text-muted-foreground">Edit tugas dan nilai manual untuk mengubah jenis asesmen, TP, serta porsinya.</p>{!assignments.length ? <p className="mt-3 text-sm text-muted-foreground">Belum ada penilaian.</p> : <ul className="mt-3 grid gap-2">{assignments.map((a) => { const shares = tpShares(a); const ids = Object.keys(shares); const manual = (a.description ?? "").startsWith("[tatap-muka]"); return <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{manual ? "Nilai manual" : "Tugas"}{a.exam_type ? ` · ${a.exam_type.toUpperCase()}` : ""} · {a.assessment_kind === "formatif" ? "Formatif" : "Sumatif"} · {ids.length ? ids.map((id) => ids.length > 1 ? `${code(id)} ${Math.round(shares[id] * 100)}%` : code(id)).join(", ") : "Belum ada TP"}</p></div><Button size="sm" variant="outline" onClick={() => open(a)}><Pencil className="size-4" /> Edit</Button></li>; })}</ul>}<Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>Edit TP · {edit?.title}</DialogTitle></DialogHeader><TpFields subject={subject} classId={classId} kind={kind} objectiveId={oid} weights={w} onKind={setKind} onChange={(id, nw) => { setOid(id); setW(nw); }} /><DialogFooter><Button disabled={save.isPending} onClick={() => save.mutate()}><Save className="size-4" /> Simpan</Button></DialogFooter></DialogContent></Dialog></section>;
}
