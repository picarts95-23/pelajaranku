import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Award, BookOpen, BookOpenCheck, CalendarDays, ClipboardList, Coins, Flame, GraduationCap, Heart, Megaphone, MessageCircle, ScrollText, Sparkles, Star, Sword, Trophy, UserCircle2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { RekapNilaiSiswa } from "@/components/rekap-nilai-siswa";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatar } from "@/lib/character-roster";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/siswa")({
  head: () => ({ meta: [{ title: "Dashboard Siswa · Pelajaranku" },
      { name: "description", content: "Dashboard Siswa untuk mengelola dan memantau pembelajaran di Pelajaranku." },
      { property: "og:title", content: "Dashboard Siswa · Pelajaranku" },
      { property: "og:description", content: "Dashboard Siswa untuk mengelola dan memantau pembelajaran di Pelajaranku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: SiswaDashboard,
});

function SiswaDashboard() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "siswa") navigate({ to: role === "admin" ? "/admin" : "/dashboard/guru" });
  }, [role, loading, navigate]);

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const coins = profile?.coins ?? 0;
  const nextLevelXp = level * 100;
  const pct = Math.min(100, Math.round(((xp % 100) / 100) * 100));

  const { data: activeQuests = [], isPending: questsPending, isError: questsError, refetch: retryQuests } = useQuery({
    queryKey: ["siswa-active", user?.id], enabled: !!user && !loading && role === "siswa",
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("assignments").select("*, classes(name), submissions(status, student_id)").order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).filter((a) => (!a.due_at || new Date(a.due_at).getTime() > Date.now()) && !a.submissions?.some((s) => s.student_id === user.id && (s.status === "graded" || s.status === "submitted")));
    },
  });

  const { data: leaderboard = [], isPending: leaderboardPending, isError: leaderboardError, refetch: retryLeaderboard } = useQuery({
    queryKey: ["siswa-leaderboard-mini", user?.id], enabled: !!user && !loading && role === "siswa",
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("student_class_leaderboard");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rank = leaderboard.findIndex((p: any) => p.id === user?.id) + 1;

  if (!loading && !role) {
    return <div className="grid min-h-screen place-items-center bg-background text-center"><div><p>{lang === "id" ? "Peran akun belum dapat dimuat." : "Account role could not be loaded."}</p><Button asChild className="mt-4"><Link to="/loading">{lang === "id" ? "Coba lagi" : "Try again"}</Link></Button></div></div>;
  }

  if (loading || role !== "siswa") {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground" role="status">{lang === "id" ? "Memuat akun…" : "Loading account…"}</div>;
  }

  return (
    <DashboardShell accent="siswa">
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-hero p-4 text-primary-foreground shadow-magic sm:p-6 lg:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="text-xs font-display font-semibold uppercase tracking-wider opacity-80 sm:text-sm">{t("welcome")}</div>
            <h1 className="mt-1 font-display text-2xl font-bold break-words sm:text-3xl lg:text-4xl">{profile?.full_name ?? "Siswi"} ✨</h1>
            <p className="mt-2 max-w-xl text-sm opacity-90 sm:text-base">
              {lang === "id"
                ? `Kelas ${profile?.class_name ?? "—"} · Lanjutkan perjalanan belajarmu hari ini!`
                : `Class ${profile?.class_name ?? "—"} · Continue your learning journey today!`}
            </p>
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex items-end justify-between text-sm">
                <span className="font-display font-semibold">{t("level")} {level}</span>
                <span className="opacity-90">{xp % 100} / 100 XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/25">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-xp shadow-glow" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/siswa/tugas"><Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("navMyQuests")}</Button></Link>
              <Link to="/siswa/kelas"><Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("myClasses")}</Button></Link>
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
                src={resolveAvatar(profile as any, "siswa")}
                alt={lang === "id" ? "Karakter siswi faceless berjilbab panjang" : "Faceless muslim girl student character with long hijab"}
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
        <StatCard icon={<Flame className="size-6" />} label={t("navMyQuests")} value={questsPending || questsError ? "—" : activeQuests.length} tint="bg-destructive" sub={lang === "id" ? "aktif" : "active"} />
        <StatCard icon={<Trophy className="size-6" />} label={t("leaderboard")} value={!leaderboardError && rank > 0 ? `#${rank}` : "—"} tint="bg-quest" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold flex items-center gap-2"><ScrollText className="size-5 text-accent" /> {t("myQuests")}</h2>
            <Link to="/siswa/tugas"><Button size="sm" variant="ghost">{lang === "id" ? "Lihat semua" : "View all"} →</Button></Link>
          </div>
          {questsError ? <div role="alert" className="py-8 text-center text-sm text-destructive"><p>{lang === "id" ? "Tugas gagal dimuat." : "Could not load tasks."}</p><Button variant="outline" className="mt-3" onClick={() => void retryQuests()}>{lang === "id" ? "Coba lagi" : "Try again"}</Button></div> : questsPending ? <div role="status" className="py-8 text-center text-sm text-muted-foreground">{lang === "id" ? "Memuat tugas…" : "Loading tasks…"}</div> : activeQuests.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{lang === "id" ? "Tidak ada misi aktif" : "No active missions"}</div> : (
            <ul className="space-y-3">
              {activeQuests.slice(0, 5).map((q: any, i: number) => (
                <motion.li key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="group flex items-center gap-3 rounded-2xl border-2 border-border bg-muted/40 p-3 transition-all hover:border-accent hover:bg-card hover:shadow-soft sm:gap-4 sm:p-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-quest text-quest-foreground shadow-soft sm:size-12"><Sword className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold truncate">{q.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{q.classes?.name}{q.due_at ? ` · ${format(new Date(q.due_at), "dd MMM")}` : ""}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-display font-bold text-xp sm:px-3 sm:text-sm"><Sparkles className="size-3.5" /> +{q.xp_reward}</div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2"><Trophy className="size-5 text-coin" /> {t("leaderboard")}</h2>
          {leaderboardError ? <div role="alert" className="py-8 text-center text-sm text-destructive"><p>{lang === "id" ? "Peringkat gagal dimuat." : "Could not load ranking."}</p><Button variant="outline" className="mt-3" onClick={() => void retryLeaderboard()}>{lang === "id" ? "Coba lagi" : "Try again"}</Button></div> : leaderboardPending ? <div role="status" className="py-8 text-center text-sm text-muted-foreground">{lang === "id" ? "Memuat peringkat…" : "Loading ranking…"}</div> : leaderboard.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{t("empty")}</div> : (
            <ul className="space-y-2">
              {leaderboard.slice(0, 5).map((p: any, i: number) => {
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

      <section className="mt-6">
        <RekapNilaiSiswa compact />
        <div className="mt-3 flex justify-end">
          <Link to="/siswa/nilai"><Button size="sm" variant="ghost">{lang === "id" ? "Lihat rekap lengkap" : "View full recap"} →</Button></Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">{lang === "id" ? "Menu Siswa" : "Student Menu"}</h2>
            <p className="text-sm text-muted-foreground">
              {lang === "id" ? "Akses cepat ke semua fitur belajar & sosial kamu" : "Quick access to all your learning & social features"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <FeatureCard to="/siswa/kelas" icon={BookOpen} title={lang === "id" ? "Kelas" : "Classes"} desc={lang === "id" ? "Lihat & gabung kelas dengan kode dari guru" : "View & join classes with a teacher code"} tint="bg-quest text-white" />
          <FeatureCard to="/siswa/mapel" icon={GraduationCap} title={lang === "id" ? "Mata Pelajaran & Materi" : "Subjects & Materials"} desc={lang === "id" ? "Jelajahi materi tiap mapel" : "Explore subject materials"} tint="bg-gradient-magic text-white" />
          <FeatureCard to="/siswa/tugas" icon={ClipboardList} title={lang === "id" ? "Tugas & Latihan" : "Tasks & Practice"} desc={lang === "id" ? "Semua misi, tugas & kuis dalam satu tempat — kerjakan, kirim & dapat XP" : "All missions, tasks & quizzes in one place — submit & earn XP"} tint="bg-accent text-accent-foreground" />
          <FeatureCard to="/siswa/mutabaah" icon={BookOpenCheck} title={lang === "id" ? "Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"} desc={lang === "id" ? "Riwayat penilaian hafalan: Tajwid, Kelancaran, Adab" : "Hifz assessment history: Tajwid, Fluency, Adab"} tint="bg-gradient-hero text-white" />
          <FeatureCard to="/siswa/event" icon={CalendarDays} title={lang === "id" ? "Kegiatan" : "Events"} desc={lang === "id" ? "Pantau agenda & acara kelas dari guru" : "Track class agenda and events from teachers"} tint="bg-gradient-quest text-quest-foreground" />
          <FeatureCard to="/siswa/pengumuman" icon={Megaphone} title={lang === "id" ? "Papan Pengumuman" : "Announcements"} desc={lang === "id" ? "Baca pengumuman guru, beri reaksi & masukan" : "Read teacher announcements, react & give feedback"} tint="bg-gradient-sunset text-white" />
          <FeatureCard to="/siswa/status" icon={MessageCircle} title={lang === "id" ? "Status & Interaksi" : "Status & Interaction"} desc={lang === "id" ? "Buat status, komentar, beri emoji & like" : "Post status, comment, emoji & like"} tint="bg-gradient-sunset text-white" />
          <FeatureCard to="/siswa/profil" icon={UserCircle2} title={lang === "id" ? "Pilih Karakter & Biodata" : "Character & Bio"} desc={lang === "id" ? "Atur avatar, nama akun & profil" : "Set avatar, username & profile"} tint="bg-gradient-hero text-white" />
          <FeatureCard to="/siswa/nilai" icon={GraduationCap} title={lang === "id" ? "Nilai" : "Grades"} desc={lang === "id" ? "Pantau nilai & rapor" : "Track grades & reports"} tint="bg-secondary text-secondary-foreground" />
          <FeatureCard to="/siswa/badge" icon={Award} title={lang === "id" ? "Badge" : "Badges"} desc={lang === "id" ? "Koleksi lencana prestasi" : "Achievement collection"} tint="bg-coin text-quest-foreground" />
          <FeatureCard to="/siswa/leaderboard" icon={Trophy} title={lang === "id" ? "Papan Peringkat" : "Leaderboard"} desc={lang === "id" ? "Peringkat XP & beri reaksi emoji" : "XP ranking & emoji reactions"} tint="bg-gradient-magic text-white" />
        </div>

        <div className="mt-6 rounded-3xl border-2 border-dashed border-border bg-muted/30 p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Heart className="size-4 text-destructive" />
            <span className="font-display font-semibold">{lang === "id" ? "Reaksi favorit" : "Favorite reactions"}:</span>
            {["❤️","👍","🎉","🔥","😊","😮","👏","🌟","💯","🤲"].map((e) => (
              <span key={e} className="rounded-full border-2 border-border bg-card px-3 py-1 text-lg shadow-soft transition-transform hover:scale-110 hover:border-accent" role="img" aria-label={`emoji ${e}`}>{e}</span>
            ))}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

function FeatureCard({
  to, href, icon: Icon, title, desc, tint,
}: {
  to?: string; href?: string; icon: ComponentType<{ className?: string }>; title: string; desc: string; tint: string;
}) {
  const inner: ReactNode = (
    <div className="group relative h-full overflow-hidden rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-magic">
      <div className={`mb-3 grid size-12 place-items-center rounded-xl shadow-soft ${tint}`}>
        <Icon className="size-6" />
      </div>
      <div className="font-display text-lg font-bold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      <ArrowRight className="absolute right-4 top-5 size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
    </div>
  );
  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return <a href={href} className="block h-full">{inner}</a>;
}
