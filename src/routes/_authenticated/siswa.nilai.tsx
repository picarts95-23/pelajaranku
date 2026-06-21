import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, MessageCircle, Sparkles } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/nilai")({
  head: () => ({ meta: [{ title: "Nilai Saya · EduQuest" }] }),
  component: SiswaNilaiPage,
});

function SiswaNilaiPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: graded = [] } = useQuery({
    queryKey: ["my-grades", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("submissions").select("*, assignments(title, max_score, classes(name))").eq("student_id", user!.id).eq("status", "graded").order("graded_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: xpTx = [] } = useQuery({
    queryKey: ["xp-tx", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("xp_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: true }).limit(30);
      return data ?? [];
    },
  });

  let cum = 0;
  const chartData = xpTx.map((t: any) => ({ date: format(new Date(t.created_at), "dd/MM"), xp: (cum += t.xp_amount) }));

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("navGrades")} subtitle={lang === "id" ? "Riwayat nilai dan progres XP kamu" : "Your grade history and XP progress"} />

      {chartData.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
          <h3 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Sparkles className="size-5 text-xp" /> {t("xpHistory")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="xp" stroke="hsl(var(--xp))" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {graded.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada nilai. Kerjakan quest dulu!" : "No grades yet. Complete quests first!"} /> : (
        <div className="space-y-3">
          {graded.map((s: any) => {
            const pct = Math.round((s.score / s.assignments.max_score) * 100);
            return (
              <div key={s.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-11 place-items-center rounded-xl bg-gradient-hero text-white"><GraduationCap className="size-5" /></div>
                    <div className="min-w-0">
                      <div className="font-display font-bold truncate">{s.assignments?.title}</div>
                      <div className="text-xs text-muted-foreground">{s.assignments?.classes?.name} · {s.graded_at ? format(new Date(s.graded_at), "dd MMM yyyy") : ""}</div>
                    </div>
                  </div>
                  <div className={`text-right font-display text-2xl font-bold ${pct >= 80 ? "text-xp" : pct >= 60 ? "text-coin" : "text-destructive"}`}>
                    {s.score}<span className="text-sm text-muted-foreground">/{s.assignments?.max_score}</span>
                  </div>
                </div>
                {s.feedback && <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm"><MessageCircle className="size-4 shrink-0 text-primary mt-0.5" /><span>{s.feedback}</span></div>}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
