import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Coins, Award, Sword } from "lucide-react";
import { DashboardShell, PageHeader, StatCard, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/riwayat")({
  head: () => ({ meta: [{ title: "Riwayat Gamifikasi · Pelajaranku" }] }),
  component: SiswaHistoryPage,
});

type Entry = {
  kind: "xp" | "badge";
  date: string;
  ts: number;
  title: string;
  xp?: number;
  coin?: number;
  icon?: string;
};

function SiswaHistoryPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: txs = [] } = useQuery({
    queryKey: ["xp-history", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("xp_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: badgeRows = [] } = useQuery({
    queryKey: ["badge-history", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("user_badges").select("badge_id, earned_at, badges(name, icon)").eq("user_id", user!.id).order("earned_at", { ascending: false })).data ?? [],
  });

  const locale = lang === "id" ? "id-ID" : lang === "ar" ? "ar" : "en-US";

  const { grouped, totalXp, totalCoins, badgeCount } = useMemo(() => {
    const entries: Entry[] = [];
    let xp = 0, coins = 0;
    for (const tx of txs as any[]) {
      const d = new Date(tx.created_at);
      xp += tx.xp_amount ?? 0;
      coins += tx.coin_amount ?? 0;
      entries.push({
        kind: "xp", date: d.toISOString().slice(0, 10), ts: d.getTime(),
        title: tx.note || (tx.source === "assignment" ? t("sourceAssignment") : tx.source),
        xp: tx.xp_amount, coin: tx.coin_amount,
      });
    }
    for (const b of badgeRows as any[]) {
      const d = new Date(b.earned_at);
      entries.push({
        kind: "badge", date: d.toISOString().slice(0, 10), ts: d.getTime(),
        title: b.badges?.name ?? "Badge", icon: b.badges?.icon ?? "🏅",
      });
    }
    entries.sort((a, b) => b.ts - a.ts);
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return { grouped: Array.from(map.entries()), totalXp: xp, totalCoins: coins, badgeCount: (badgeRows as any[]).length };
  }, [txs, badgeRows, t]);

  const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("gamificationHistory")} subtitle={t("historySubtitle")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Sparkles className="size-5" />} label={t("totalXpEarned")} value={totalXp} tint="bg-xp" />
        <StatCard icon={<Coins className="size-5" />} label={t("totalCoinsEarned")} value={totalCoins} tint="bg-coin" />
        <StatCard icon={<Award className="size-5" />} label={t("badgesEarnedCount")} value={badgeCount} tint="bg-gradient-magic" />
      </div>

      {grouped.length === 0 ? (
        <EmptyState message={t("noHistory")} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => {
            const dayXp = items.reduce((s, e) => s + (e.xp ?? 0), 0);
            const dayCoin = items.reduce((s, e) => s + (e.coin ?? 0), 0);
            return (
              <div key={date}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-foreground/80">{fmtDate(date)}</h2>
                  <div className="flex gap-2 text-xs font-display font-bold">
                    {dayXp > 0 && <span className="rounded-full bg-xp/20 px-2 py-0.5 text-xp">+{dayXp} XP</span>}
                    {dayCoin > 0 && <span className="rounded-full bg-coin/20 px-2 py-0.5 text-coin">+{dayCoin} 🪙</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 shadow-card-rpg">
                      <div className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${e.kind === "badge" ? "bg-gradient-magic text-white shadow-magic" : "bg-siswa/10 text-siswa"}`}>
                        {e.kind === "badge" ? e.icon : <Sword className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-sm font-semibold">
                          {e.kind === "badge" ? `${t("badgeEarned")}: ${e.title}` : e.title}
                        </div>
                      </div>
                      {e.kind === "xp" && (
                        <div className="flex shrink-0 gap-2 text-xs font-display font-bold">
                          {(e.xp ?? 0) !== 0 && <span className="text-xp">+{e.xp} XP</span>}
                          {(e.coin ?? 0) !== 0 && <span className="text-coin">+{e.coin} 🪙</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
