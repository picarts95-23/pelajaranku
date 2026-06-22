import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trophy, SlidersHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/presensi")({
  head: () => ({ meta: [{ title: "Presensi · EduQuest Academy" }] }),
  component: GuruPresensiPage,
});

const STATUSES = ["hadir", "izin", "sakit", "alpa"] as const;
type AttStatus = typeof STATUSES[number];

// Weight (0-100) each status contributes per meeting to the accumulated attendance score.
const DEFAULT_WEIGHTS: Record<AttStatus, number> = { hadir: 100, izin: 50, sakit: 50, alpa: 0 };
const WEIGHTS_KEY = "eduquest:attendance-weights";

function loadWeights(): Record<AttStatus, number> {
  if (typeof window === "undefined") return { ...DEFAULT_WEIGHTS };
  try {
    const raw = window.localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw);
    return {
      hadir: clampWeight(parsed.hadir, DEFAULT_WEIGHTS.hadir),
      izin: clampWeight(parsed.izin, DEFAULT_WEIGHTS.izin),
      sakit: clampWeight(parsed.sakit, DEFAULT_WEIGHTS.sakit),
      alpa: clampWeight(parsed.alpa, DEFAULT_WEIGHTS.alpa),
    };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

function clampWeight(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function GuruPresensiPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<AttStatus, number>>(DEFAULT_WEIGHTS);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { setWeights(loadWeights()); }, []);

  function saveWeights(next: Record<AttStatus, number>) {
    setWeights(next);
    try { window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["enrolls", classId], enabled: !!classId,
    queryFn: async () => {
      const { data: enrolls } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = (enrolls ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      // Sort alphabetically by name (berdasarkan abjad).
      return (profs ?? []).sort((a: any, b: any) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "", "id", { sensitivity: "base" }),
      );
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["att", classId, date], enabled: !!classId && !!date,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("class_id", classId).eq("date", date);
      return data ?? [];
    },
  });

  // All attendance records for this class — used to accumulate an attendance score.
  const { data: allAtt = [] } = useQuery({
    queryKey: ["att-all", classId], enabled: !!classId,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("student_id, status, date").eq("class_id", classId);
      return data ?? [];
    },
  });

  const recap = useMemo(() => {
    const byStudent: Record<string, { hadir: number; izin: number; sakit: number; alpa: number; total: number; score: number }> = {};
    const dates = new Set<string>();
    (allAtt as any[]).forEach((a) => dates.add(a.date));
    const totalMeetings = dates.size;
    students.forEach((s: any) => {
      const recs = (allAtt as any[]).filter((a) => a.student_id === s.id);
      const counts = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      let weighted = 0;
      recs.forEach((r) => {
        const st = r.status as AttStatus;
        if (st in counts) counts[st as keyof typeof counts]++;
        weighted += weights[st] ?? 0;
      });
      // Each meeting's weight is already on a 0-100 scale, so the average is the score.
      const score = totalMeetings > 0 ? Math.round(weighted / totalMeetings) : 0;
      byStudent[s.id] = { ...counts, total: recs.length, score };
    });
    return { byStudent, totalMeetings };
  }, [allAtt, students, weights]);

  useEffect(() => {
    const initialMarks: Record<string, AttStatus> = {};
    const initialNotes: Record<string, string> = {};
    students.forEach((s: any) => { initialMarks[s.id] = "hadir"; initialNotes[s.id] = ""; });
    existing.forEach((a: any) => { initialMarks[a.student_id] = a.status; initialNotes[a.student_id] = a.note ?? ""; });
    setMarks(initialMarks);
    setNotes(initialNotes);
  }, [students, existing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !classId) return;
      const rows = students.map((s: any) => ({
        class_id: classId, student_id: s.id, date, status: marks[s.id] ?? "hadir",
        note: notes[s.id]?.trim() || null, recorded_by: user.id,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,student_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Presensi disimpan" : "Attendance saved");
      qc.invalidateQueries({ queryKey: ["att", classId, date] });
      qc.invalidateQueries({ queryKey: ["att-all", classId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navAttendance")} subtitle={lang === "id" ? "Catat kehadiran harian, urut abjad, dengan akumulasi nilai" : "Mark daily attendance (A-Z) with accumulated score"} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,200px,auto,auto]">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="outline" onClick={() => setShowSettings((v) => !v)}>
          <SlidersHorizontal className="size-4" /> {t("scoreSettings")}
        </Button>
        <Button variant="guru" disabled={!classId || students.length === 0 || saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="size-4" /> {t("save")}
        </Button>
      </div>

      {showSettings && (
        <div className="mb-4 rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold">{t("scoreWeights")}</h3>
            <Button variant="ghost" size="sm" onClick={() => saveWeights({ ...DEFAULT_WEIGHTS })}>
              <RotateCcw className="size-3.5" /> {t("resetDefault")}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {STATUSES.map((st) => (
              <label key={st} className="flex flex-col gap-1">
                <span className="text-xs font-display font-semibold capitalize text-muted-foreground">{t(st)}</span>
                <Input
                  type="number" min={0} max={100} value={weights[st]}
                  onChange={(e) => saveWeights({ ...weights, [st]: clampWeight(e.target.value, weights[st]) })}
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {lang === "id"
              ? "Bobot adalah nilai 0–100 yang disumbang setiap status per pertemuan. Nilai akhir = rata-rata bobot seluruh pertemuan. Disimpan otomatis di perangkat ini."
              : "Weights are 0–100 values each status contributes per meeting. Final score = average weight across all meetings. Saved automatically on this device."}
          </p>
        </div>
      )}


      {!classId ? <EmptyState message={t("selectClass")} /> : students.length === 0 ? <EmptyState message={t("empty")} /> : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            {t("totalMeetings")}: <span className="font-display font-bold text-foreground">{recap.totalMeetings}</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card shadow-card-rpg">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left w-10">#</th>
                  <th className="px-3 py-3 text-left">{t("fullName")}</th>
                  <th className="px-3 py-3 text-left">{t("status")}</th>
                  <th className="px-3 py-3 text-left">{t("keterangan")}</th>
                  <th className="px-3 py-3 text-right">{t("attendanceScore")}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s: any, i: number) => {
                  const r = recap.byStudent[s.id];
                  return (
                    <tr key={s.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3 font-display font-semibold">
                        {s.full_name}
                        {r && r.total > 0 && (
                          <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                            H{r.hadir} · I{r.izin} · S{r.sakit} · A{r.alpa}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {STATUSES.map((st) => (
                            <button key={st} onClick={() => setMarks({ ...marks, [s.id]: st })}
                              className={`rounded-lg px-3 py-1 text-xs font-display font-bold capitalize ${
                                marks[s.id] === st
                                  ? st === "hadir" ? "bg-xp text-white" : st === "izin" ? "bg-quest text-white" : st === "sakit" ? "bg-coin text-white" : "bg-destructive text-white"
                                  : "bg-muted text-foreground/70 hover:bg-muted/70"
                              }`}>{t(st)}</button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-[160px]">
                        <Input
                          value={notes[s.id] ?? ""}
                          onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                          placeholder={t("keterangan")}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-xs font-bold ${
                          !r || r.total === 0 ? "bg-muted text-muted-foreground"
                            : r.score >= 75 ? "bg-xp/20 text-xp"
                            : r.score >= 50 ? "bg-coin/20 text-coin"
                            : "bg-destructive/20 text-destructive"
                        }`}>
                          <Trophy className="size-3" /> {r ? r.score : 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "id"
              ? `Nilai = (Hadir×${weights.hadir} + Izin×${weights.izin} + Sakit×${weights.sakit} + Alpa×${weights.alpa}) ÷ total pertemuan.`
              : `Score = (Present×${weights.hadir} + Excused×${weights.izin} + Sick×${weights.sakit} + Absent×${weights.alpa}) ÷ total meetings.`}
          </p>
        </>
      )}
    </DashboardShell>
  );
}
