import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Coins, Flame, ScrollText, Sparkles, Star, Sword, Trophy, Zap } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/siswa")({
  head: () => ({ meta: [{ title: "Dashboard Siswa · EduQuest RPG" }] }),
  component: SiswaDashboard,
});

function SiswaDashboard() {
  const { profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" });
  }, [role, loading, navigate]);

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const coins = profile?.coins ?? 0;
  const nextLevelXp = level * 250;
  const pct = Math.min(100, Math.round((xp / nextLevelXp) * 100));

  return (
    <DashboardShell accent="siswa">
      {/* Hero panel */}
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-hero p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-display font-semibold uppercase tracking-wider opacity-80">
            {t("welcome")}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
            {profile?.full_name ?? "Adventurer"} ✨
          </h1>
          <p className="mt-2 max-w-xl opacity-90">
            {lang === "id"
              ? `Kelas ${profile?.class_name ?? "—"} · Ayo lanjutkan quest belajarmu hari ini!`
              : `Class ${profile?.class_name ?? "—"} · Ready to continue your learning quest?`}
          </p>

          {/* XP bar */}
          <div className="mt-6 max-w-md">
            <div className="mb-1.5 flex items-end justify-between text-sm">
              <span className="font-display font-semibold">{t("level")} {level}</span>
              <span className="opacity-90">{xp} / {nextLevelXp} XP</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/25">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: "easeOut" }}
                className="h-full rounded-full bg-xp shadow-glow"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Star className="size-6" />} label={t("level")} value={level} tint="bg-gradient-magic" sub={`${xp} ${t("xp")}`} />
        <StatCard icon={<Coins className="size-6" />} label={t("coins")} value={coins.toLocaleString()} tint="bg-coin" />
        <StatCard icon={<Flame className="size-6" />} label="Streak" value="7" tint="bg-destructive" sub={lang === "id" ? "hari berturut" : "day streak"} />
        <StatCard icon={<Trophy className="size-6" />} label={t("leaderboard")} value="#4" tint="bg-quest" sub={lang === "id" ? "di kelas" : "in class"} />
      </section>

      {/* Two-column main */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Quests */}
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <ScrollText className="size-5 text-accent" /> {t("myQuests")}
            </h2>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-display font-semibold text-accent">
              3 {lang === "id" ? "aktif" : "active"}
            </span>
          </div>
          <ul className="space-y-3">
            {[
              { title: lang === "id" ? "Kalahkan 5 soal Pecahan" : "Defeat 5 Fraction problems", xp: 50, due: lang === "id" ? "Hari ini" : "Today", icon: Sword },
              { title: lang === "id" ? "Quest Membaca: Bab 4" : "Reading Quest: Chapter 4", xp: 30, due: lang === "id" ? "Besok" : "Tomorrow", icon: ScrollText },
              { title: lang === "id" ? "Battle Kuis: Sains" : "Quiz Battle: Science", xp: 80, due: lang === "id" ? "Jumat" : "Friday", icon: Zap },
            ].map((q, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="group flex items-center gap-4 rounded-2xl border-2 border-border bg-muted/40 p-4 transition-all hover:border-accent hover:bg-card hover:shadow-soft"
              >
                <div className="grid size-12 place-items-center rounded-xl bg-gradient-quest text-quest-foreground shadow-soft">
                  <q.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold">{q.title}</div>
                  <div className="text-xs text-muted-foreground">{q.due}</div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-xp/15 px-3 py-1 text-sm font-display font-bold text-xp">
                  <Sparkles className="size-3.5" /> +{q.xp}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Leaderboard */}
        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
            <Trophy className="size-5 text-coin" /> {t("leaderboard")}
          </h2>
          <ul className="space-y-2">
            {[
              { name: "Hikaru", xp: 2840, rank: 1 },
              { name: "Mei", xp: 2630, rank: 2 },
              { name: "Raka", xp: 2410, rank: 3 },
              { name: profile?.full_name ?? "You", xp, rank: 4, you: true },
              { name: "Bima", xp: 1780, rank: 5 },
            ].map((p) => (
              <li
                key={p.rank}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                  p.you ? "border-accent bg-accent/10" : "border-transparent bg-muted/30"
                }`}
              >
                <div className={`grid size-8 place-items-center rounded-lg font-display text-sm font-bold ${
                  p.rank === 1 ? "bg-coin text-quest-foreground"
                  : p.rank === 2 ? "bg-muted-foreground/30"
                  : p.rank === 3 ? "bg-secondary"
                  : "bg-muted"
                }`}>{p.rank}</div>
                <div className="flex-1 truncate font-display font-semibold">{p.name}{p.you && " (You)"}</div>
                <div className="text-sm text-muted-foreground">{p.xp.toLocaleString()} XP</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
