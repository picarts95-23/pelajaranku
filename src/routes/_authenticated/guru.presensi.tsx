import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/presensi")({
  head: () => ({ meta: [{ title: "Presensi · EduQuest" }] }),
  component: GuruPresensiPage,
});

const STATUSES = ["hadir", "izin", "sakit", "alpa"] as const;
type AttStatus = typeof STATUSES[number];

function GuruPresensiPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});

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
      return profs ?? [];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["att", classId, date], enabled: !!classId && !!date,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("class_id", classId).eq("date", date);
      return data ?? [];
    },
  });

  useEffect(() => {
    const initial: Record<string, AttStatus> = {};
    students.forEach((s: any) => { initial[s.id] = "hadir"; });
    existing.forEach((a: any) => { initial[a.student_id] = a.status; });
    setMarks(initial);
  }, [students, existing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !classId) return;
      const rows = students.map((s: any) => ({
        class_id: classId, student_id: s.id, date, status: marks[s.id] ?? "hadir", recorded_by: user.id,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,student_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Presensi disimpan" : "Attendance saved");
      qc.invalidateQueries({ queryKey: ["att", classId, date] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navAttendance")} subtitle={lang === "id" ? "Catat kehadiran harian per kelas" : "Mark daily attendance per class"} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,200px,auto]">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="guru" disabled={!classId || students.length === 0 || saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="size-4" /> {t("save")}
        </Button>
      </div>

      {!classId ? <EmptyState message={t("selectClass")} /> : students.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card-rpg">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">{t("fullName")}</th><th className="px-4 py-3 text-left">{t("status")}</th></tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-display font-semibold">{s.full_name}</td>
                  <td className="px-4 py-3">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
