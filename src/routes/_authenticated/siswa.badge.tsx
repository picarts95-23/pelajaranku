import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Lock } from "lucide-react";
import { DashboardShell, PageHeader } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/badge")({
  head: () => ({ meta: [{ title: "Badge · Pelajaranku" }] }),
  component: SiswaBadgePage,
});

function SiswaBadgePage() {
  const { user, role, loading, profile } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: role === "admin" ? "/admin" : "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: badges = [] } = useQuery({
    queryKey: ["badges-all"], queryFn: async () => (await supabase.from("badges").select("*").order("xp_requirement")).data ?? [],
  });

  const { data: earned = [] } = useQuery({
    queryKey: ["my-badges", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_badges").select("badge_id").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.badge_id);
    },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("navBadges")} subtitle={lang === "id" ? "Koleksi lencana yang sudah kamu raih" : "Your earned achievements"} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((b: any) => {
          const isEarned = earned.includes(b.id) || (b.xp_requirement > 0 && (profile?.xp ?? 0) >= b.xp_requirement);
          return (
            <div key={b.id} className={`rounded-2xl border-2 p-5 text-center shadow-card-rpg transition ${isEarned ? "border-coin bg-card" : "border-border bg-muted/30"}`}>
              <div className={`mx-auto grid size-20 place-items-center rounded-full text-4xl ${isEarned ? "bg-gradient-magic text-white shadow-magic" : "bg-muted text-muted-foreground"}`}>
                {isEarned ? (b.icon ?? "🏅") : <Lock className="size-7" />}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold">{b.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
              <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-display font-bold ${isEarned ? "bg-xp/20 text-xp" : "bg-muted text-muted-foreground"}`}>
                <Award className="size-3" /> {isEarned ? t("earned") : t("locked")}
              </span>
              {b.xp_requirement > 0 && <div className="mt-1 text-xs text-muted-foreground">≥ {b.xp_requirement} XP</div>}
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
