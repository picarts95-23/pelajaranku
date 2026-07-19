import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Award, BookOpen, Cake, Coins, GraduationCap, Heart, IdCard, Pencil, Quote, Sparkles, Star, Trophy, User2, Venus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getIslamicAvatar } from "@/lib/islamic-avatar";
import { getCharacterByKey } from "@/lib/character-roster";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/siswa/profil")({
  head: () => ({ meta: [{ title: "Profil Siswi · EduQuest Academy" }] }),
  component: SiswaProfil,
});

function SiswaProfil() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "siswa") {
      navigate({ to: role === "admin" ? "/admin" : "/dashboard/guru" });
    }
  }, [role, loading, navigate]);

  const p = profile as any;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const coins = profile?.coins ?? 0;
  const xpInLevel = xp % 100;
  const pct = Math.min(100, Math.round((xpInLevel / 100) * 100));
  const character = getCharacterByKey(p?.character_key);
  const avatar = character?.src ?? p?.avatar_url ?? getIslamicAvatar(user?.id ?? profile?.full_name, "siswa");

  const { data: stats } = useQuery({
    queryKey: ["siswa-profil-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [subs, enrolls, badges] = await Promise.all([
        supabase.from("submissions").select("status, score").eq("student_id", user!.id),
        supabase.from("class_enrollments").select("class_id").eq("student_id", user!.id),
        supabase.from("user_badges").select("badge_id, badges(name, icon, description)").eq("user_id", user!.id),
      ]);
      const allSubs = subs.data ?? [];
      const graded = allSubs.filter((s: any) => s.status === "graded" && s.score != null);
      const avg = graded.length ? Math.round(graded.reduce((a: number, s: any) => a + Number(s.score), 0) / graded.length) : 0;
      return {
        totalSubs: allSubs.length,
        gradedCount: graded.length,
        avgScore: avg,
        classCount: (enrolls.data ?? []).length,
        badges: badges.data ?? [],
      };
    },
  });

  return (
    <DashboardShell accent="siswa">
      <div className="mb-4 flex justify-end">
        <Button asChild size="sm" className="bg-gradient-magic">
          <Link to="/siswa/profil/edit"><Pencil className="mr-1 size-4" /> {lang === "id" ? "Edit Profil & Karakter" : "Edit Profile & Character"}</Link>
        </Button>
      </div>
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-hero p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="relative justify-self-center"
          >
            <div className="absolute inset-0 -z-10 rounded-full bg-white/30 blur-2xl" />
            <img
              src={avatar}
              alt={lang === "id" ? "Avatar siswi faceless berjilbab panjang" : "Faceless muslimah student avatar with long hijab"}
              width={208}
              height={208}
              className="size-44 sm:size-52 rounded-3xl object-contain bg-white/20 ring-4 ring-white/40 drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            />
          </motion.div>
          <div>
            <div className="text-sm font-display font-semibold uppercase tracking-wider opacity-80">
              {lang === "id" ? "Profil Siswi" : "Student Profile"}
            </div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{profile?.full_name ?? "Siswi"} ✨</h1>
            {p?.username && <div className="mt-1 font-display text-sm opacity-90">@{p.username}</div>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                <GraduationCap className="size-4" /> {lang === "id" ? "Kelas" : "Class"} {profile?.class_name ?? "—"}
              </span>
              {profile?.school_id_number && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                  <IdCard className="size-4" /> NIS {profile.school_id_number}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 px-3 py-1 backdrop-blur">
                <Star className="size-4" /> Level {level}
              </span>
              {character && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                  <Sparkles className="size-4" /> {character.name} · {character.archetype}
                </span>
              )}
            </div>
            {p?.motto && (
              <p className="mt-3 flex items-start gap-2 text-sm italic opacity-95">
                <Quote className="mt-0.5 size-4 shrink-0" /> {p.motto}
              </p>
            )}
            <div className="mt-6 max-w-md">
              <div className="mb-1.5 flex items-end justify-between text-sm">
                <span className="font-display font-semibold">{lang === "id" ? "Menuju Level" : "To Level"} {level + 1}</span>
                <span className="opacity-90">{xpInLevel} / 100 XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/25">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-xp shadow-glow" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Star className="size-6" />} label="XP" value={xp.toLocaleString()} tint="bg-gradient-magic" sub={`Level ${level}`} />
        <StatCard icon={<Coins className="size-6" />} label={lang === "id" ? "Koin" : "Coins"} value={coins.toLocaleString()} tint="bg-coin" />
        <StatCard icon={<BookOpen className="size-6" />} label={lang === "id" ? "Kelas Diikuti" : "Classes"} value={stats?.classCount ?? 0} tint="bg-quest" />
        <StatCard icon={<Trophy className="size-6" />} label={lang === "id" ? "Rata-rata Nilai" : "Average Score"} value={stats?.avgScore ?? 0} tint="bg-gradient-sunset" />
      </section>

      <section className="mt-6 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
        <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
          <User2 className="size-5 text-accent" /> {lang === "id" ? "Biodata" : "Biodata"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <BioItem icon={<User2 className="size-4" />} label={lang === "id" ? "Nama Akun" : "Username"} value={p?.username ? `@${p.username}` : null} lang={lang} />
          <BioItem icon={<Venus className="size-4" />} label={lang === "id" ? "Jenis Kelamin" : "Gender"} value={p?.gender} lang={lang} />
          <BioItem icon={<Cake className="size-4" />} label={lang === "id" ? "Tanggal Lahir" : "Birthdate"} value={p?.birthdate ? format(new Date(p.birthdate), "dd MMM yyyy") : null} lang={lang} />
          <BioItem icon={<Heart className="size-4" />} label={lang === "id" ? "Hobi" : "Hobby"} value={p?.hobby} lang={lang} />
          <BioItem icon={<GraduationCap className="size-4" />} label={lang === "id" ? "Kelas" : "Class"} value={profile?.class_name} lang={lang} />
          <BioItem icon={<IdCard className="size-4" />} label="NIS" value={profile?.school_id_number} lang={lang} />
        </div>
        {p?.bio && (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4">
            <div className="mb-1 font-display text-sm font-bold text-muted-foreground">{lang === "id" ? "Tentang Saya" : "About Me"}</div>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{p.bio}</p>
          </div>
        )}
      </section>


      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> {lang === "id" ? "Progress Belajar" : "Learning Progress"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProgressRow
              label={lang === "id" ? "Tugas Dikumpulkan" : "Submitted Tasks"}
              value={stats?.totalSubs ?? 0}
              max={Math.max(stats?.totalSubs ?? 0, 10)}
            />
            <ProgressRow
              label={lang === "id" ? "Tugas Dinilai" : "Graded Tasks"}
              value={stats?.gradedCount ?? 0}
              max={Math.max(stats?.totalSubs ?? 1, 1)}
            />
            <ProgressRow
              label={lang === "id" ? "Rata-rata Nilai" : "Average Score"}
              value={stats?.avgScore ?? 0}
              max={100}
            />
            <ProgressRow
              label={lang === "id" ? "Progress Level" : "Level Progress"}
              value={xpInLevel}
              max={100}
            />
          </div>
        </div>

        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
            <Award className="size-5 text-coin" /> {lang === "id" ? "Badge Diraih" : "Earned Badges"}
          </h2>
          {(stats?.badges ?? []).length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {lang === "id" ? "Belum ada badge. Tunaikan misi untuk meraihnya!" : "No badges yet. Complete missions to earn them!"}
            </div>
          ) : (
            <ul className="space-y-2">
              {(stats?.badges ?? []).map((b: any) => (
                <li key={b.badge_id} className="flex items-center gap-3 rounded-xl border-2 border-transparent bg-muted/30 p-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-gradient-magic text-2xl">{b.badges?.icon ?? "🏅"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold truncate">{b.badges?.name}</div>
                    {b.badges?.description && <div className="text-xs text-muted-foreground truncate">{b.badges.description}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function ProgressRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between text-sm">
        <span className="font-display font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}{max === 100 ? "%" : ` / ${max}`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} className="h-full rounded-full bg-gradient-magic" />
      </div>
    </div>
  );
}

function BioItem({ icon, label, value, lang }: { icon: ReactNode; label: string; value?: string | null; lang: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-border bg-muted/30 p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-magic text-white">{icon}</div>
      <div className="min-w-0">
        <div className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-display font-semibold">{value || (lang === "id" ? "Belum diisi" : "Not set")}</div>
      </div>
    </div>
  );
}

