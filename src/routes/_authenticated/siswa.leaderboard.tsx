import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Crown, Star, Coins } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/siswa/leaderboard")({
  head: () => ({ meta: [{ title: "Papan Peringkat · EduQuest Academy" }] }),
  component: SiswaLeaderboardPage,
});

const REACTIONS = ["❤️", "👍", "🔥", "🌟", "👏", "🤲"];

function SiswaLeaderboardPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: top = [] } = useQuery({
    queryKey: ["siswa-leaderboard", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: myCls } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      const classIds = (myCls ?? []).map((e) => e.class_id);
      if (classIds.length === 0) return [];
      const { data: peers } = await supabase.from("class_enrollments").select("student_id").in("class_id", classIds);
      const ids = Array.from(new Set((peers ?? []).map((e) => e.student_id)));
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids).order("xp", { ascending: false }).limit(30);
      return profs ?? [];
    },
  });

  const studentIds = useMemo(() => (top as any[]).map((p) => p.id), [top]);

  const { data: reactions = [] } = useQuery({
    queryKey: ["peer-reactions", studentIds], enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("peer_reactions").select("target_student_id, reactor_id, emoji").in("target_student_id", studentIds);
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ target, emoji, has }: { target: string; emoji: string; has: boolean }) => {
      if (!user) return;
      if (has) {
        const { error } = await supabase.from("peer_reactions").delete()
          .eq("target_student_id", target).eq("reactor_id", user.id).eq("emoji", emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("peer_reactions").insert({ target_student_id: target, reactor_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["peer-reactions"] }),
  });

  function countFor(target: string, emoji: string) {
    return (reactions as any[]).filter((r) => r.target_student_id === target && r.emoji === emoji).length;
  }
  function mineFor(target: string, emoji: string) {
    return (reactions as any[]).some((r) => r.target_student_id === target && r.emoji === emoji && r.reactor_id === user?.id);
  }

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("leaderboard")} subtitle={lang === "id" ? "Para siswi dengan XP tertinggi · beri semangat dengan emoji!" : "Highest-XP students · cheer them with emoji!"} />
      {top.length === 0 ? <EmptyState message={lang === "id" ? "Bergabunglah ke kelas untuk melihat peringkat." : "Join a class to see the leaderboard."} /> : (
        <div className="space-y-3">
          {(top as any[]).map((p, i) => {
            const me = p.id === user?.id;
            return (
              <div key={p.id} className={cn("rounded-2xl border-2 bg-card p-4 shadow-card-rpg", me ? "border-siswa bg-siswa/5" : "border-border")}>
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-muted font-display font-bold">
                    {i === 0 ? <Crown className="size-5 text-coin" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-bold">{p.full_name}{me && ` (${lang === "id" ? "Kamu" : "You"})`}</div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-primary"><Star className="size-3" /> Lv {p.level}</span>
                      <span className="inline-flex items-center gap-1 font-bold text-xp"><Trophy className="size-3" /> {p.xp} XP</span>
                      <span className="inline-flex items-center gap-1 text-coin"><Coins className="size-3" /> {p.coins}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {REACTIONS.map((emoji) => {
                    const count = countFor(p.id, emoji);
                    const mine = mineFor(p.id, emoji);
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggle.mutate({ target: p.id, emoji, has: mine })}
                        disabled={toggle.isPending}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-sm transition-transform hover:scale-105",
                          mine ? "border-siswa bg-siswa/10" : "border-border bg-muted/40",
                        )}
                        aria-label={`react ${emoji}`}
                      >
                        <span role="img">{emoji}</span>
                        {count > 0 && <span className="font-display text-xs font-bold">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
