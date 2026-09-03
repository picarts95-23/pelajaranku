import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPen, Plus, Save, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/** Marker stored in assignments.description so face-to-face (offline) grade
 *  sessions can be told apart from regular app assignments. */
export const OFFLINE_MARK = "[tatap-muka]";

type Student = { id: string; full_name: string };

const EXAM_TYPES = ["harian", "uts", "uas"] as const;

/**
 * Manual grade entry for face-to-face tasks. Each session is stored as a normal
 * assignment + graded submissions, so the scores flow straight into the grade
 * recap, progress report and exports alongside in-app tasks.
 */
export function NilaiManual({ classId, subject, students }: { classId: string; subject: string; students: Student[] }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("new");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<string>("harian");
  const [maxScore, setMaxScore] = useState(100);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Record<string, string>>({});

  const { data: sessions = [] } = useQuery({
    queryKey: ["manual-sessions", classId, subject],
    enabled: !!classId && !!subject && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, description, exam_type, max_score, due_at, submissions(id, student_id, score)")
        .eq("class_id", classId)
        .eq("subject", subject)
        .eq("teacher_id", user!.id)
        .like("description", `${OFFLINE_MARK}%`)
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
    const map: Record<string, string> = {};
    (active.submissions ?? []).forEach((s: any) => { if (s.score != null) map[s.student_id] = String(s.score); });
    setScores(map);
  }, [active]);

  function resetNew() {
    setSessionId("new");
    setTitle("");
    setExamType("harian");
    setMaxScore(100);
    setDate(new Date().toISOString().slice(0, 10));
    setScores({});
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      const clean = title.trim();
      if (!clean) throw new Error(lang === "id" ? "Judul penilaian wajib diisi." : "Title is required.");
      const entries = students
        .map((s) => ({ id: s.id, raw: scores[s.id] }))
        .filter((e) => e.raw != null && e.raw !== "")
        .map((e) => ({ id: e.id, score: Math.max(0, Math.min(maxScore, Math.round(Number(e.raw)))) }))
        .filter((e) => Number.isFinite(e.score));
      if (entries.length === 0) throw new Error(lang === "id" ? "Isi minimal satu nilai siswa." : "Enter at least one score.");

      let assignmentId = active?.id as string | undefined;
      const dueAt = new Date(`${date}T23:59:59`).toISOString();
      if (assignmentId) {
        const { error } = await supabase.from("assignments")
          .update({ title: clean, exam_type: examType, max_score: maxScore, due_at: dueAt })
          .eq("id", assignmentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("assignments").insert({
          teacher_id: user.id, class_id: classId, subject, title: clean,
          description: `${OFFLINE_MARK} ${lang === "id" ? "Penilaian tatap muka" : "Face-to-face assessment"}`,
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
        content: lang === "id" ? "Dikerjakan tatap muka" : "Completed in person",
      }));
      if (inserts.length) {
        const { error } = await supabase.from("submissions").insert(inserts);
        if (error) throw error;
      }
      for (const e of entries.filter((x) => existing[x.id])) {
        const { error } = await supabase.from("submissions")
          .update({ score: e.score, status: "graded", graded_by: user.id, graded_at: new Date().toISOString() })
          .eq("id", existing[e.id]);
        if (error) throw error;
      }
      return entries.length;
    },
    onSuccess: (n) => {
      toast.success(lang === "id" ? `${n} nilai tatap muka tersimpan ✅` : `${n} scores saved ✅`);
      qc.invalidateQueries({ queryKey: ["manual-sessions"] });
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
      toast.success(lang === "id" ? "Penilaian tatap muka dihapus" : "Session deleted");
      resetNew();
      qc.invalidateQueries({ queryKey: ["manual-sessions"] });
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
        <ClipboardPen className="size-5" />
        {lang === "id" ? "Input Nilai Manual (Harian · UTS · UAS)" : "Manual Grades (Daily · Midterm · Final)"}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {sessions.length > 0 && `${sessions.length} ${lang === "id" ? "penilaian" : "sessions"} · `}{open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t-2 border-guru/20 p-4">
          <p className="text-xs text-muted-foreground">
            {lang === "id"
              ? "Nilai yang diinput di sini langsung masuk ke rekap nilai, laporan progres, dan ekspor — sama seperti tugas dari aplikasi."
              : "Scores entered here flow into the grade recap, progress report and exports just like in-app tasks."}
          </p>

          {/* Pintasan jenis penilaian — memudahkan guru langsung membuat UTS/UAS. */}
          <div className="flex flex-wrap gap-2">
            {EXAM_TYPES.map((x) => {
              const label = x === "harian" ? (lang === "id" ? "Harian (20%)" : "Daily (20%)") : x === "uts" ? "UTS (20%)" : "UAS (30%)";
              const count = (sessions as any[]).filter((s) => s.exam_type === x).length;
              return (
                <button
                  key={x}
                  type="button"
                  onClick={() => { resetNew(); setExamType(x); setTitle(x === "harian" ? "" : x.toUpperCase()); }}
                  className={`rounded-full border-2 px-3 py-1.5 text-xs font-display font-bold transition ${
                    examType === x ? "border-guru bg-guru text-white" : "border-guru/40 bg-card text-guru hover:bg-guru/10"
                  }`}
                >
                  {lang === "id" ? "Input " : "New "}{label}{count > 0 ? ` · ${count}` : ""}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Pilih Penilaian" : "Session"}</label>
              <Select value={sessionId} onValueChange={(v) => { if (v === "new") resetNew(); else setSessionId(v); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">➕ {lang === "id" ? "Penilaian baru" : "New session"}</SelectItem>
                  {(sessions as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title} · {s.exam_type.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Judul Penilaian" : "Title"}</label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === "id" ? "Ulangan Bab 3 (tatap muka)" : "Chapter 3 test (in class)"} />
            </div>
            <div>
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Jenis" : "Type"}</label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((x) => <SelectItem key={x} value={x}>{x === "harian" ? (lang === "id" ? "Harian (20%)" : "Daily (20%)") : x === "uts" ? "UTS (20%)" : "UAS (30%)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-display font-semibold">{lang === "id" ? "Nilai Maksimal" : "Max score"}</label>
              <Input className="mt-1" type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(Math.max(1, +e.target.value || 100))} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-display font-semibold flex items-center gap-1"><CalendarDays className="size-3.5" /> {lang === "id" ? "Tanggal" : "Date"}</label>
              <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === "id" ? "Belum ada siswa di kelas ini." : "No students in this class."}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card">
              <table className="w-full min-w-[380px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{lang === "id" ? "Nama Siswa" : "Student"}</th>
                    <th className="px-3 py-2 text-center">{lang === "id" ? "Nilai" : "Score"}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-display font-semibold">{s.full_name}</td>
                      <td className="px-3 py-2 text-center">
                        <Input
                          type="number" inputMode="numeric" min={0} max={maxScore}
                          value={scores[s.id] ?? ""}
                          placeholder="—"
                          onChange={(e) => setScores((d) => ({ ...d, [s.id]: e.target.value }))}
                          className="mx-auto h-9 w-20 text-center"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="guru" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="size-4" /> {lang === "id" ? "Simpan Nilai" : "Save scores"}
            </Button>
            {sessionId !== "new" ? (
              <>
                <Button variant="outline" size="sm" onClick={resetNew}>
                  <Plus className="size-4" /> {lang === "id" ? "Penilaian baru" : "New session"}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending}
                  onClick={() => { if (confirm(lang === "id" ? "Hapus penilaian tatap muka ini beserta nilainya?" : "Delete this session and its scores?")) remove.mutate(); }}>
                  <Trash2 className="size-4" /> {lang === "id" ? "Hapus" : "Delete"}
                </Button>
              </>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {lang === "id" ? "Kosongkan nilai siswa yang belum dinilai." : "Leave blank for ungraded students."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
