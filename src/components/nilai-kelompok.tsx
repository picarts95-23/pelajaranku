import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Save, CalendarDays, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/** Marker stored in assignments.description for face-to-face GROUP work
 *  sessions, followed by the JSON group structure. */
export const GROUP_MARK = "[kerja-kelompok]";

type Student = { id: string; full_name: string };

type Rubric = { kerjasama: number; kontribusi: number; presentasi: number; hasil: number };
type Group = { name: string; members: string[]; rubric: Rubric; notes: string; adjust: Record<string, number> };

const EXAM_TYPES = ["harian", "uts", "uas"] as const;

const CRITERIA: { key: keyof Rubric; id: string; en: string; weight: number }[] = [
  { key: "kerjasama", id: "Kerjasama", en: "Teamwork", weight: 0.25 },
  { key: "kontribusi", id: "Kontribusi", en: "Contribution", weight: 0.25 },
  { key: "presentasi", id: "Presentasi", en: "Presentation", weight: 0.2 },
  { key: "hasil", id: "Hasil Karya", en: "Output quality", weight: 0.3 },
];

const emptyRubric = (): Rubric => ({ kerjasama: 80, kontribusi: 80, presentasi: 80, hasil: 80 });
const newGroup = (n: number): Group => ({
  name: `Kelompok ${n}`, members: [], rubric: emptyRubric(), notes: "", adjust: {},
});

/** Weighted rubric average (0-100). */
function rubricAvg(r: Rubric): number {
  return CRITERIA.reduce((sum, c) => sum + (Number(r[c.key]) || 0) * c.weight, 0);
}

/**
 * Detailed face-to-face GROUP work assessment. A session is stored as one
 * assignment (marked with GROUP_MARK, group structure kept as JSON in the
 * description) plus a graded submission per group member, so group scores flow
 * into the grade recap, progress report and exports like any other task.
 */
export function NilaiKelompok({ classId, subject, students }: { classId: string; subject: string; students: Student[] }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("new");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<string>("harian");
  const [maxScore, setMaxScore] = useState(100);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [groups, setGroups] = useState<Group[]>([newGroup(1)]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["group-sessions", classId, subject],
    enabled: !!classId && !!subject && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, description, exam_type, max_score, due_at, submissions(id, student_id, score)")
        .eq("class_id", classId)
        .eq("subject", subject)
        .eq("teacher_id", user!.id)
        .like("description", `${GROUP_MARK}%`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const active = useMemo(() => (sessions as any[]).find((s) => s.id === sessionId), [sessions, sessionId]);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title);
    setExamType(active.exam_type);
    setMaxScore(active.max_score);
    setDate((active.due_at ?? new Date().toISOString()).slice(0, 10));
    let parsed: Group[] | null = null;
    try {
      const raw = String(active.description ?? "").slice(GROUP_MARK.length).trim();
      const json = raw ? JSON.parse(raw) : null;
      if (json && Array.isArray(json.groups)) parsed = json.groups;
    } catch { /* legacy/unparsable description — start fresh */ }
    setGroups(parsed && parsed.length ? parsed.map((g) => ({ ...newGroup(1), ...g, rubric: { ...emptyRubric(), ...g.rubric }, adjust: g.adjust ?? {} })) : [newGroup(1)]);
  }, [active]);

  function resetNew() {
    setSessionId("new");
    setTitle("");
    setExamType("harian");
    setMaxScore(100);
    setDate(new Date().toISOString().slice(0, 10));
    setGroups([newGroup(1)]);
  }

  const nameOf = (id: string) => students.find((s) => s.id === id)?.full_name ?? "—";
  const assignedElsewhere = (gi: number, id: string) => groups.some((g, i) => i !== gi && g.members.includes(id));

  function patchGroup(i: number, patch: Partial<Group>) {
    setGroups((gs) => gs.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  function toggleMember(i: number, id: string) {
    setGroups((gs) => gs.map((g, idx) => {
      if (idx !== i) return g;
      const has = g.members.includes(id);
      const members = has ? g.members.filter((m) => m !== id) : [...g.members, id];
      const adjust = { ...g.adjust };
      if (has) delete adjust[id];
      return { ...g, members, adjust };
    }));
  }

  /** Final score for one member: weighted group rubric + individual adjustment. */
  function memberScore(g: Group, id: string): number {
    const base = (rubricAvg(g.rubric) / 100) * maxScore;
    const adj = Number(g.adjust[id] ?? 0);
    return Math.max(0, Math.min(maxScore, Math.round(base + adj)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      const clean = title.trim();
      if (!clean) throw new Error(lang === "id" ? "Judul penilaian wajib diisi." : "Title is required.");
      const filled = groups.filter((g) => g.members.length > 0);
      if (filled.length === 0) throw new Error(lang === "id" ? "Isi minimal satu kelompok dengan anggota." : "Add at least one group with members.");

      const entries: { id: string; score: number; note: string }[] = [];
      for (const g of filled) {
        const detail = CRITERIA.map((c) => `${lang === "id" ? c.id : c.en} ${Math.round(Number(g.rubric[c.key]) || 0)}`).join(", ");
        for (const m of g.members) {
          const adj = Number(g.adjust[m] ?? 0);
          entries.push({
            id: m,
            score: memberScore(g, m),
            note: `${lang === "id" ? "Kerja kelompok" : "Group work"}: ${g.name} · ${detail}${adj ? ` · ${lang === "id" ? "penyesuaian" : "adjustment"} ${adj > 0 ? "+" : ""}${adj}` : ""}${g.notes.trim() ? ` · ${g.notes.trim()}` : ""}`,
          });
        }
      }

      const description = `${GROUP_MARK} ${JSON.stringify({ groups: filled })}`;
      const dueAt = new Date(`${date}T23:59:59`).toISOString();
      let assignmentId = active?.id as string | undefined;
      if (assignmentId) {
        const { error } = await supabase.from("assignments")
          .update({ title: clean, description, exam_type: examType, max_score: maxScore, due_at: dueAt })
          .eq("id", assignmentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("assignments").insert({
          teacher_id: user.id, class_id: classId, subject, title: clean, description,
          exam_type: examType, max_score: maxScore, due_at: dueAt,
          xp_reward: 0, coin_reward: 0, answer_format: "descriptive",
        }).select("id").single();
        if (error) throw error;
        assignmentId = data.id;
      }

      const existing: Record<string, string> = {};
      (active?.submissions ?? []).forEach((s: any) => { existing[s.student_id] = s.id; });

      const inserts = entries.filter((e) => !existing[e.id]).map((e) => ({
        assignment_id: assignmentId!, student_id: e.id, score: e.score,
        status: "graded" as const, graded_by: user.id, graded_at: new Date().toISOString(),
        content: e.note,
      }));
      if (inserts.length) {
        const { error } = await supabase.from("submissions").insert(inserts);
        if (error) throw error;
      }
      for (const e of entries.filter((x) => existing[x.id])) {
        const { error } = await supabase.from("submissions")
          .update({ score: e.score, status: "graded", content: e.note, graded_by: user.id, graded_at: new Date().toISOString() })
          .eq("id", existing[e.id]);
        if (error) throw error;
      }
      // Members removed from every group lose their score for this session.
      const stale = Object.keys(existing).filter((sid) => !entries.some((e) => e.id === sid));
      for (const sid of stale) {
        await supabase.from("submissions").update({ score: null, status: "submitted" }).eq("id", existing[sid]);
      }
      return entries.length;
    },
    onSuccess: (n) => {
      toast.success(lang === "id" ? `${n} nilai kerja kelompok tersimpan ✅` : `${n} group scores saved ✅`);
      qc.invalidateQueries({ queryKey: ["group-sessions"] });
      qc.invalidateQueries({ queryKey: ["rekap-assignments"] });
      qc.invalidateQueries({ queryKey: ["laporan-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const { error } = await supabase.from("assignments").delete().eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Penilaian kerja kelompok dihapus" : "Group session deleted");
      resetNew();
      qc.invalidateQueries({ queryKey: ["group-sessions"] });
      qc.invalidateQueries({ queryKey: ["rekap-assignments"] });
      qc.invalidateQueries({ queryKey: ["laporan-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-3xl border-2 border-guru/40 bg-guru/5 shadow-card-rpg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-display font-bold text-guru"
      >
        <Users className="size-5" />
        {lang === "id" ? "Penilaian Kerja Kelompok (Tatap Muka)" : "Group Work Assessment (In Class)"}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {sessions.length > 0 && `${sessions.length} ${lang === "id" ? "penilaian" : "sessions"} · `}{open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t-2 border-guru/20 p-4">
          <p className="text-xs text-muted-foreground">
            {lang === "id"
              ? "Nilai kelompok dihitung dari rubrik (Kerjasama 25% + Kontribusi 25% + Presentasi 20% + Hasil Karya 30%), lalu setiap anggota bisa diberi penyesuaian nilai individu. Hasilnya langsung masuk ke rekap nilai, laporan progres, dan ekspor."
              : "The group score comes from the rubric (Teamwork 25% + Contribution 25% + Presentation 20% + Output 30%); each member can get an individual adjustment. Results flow into the recap, progress report and exports."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Pilih Penilaian" : "Session"}</label>
              <Select value={sessionId} onValueChange={(v) => { if (v === "new") resetNew(); else setSessionId(v); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">➕ {lang === "id" ? "Penilaian baru" : "New session"}</SelectItem>
                  {(sessions as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title} · {String(s.exam_type).toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Judul Kegiatan Kelompok" : "Group activity title"}</label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === "id" ? "Diskusi kelompok Bab 3" : "Chapter 3 group discussion"} />
            </div>
            <div>
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Jenis" : "Type"}</label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x === "harian" ? (lang === "id" ? "Harian (20%)" : "Daily (20%)") : x === "uts" ? "UTS (20%)" : "UAS (30%)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Nilai Maksimal" : "Max score"}</label>
              <Input className="mt-1" type="number" min={1} max={1000} value={maxScore}
                onChange={(e) => setMaxScore(Math.max(1, +e.target.value || 100))} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {lang === "id" ? "Tanggal" : "Date"}
              </label>
              <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === "id" ? "Belum ada siswa di kelas ini." : "No students in this class."}</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g, gi) => (
                <div key={gi} className="space-y-3 rounded-2xl border-2 border-border bg-card p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={g.name}
                      onChange={(e) => patchGroup(gi, { name: e.target.value })}
                      className="h-9 w-full font-display font-bold sm:w-56"
                      placeholder={lang === "id" ? "Nama kelompok" : "Group name"}
                    />
                    <span className="rounded-full bg-guru/10 px-3 py-1 text-xs font-display font-bold text-guru">
                      {lang === "id" ? "Nilai kelompok" : "Group score"}: {Math.round((rubricAvg(g.rubric) / 100) * maxScore)}/{maxScore}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {g.members.length} {lang === "id" ? "anggota" : "members"}
                    </span>
                    {groups.length > 1 && (
                      <Button variant="ghost" size="sm" className="ml-auto text-destructive"
                        onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>
                        <Trash2 className="size-4" /> {lang === "id" ? "Hapus kelompok" : "Remove group"}
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {CRITERIA.map((c) => (
                      <div key={c.key}>
                        <label className="text-xs font-display font-semibold">
                          {lang === "id" ? c.id : c.en} <span className="font-normal text-muted-foreground">({Math.round(c.weight * 100)}%)</span>
                        </label>
                        <Input
                          className="mt-1 h-9" type="number" inputMode="numeric" min={0} max={100}
                          value={g.rubric[c.key]}
                          onChange={(e) => patchGroup(gi, { rubric: { ...g.rubric, [c.key]: Math.max(0, Math.min(100, +e.target.value || 0)) } })}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-display font-semibold">{lang === "id" ? "Anggota Kelompok" : "Members"}</p>
                    <div className="flex flex-wrap gap-2">
                      {students.map((s) => {
                        const picked = g.members.includes(s.id);
                        const taken = !picked && assignedElsewhere(gi, s.id);
                        return (
                          <button
                            key={s.id} type="button" disabled={taken}
                            onClick={() => toggleMember(gi, s.id)}
                            className={`rounded-full border-2 px-3 py-1.5 text-xs font-display font-semibold transition ${
                              picked ? "border-guru bg-guru/15 text-guru"
                                : taken ? "border-border bg-muted/50 text-muted-foreground opacity-60"
                                : "border-border bg-card hover:border-guru/50"
                            }`}
                          >
                            {picked ? "✓ " : ""}{s.full_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {g.members.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border-2 border-border">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">{lang === "id" ? "Anggota" : "Member"}</th>
                            <th className="px-3 py-2 text-center">{lang === "id" ? "Penyesuaian" : "Adjustment"}</th>
                            <th className="px-3 py-2 text-center">{lang === "id" ? "Nilai Akhir" : "Final score"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.members.map((m) => (
                            <tr key={m} className="border-t border-border">
                              <td className="px-3 py-2 font-display font-semibold">{nameOf(m)}</td>
                              <td className="px-3 py-2 text-center">
                                <Input
                                  type="number" inputMode="numeric" min={-50} max={50}
                                  value={g.adjust[m] ?? 0}
                                  onChange={(e) => patchGroup(gi, { adjust: { ...g.adjust, [m]: Math.max(-50, Math.min(50, +e.target.value || 0)) } })}
                                  className="mx-auto h-9 w-20 text-center"
                                />
                              </td>
                              <td className="px-3 py-2 text-center font-display font-bold text-guru">{memberScore(g, m)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-display font-semibold">{lang === "id" ? "Catatan Kelompok" : "Group notes"}</label>
                    <Input className="mt-1" value={g.notes} onChange={(e) => patchGroup(gi, { notes: e.target.value })}
                      placeholder={lang === "id" ? "Presentasi rapi, pembagian tugas jelas…" : "Clear roles, tidy presentation…"} />
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={() => setGroups((gs) => [...gs, newGroup(gs.length + 1)])}>
                <UserPlus className="size-4" /> {lang === "id" ? "Tambah kelompok" : "Add group"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="guru" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="size-4" /> {lang === "id" ? "Simpan Nilai Kelompok" : "Save group scores"}
            </Button>
            {sessionId !== "new" ? (
              <>
                <Button variant="outline" size="sm" onClick={resetNew}>
                  <Plus className="size-4" /> {lang === "id" ? "Penilaian baru" : "New session"}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending}
                  onClick={() => { if (confirm(lang === "id" ? "Hapus penilaian kerja kelompok ini beserta nilainya?" : "Delete this group session and its scores?")) remove.mutate(); }}>
                  <Trash2 className="size-4" /> {lang === "id" ? "Hapus" : "Delete"}
                </Button>
              </>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {lang === "id" ? "Satu siswa hanya bisa masuk satu kelompok per penilaian." : "A student can join only one group per session."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
