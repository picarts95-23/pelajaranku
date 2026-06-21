import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, ScrollText, TrendingUp, Users, ClipboardCheck } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/guru")({
  head: () => ({ meta: [{ title: "Dashboard Guru · EduQuest RPG" }] }),
  component: GuruDashboard,
});

function GuruDashboard() {
  const { profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  return (
    <DashboardShell accent="guru">
      {/* Welcome */}
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-magic p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-guru/40 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-display font-semibold uppercase tracking-wider opacity-80">{t("welcome")}</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
            🧙‍♂️ {profile?.full_name ?? "Sensei"}
          </h1>
          <p className="mt-2 max-w-xl opacity-90">
            {lang === "id"
              ? `Mata pelajaran: ${profile?.subject ?? "—"} · Kelola guild kelasmu hari ini.`
              : `Subject: ${profile?.subject ?? "—"} · Manage your class guild today.`}
          </p>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="size-6" />} label={t("classRoster")} value="32" tint="bg-guru" sub={lang === "id" ? "siswa aktif" : "active students"} />
        <StatCard icon={<ClipboardCheck className="size-6" />} label={t("submissions")} value="18" tint="bg-xp" sub={lang === "id" ? "menunggu nilai" : "to review"} />
        <StatCard icon={<ScrollText className="size-6" />} label={t("assignments")} value="6" tint="bg-quest" sub={lang === "id" ? "berjalan" : "ongoing"} />
        <StatCard icon={<TrendingUp className="size-6" />} label={lang === "id" ? "Rata-rata XP" : "Avg. XP"} value="1,420" tint="bg-accent" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Assignments */}
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <BookOpen className="size-5 text-guru" /> {t("assignments")}
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border-2 border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{lang === "id" ? "Judul" : "Title"}</th>
                  <th className="px-4 py-3">{lang === "id" ? "Kelas" : "Class"}</th>
                  <th className="px-4 py-3">{lang === "id" ? "Deadline" : "Due"}</th>
                  <th className="px-4 py-3 text-right">{t("submissions")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { title: lang === "id" ? "Quest Pecahan Lanjutan" : "Advanced Fractions Quest", cls: "VIII-A", due: "21 Jun", sub: "24/32" },
                  { title: lang === "id" ? "Battle Aljabar #3" : "Algebra Battle #3", cls: "VIII-B", due: "23 Jun", sub: "12/30" },
                  { title: lang === "id" ? "Misi Geometri" : "Geometry Mission", cls: "VIII-A", due: "25 Jun", sub: "8/32" },
                  { title: lang === "id" ? "Boss Fight: Persamaan" : "Boss Fight: Equations", cls: "IX-C", due: "28 Jun", sub: "0/28" },
                ].map((a, i) => (
                  <tr key={i} className="border-t border-border bg-card hover:bg-muted/30">
                    <td className="px-4 py-3 font-display font-semibold">{a.title}</td>
                    <td className="px-4 py-3">{a.cls}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.due}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-xp/15 px-3 py-1 font-display text-xs font-bold text-xp">{a.sub}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top students */}
        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
            <GraduationCap className="size-5 text-accent" /> {lang === "id" ? "Murid Terbaik" : "Top Students"}
          </h2>
          <ul className="space-y-2">
            {[
              { name: "Hikaru R.", cls: "VIII-A", xp: 2840 },
              { name: "Mei A.", cls: "VIII-A", xp: 2630 },
              { name: "Raka P.", cls: "VIII-B", xp: 2410 },
              { name: "Aurora S.", cls: "VIII-A", xp: 2120 },
              { name: "Bima D.", cls: "VIII-B", xp: 1780 },
            ].map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                <div className="grid size-9 place-items-center rounded-lg bg-siswa font-display text-sm font-bold text-white">
                  {s.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.cls}</div>
                </div>
                <div className="text-sm font-display font-bold text-primary">{s.xp.toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
