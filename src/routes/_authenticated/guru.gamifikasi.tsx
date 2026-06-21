import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Trophy, Crown, Star, Coins } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/gamifikasi")({
  head: () => ({ meta: [{ title: "Gamifikasi · EduQuest" }] }),
  component: GuruGamifikasiPage,
});

function GuruGamifikasiPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: badges = [] } = useQuery({
    queryKey: ["badges"], queryFn: async () => (await supabase.from("badges").select("*").order("xp_requirement")).data ?? [],
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard-all", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: enrolls } = await supabase.from("class_enrollments").select("student_id, classes!inner(teacher_id)").eq("classes.teacher_id", user!.id);
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids).order("xp", { ascending: false }).limit(20);
      return profs ?? [];
    },
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navGamification")} subtitle={lang === "id" ? "Kelola badge dan pantau leaderboard murid" : "Manage badges and watch the student leaderboard"} />

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Award className="size-5 text-coin" /> {t("badgeCatalog")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b: any) => (
            <div key={b.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-xl bg-gradient-magic text-white text-xl">🏅</div>
                <div className="min-w-0">
                  <div className="font-display font-bold">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.description}</div>
                </div>
              </div>
              {b.xp_requirement > 0 && <div className="mt-2 text-xs text-muted-foreground">≥ {b.xp_requirement} XP</div>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Trophy className="size-5 text-quest" /> {t("leaderboard")}</h2>
        {leaderboard.length === 0 ? <EmptyState message={t("empty")} /> : (
          <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card-rpg">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">{t("fullName")}</th><th className="px-4 py-3 text-right">{t("level")}</th><th className="px-4 py-3 text-right">{t("xp")}</th><th className="px-4 py-3 text-right">{t("coins")}</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((p: any, i: number) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-display font-bold">{i === 0 ? <Crown className="size-4 text-coin" /> : i + 1}</td>
                    <td className="px-4 py-3 font-display font-semibold">{p.full_name}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-primary"><Star className="size-3" /> {p.level}</span></td>
                    <td className="px-4 py-3 text-right font-display font-bold text-xp">{p.xp}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-coin"><Coins className="size-3" /> {p.coins}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
