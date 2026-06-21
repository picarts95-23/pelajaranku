import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Swords, Trophy, BookOpen, ScrollText, Wand2 } from "lucide-react";
import heroImg from "@/assets/hero-santriwati-garden.jpg";
import bgCourtyard from "@/assets/bg-islamic-courtyard.jpg";
import bgMeadow from "@/assets/bg-meadow-santriwati.jpg";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduQuest Madrasah — Belajar Jadi Perjalanan Ilmu" },
      { name: "description", content: "Platform pembelajaran interaktif bernuansa islami untuk santriwati. Misi harian, tantangan kuis, dan dashboard ustadz/ah & santriwati yang menyenangkan." },
      { property: "og:title", content: "EduQuest Madrasah" },
      { property: "og:description", content: "Belajar terasa bermakna. Naik tingkat ilmu setiap hari." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useLang();

  const features = [
    { icon: ScrollText, key1: "feat1Title", key2: "feat1Desc", tint: "bg-quest text-quest-foreground" },
    { icon: Swords, key1: "feat2Title", key2: "feat2Desc", tint: "bg-accent text-accent-foreground" },
    { icon: BookOpen, key1: "feat3Title", key2: "feat3Desc", tint: "bg-guru text-white" },
    { icon: Trophy, key1: "feat4Title", key2: "feat4Desc", tint: "bg-gradient-magic text-primary-foreground" },
  ] as const;

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
            <Wand2 className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">EduQuest <span className="text-gradient-magic">Madrasah</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link to="/auth">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">{t("login")}</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-6 md:grid-cols-2 md:pb-24 md:pt-12">
        <div className="absolute -left-20 top-20 -z-10 size-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -right-10 top-40 -z-10 size-80 rounded-full bg-primary/25 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-accent/30 bg-card px-4 py-1.5 text-xs font-semibold text-accent shadow-soft">
            <Sparkles className="size-3.5" /> {t("tagline")}
          </span>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-gradient-hero">{t("heroTitle")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("heroSub")}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth" search={{ mode: "signup", role: "siswa" }}>
              <Button variant="hero" size="xl" className="w-full sm:w-auto">
                <Sparkles className="size-5" />
                {t("startQuest")}
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "login" }}>
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                {t("enterGuild")}
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-xp animate-sparkle" /> Sistem XP & Tingkat Ilmu</div>
            <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-coin animate-sparkle" /> Koin & Hadiah</div>
            <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent animate-sparkle" /> Misi Harian</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 -z-10 translate-x-4 translate-y-4 rounded-[2rem] bg-gradient-magic opacity-40 blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border-4 border-white shadow-magic ring-4 ring-accent/30">
            <img
              src={heroImg}
              alt="Santriwati Muslimah faceless di taman bunga islami yang indah"
              width={1536}
              height={1024}
              className="block w-full"
            />
          </div>
          {/* Floating stat badges */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-4 top-8 rounded-2xl border-2 border-white bg-card px-4 py-2.5 shadow-card-rpg"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("level")}</div>
            <div className="font-display text-2xl font-bold text-gradient-magic">12</div>
          </motion.div>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -right-3 bottom-12 flex items-center gap-2 rounded-2xl border-2 border-white bg-card px-4 py-2.5 shadow-card-rpg"
          >
            <div className="grid size-8 place-items-center rounded-full bg-coin">
              <span className="font-display text-sm font-bold">¢</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("coins")}</div>
              <div className="font-display text-lg font-bold">1,240</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Role choose */}
      <section className="relative overflow-hidden py-10">
        <div className="absolute inset-0 -z-10">
          <img src={bgCourtyard} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />
        </div>
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-5 sm:grid-cols-2">
          <RoleCard
            roleColor="bg-guru"
            title={t("guru")}
            desc={
              { id: "Kelola kelas, beri tugas, pantau progres, dan kerjakan administrasi dalam satu papan komando.",
                en: "Manage classes, assign tasks, track progress, and handle admin from one command board." }
            }
            cta={t("loginGuru")}
            to="/auth"
            search={{ mode: "login", role: "guru" }}
            variant="guru"
          />
          <RoleCard
            roleColor="bg-siswa"
            title={t("siswa")}
            desc={
              { id: "Tuntaskan quest, naik level, kumpulkan koin, dan jadi murid terkuat di kelasmu.",
                en: "Complete quests, level up, earn coins, and become the strongest student in class." }
            }
            cta={t("loginSiswa")}
            to="/auth"
            search={{ mode: "login", role: "siswa" }}
            variant="siswa"
          />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10">
          <img src={bgMeadow} alt="" className="h-full w-full object-cover opacity-15" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
        </div>
        <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">{t("features")}</span>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
            <span className="text-gradient-magic">Sihir</span> di Tiap Pelajaran
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.key1}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg transition-all hover:-translate-y-1 hover:shadow-magic"
            >
              <div className={`mb-4 grid size-14 place-items-center rounded-2xl ${f.tint} shadow-soft`}>
                <f.icon className="size-7" />
              </div>
              <h3 className="font-display text-xl font-bold">{t(f.key1 as never)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(f.key2 as never)}</p>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      <footer className="border-t-2 border-border bg-card/50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            <span className="font-display font-semibold">EduQuest RPG</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div>Made with ✨ for learners & teachers</div>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  roleColor, title, desc, cta, search, variant,
}: {
  roleColor: string;
  title: string;
  desc: { id: string; en: string };
  cta: string;
  to: string;
  search: Record<string, string>;
  variant: "guru" | "siswa";
}) {
  const { lang } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg"
    >
      <div className={`absolute -right-8 -top-8 size-32 rounded-full ${roleColor} opacity-20 blur-2xl transition-all group-hover:opacity-30`} />
      <div className={`inline-flex size-12 items-center justify-center rounded-2xl ${roleColor} font-display text-xl font-bold text-white shadow-soft`}>
        {title.charAt(0)}
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc[lang]}</p>
      <Link to="/auth" search={search as never} className="mt-5 inline-block">
        <Button variant={variant} size="lg">{cta}</Button>
      </Link>
    </motion.div>
  );
}
