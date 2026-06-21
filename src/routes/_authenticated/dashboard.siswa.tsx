import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Coins, Flame, ScrollText, Sparkles, Star, Sword, Trophy } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getIslamicAvatar } from "@/lib/islamic-avatar";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/siswa")({
  head: () => ({ meta: [{ title: "Dashboard Siswa · EduQuest RPG" }] }),
  component: SiswaDashboard,
});

function SiswaDashboard() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" });
  }, [role, loading, navigate]);

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const coins = profile?.coins ?? 0;
  const nextLevelXp = level * 100;
  const pct = Math.min(100, Math.round(((xp % 100) / 100) * 100));

  const { data: activeQuests = [] } = useQuery({
    queryKey: ["siswa-active", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, classes(name), submissions(status, student_id)").order("due_at", { ascending: true, nullsFirst: false }).limit(5);
      return (data ?? []).filter((a: any) => !a.submissions?.find((s: any) => s.student_id === user!.id && s.status === "graded"));
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["siswa-leaderboard-mini", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: myCls } = await supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id);
      const classIds = (myCls ?? []).map((e) => e.class_id);
      if (classIds.length === 0) return [];
      const { data: peers } = await supabase.from("class_enrollments").select("student_id").in("class_id", classIds);
      const ids = Array.from(new Set((peers ?? []).map((e) => e.student_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, xp").in("id", ids).order("xp", { ascending: false }).limit(5);
      return profs ?? [];
    },
  });

  const rank = leaderboard.findIndex((p: any) => p.id === user?.id) + 1;

  return (
    <DashboardShell accent="siswa">
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-hero p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-sm font-display font-semibold uppercase tracking-wider opacity-80">{t("welcome")}</div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{profile?.full_name ?? "Adventurer"} ✨</h1>
            <p className="mt-2 max-w-xl opacity-90">
              {lang === "id"
                ? `Kelas ${profile?.class_name ?? "—"} · Ayo lanjutkan quest belajarmu!`
                : `Class ${profile?.class_name ?? "—"} · Ready to continue your quest?`}
            </p>
            <div className="mt-6 max-w-md">
              <div className="mb-1.5 flex items-end justify-between text-sm">
                <span className="font-display font-semibold">{t("level")} {level}</span>
                <span className="opacity-90">{xp % 100} / 100 XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/25">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-xp shadow-glow" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/siswa/tugas"><Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("navMyQuests")}</Button></Link>
              <Link to="/siswa/kelas"><Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("myClasses")}</Button></Link>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="hidden sm:flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-white/30 blur-2xl" />
              <img
                src={getIslamicAvatar(user?.id ?? profile?.full_name, "siswa")}
                alt={lang === "id" ? "Karakter petualang Islami" : "Islamic adventurer character"}
                width={192}
                height={192}
                className="size-40 lg:size-48 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Star className="size-6" />} label={t("level")} value={level} tint="bg-gradient-magic" sub={`${xp} ${t("xp")} total`} />
        <StatCard icon={<Coins className="size-6" />} label={t("coins")} value={coins.toLocaleString()} tint="bg-coin" />
        <StatCard icon={<Flame className="size-6" />} label={t("navMyQuests")} value={activeQuests.length} tint="bg-destructive" sub={lang === "id" ? "aktif" : "active"} />
        <StatCard icon={<Trophy className="size-6" />} label={t("leaderboard")} value={rank > 0 ? `#${rank}` : "—"} tint="bg-quest" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold flex items-center gap-2"><ScrollText className="size-5 text-accent" /> {t("myQuests")}</h2>
            <Link to="/siswa/tugas"><Button size="sm" variant="ghost">{lang === "id" ? "Lihat semua" : "View all"} →</Button></Link>
          </div>
          {activeQuests.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{lang === "id" ? "Tidak ada quest aktif" : "No active quests"}</div> : (
            <ul className="space-y-3">
              {activeQuests.slice(0, 5).map((q: any, i: number) => (
                <motion.li key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="group flex items-center gap-4 rounded-2xl border-2 border-border bg-muted/40 p-4 transition-all hover:border-accent hover:bg-card hover:shadow-soft">
                  <div className="grid size-12 place-items-center rounded-xl bg-gradient-quest text-quest-foreground shadow-soft"><Sword className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold truncate">{q.title}</div>
                    <div className="text-xs text-muted-foreground">{q.classes?.name} · {q.due_at ? format(new Date(q.due_at), "dd MMM") : ""}</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-xp/15 px-3 py-1 text-sm font-display font-bold text-xp"><Sparkles className="size-3.5" /> +{q.xp_reward}</div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2"><Trophy className="size-5 text-coin" /> {t("leaderboard")}</h2>
          {leaderboard.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{t("empty")}</div> : (
            <ul className="space-y-2">
              {leaderboard.map((p: any, i: number) => {
                const you = p.id === user?.id;
                return (
                  <li key={p.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${you ? "border-accent bg-accent/10" : "border-transparent bg-muted/30"}`}>
                    <div className={`grid size-8 place-items-center rounded-lg font-display text-sm font-bold ${i === 0 ? "bg-coin text-quest-foreground" : i === 1 ? "bg-muted-foreground/30" : i === 2 ? "bg-secondary" : "bg-muted"}`}>{i + 1}</div>
                    <div className="flex-1 truncate font-display font-semibold">{p.full_name}{you && " (You)"}</div>
                    <div className="text-sm text-muted-foreground">{p.xp.toLocaleString()} XP</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
