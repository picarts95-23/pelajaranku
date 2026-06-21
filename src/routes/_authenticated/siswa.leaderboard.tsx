import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown, Star, Coins } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/leaderboard")({
  head: () => ({ meta: [{ title: "Papan Peringkat · EduQuest" }] }),
  component: SiswaLeaderboardPage,
});

function SiswaLeaderboardPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: top = [] } = useQuery({
    queryKey: ["siswa-leaderboard", user?.id], enabled: !!user,
    queryFn: async () => {
      // Get classes the student is in, then peers in those classes
      const { data: myCls } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      const classIds = (myCls ?? []).map((e) => e.class_id);
      if (classIds.length === 0) return [];
      const { data: peers } = await supabase.from("class_enrollments").select("student_id").in("class_id", classIds);
      const ids = Array.from(new Set((peers ?? []).map((e) => e.student_id)));
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids).order("xp", { ascending: false }).limit(30);
      return profs ?? [];
    },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("leaderboard")} subtitle={lang === "id" ? "Para petualang dengan XP tertinggi" : "The highest-XP adventurers"} />
      {top.length === 0 ? <EmptyState message={lang === "id" ? "Bergabunglah ke kelas untuk melihat peringkat." : "Join a class to see the leaderboard."} /> : (
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card-rpg">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">{t("fullName")}</th><th className="px-4 py-3 text-right">{t("level")}</th><th className="px-4 py-3 text-right">{t("xp")}</th><th className="px-4 py-3 text-right hidden sm:table-cell">{t("coins")}</th></tr>
            </thead>
            <tbody>
              {top.map((p: any, i: number) => {
                const me = p.id === user?.id;
                return (
                  <tr key={p.id} className={`border-t border-border ${me ? "bg-siswa/10" : ""}`}>
                    <td className="px-4 py-3 font-display font-bold">{i === 0 ? <Crown className="size-4 text-coin" /> : i + 1}</td>
                    <td className="px-4 py-3 font-display font-semibold">{p.full_name}{me && ` (${lang === "id" ? "Kamu" : "You"})`}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-primary"><Star className="size-3" /> {p.level}</span></td>
                    <td className="px-4 py-3 text-right font-display font-bold text-xp">{p.xp}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell"><span className="inline-flex items-center gap-1 text-coin"><Coins className="size-3" /> {p.coins}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
