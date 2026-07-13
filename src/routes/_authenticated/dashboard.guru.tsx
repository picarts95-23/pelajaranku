import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, ScrollText, TrendingUp, Users, ClipboardCheck, FileQuestion, CalendarCheck, NotebookPen, Trophy, CalendarDays, ArrowRight, Library, BarChart3, BookOpenCheck } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatar } from "@/lib/character-roster";
import { SheetBackupCard } from "@/components/sheet-backup-card";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/guru")({
  head: () => ({ meta: [{ title: "Dashboard Guru · EduQuest RPG" }] }),
  component: GuruDashboard,
});

function GuruDashboard() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["guru-stats", user?.id], enabled: !!user,
    queryFn: async () => {
      const [{ count: classCount }, { data: enrolls }, { data: subs }, { count: assCount }] = await Promise.all([
        supabase.from("classes").select("*", { count: "exact", head: true }),
        supabase.from("class_enrollments").select("student_id, classes!inner(teacher_id)").eq("classes.teacher_id", user!.id),
        supabase.from("submissions").select("status, assignments!inner(teacher_id)").eq("assignments.teacher_id", user!.id),
        supabase.from("assignments").select("*", { count: "exact", head: true }),
      ]);
      const studentSet = new Set((enrolls ?? []).map((e: any) => e.student_id));
      const pending = (subs ?? []).filter((s: any) => s.status === "submitted").length;
      return { classes: classCount ?? 0, students: studentSet.size, pending, assignments: assCount ?? 0 };
    },
  });

  const { data: recentAssignments = [] } = useQuery({
    queryKey: ["guru-recent-ass", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*, classes(name), submissions(id, status)").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const { data: topStudents = [] } = useQuery({
    queryKey: ["guru-top", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: enrolls } = await supabase.from("class_enrollments").select("student_id, classes!inner(teacher_id)").eq("classes.teacher_id", user!.id);
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, xp, class_name").in("id", ids).order("xp", { ascending: false }).limit(5);
      return profs ?? [];
    },
  });

  // Students who recently submitted a task (awaiting grading)
  const { data: recentSubs = [] } = useQuery({
    queryKey: ["guru-recent-subs", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, status, submitted_at, student_id, assignments!inner(title, teacher_id)")
        .eq("assignments.teacher_id", user!.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(8);
      const ids = Array.from(new Set((data ?? []).map((s: any) => s.student_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (data ?? []).map((s: any) => ({ ...s, name: profs?.find((p: any) => p.id === s.student_id)?.full_name ?? "—" }));
    },
  });

  return (
    <DashboardShell accent="guru">
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-magic p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 size-56 rounded-full bg-guru/40 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-sm font-display font-semibold uppercase tracking-wider opacity-80">{t("dashboard")} · {t("guru")}</div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
              {lang === "id"
                ? `Selamat datang kembali, ${profile?.full_name ?? "Bapak/Ibu Guru"} 🌟`
                : `Welcome back, ${profile?.full_name ?? "Teacher"} 🌟`}
            </h1>
            <p className="mt-2 max-w-xl opacity-90">
              {lang === "id"
                ? `Mata pelajaran: ${profile?.subject ?? "—"} · Semoga mengajarmu hari ini penuh berkah.`
                : `Subject: ${profile?.subject ?? "—"} · May your teaching today be blessed.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/guru/kelas"><Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("navClasses")}</Button></Link>
              <Link to="/guru/tugas"><Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t("navAssignments")}</Button></Link>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: 4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="hidden sm:flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-white/30 blur-2xl" />
              <img
                src={resolveAvatar(profile as any, "guru")}
                alt={lang === "id" ? "Karakter guru/guru" : "Teacher character"}
                width={192}
                height={192}
                className="size-40 lg:size-48 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/guru/kelas" className="transition-transform hover:-translate-y-0.5"><StatCard icon={<BookOpen className="size-6" />} label={t("navClasses")} value={stats?.classes ?? 0} tint="bg-guru" /></Link>
        <Link to="/guru/siswa" className="transition-transform hover:-translate-y-0.5"><StatCard icon={<Users className="size-6" />} label={t("navStudents")} value={stats?.students ?? 0} tint="bg-siswa" /></Link>
        <Link to="/guru/tugas" className="transition-transform hover:-translate-y-0.5"><StatCard icon={<ClipboardCheck className="size-6" />} label={t("submissions")} value={stats?.pending ?? 0} tint="bg-xp" sub={lang === "id" ? "menunggu nilai" : "to review"} /></Link>
        <Link to="/guru/tugas" className="transition-transform hover:-translate-y-0.5"><StatCard icon={<ScrollText className="size-6" />} label={t("assignments")} value={stats?.assignments ?? 0} tint="bg-quest" /></Link>
      </section>

      <SheetBackupCard />



      {recentSubs.length > 0 && (
        <section className="mt-6 rounded-3xl border-2 border-guru/40 bg-guru/5 p-5 shadow-card-rpg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="size-5 text-guru" /> {lang === "id" ? "Pengumpulan Baru Siswa" : "New Student Submissions"}
              <span className="grid min-w-6 place-items-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">{recentSubs.length}</span>
            </h2>
            <Link to="/guru/tugas"><Button size="sm" variant="ghost">{lang === "id" ? "Nilai sekarang" : "Grade now"} →</Button></Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recentSubs.map((s: any) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-soft">
                <div className="grid size-9 place-items-center rounded-lg bg-guru/15 text-guru">📤</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.assignments?.title} · {s.submitted_at ? format(new Date(s.submitted_at), "dd MMM HH:mm") : ""}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ScrollText className="size-5 text-guru" /> {lang === "id" ? "Pintasan" : "Shortcuts"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {lang === "id" ? "Geser untuk lihat semua fitur" : "Scroll to see all tools"}
          </span>
        </div>
        <div className="max-h-[440px] overflow-y-auto rounded-3xl border-2 border-border bg-muted/20 p-3 shadow-inner">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              to="/guru/kelas"
              icon={<BookOpen className="size-6" />}
              title={lang === "id" ? "Kelola Kelas" : "Manage Classes"}
              desc={lang === "id" ? "Buat kelas baru, undang siswi, atur kode kelas." : "Create classes, invite students, manage codes."}
              tint="bg-guru"
            />
            <FeatureCard
              to="/guru/mapel"
              icon={<Library className="size-6" />}
              title={lang === "id" ? "Mata Pelajaran & Materi" : "Subjects & Materials"}
              desc={lang === "id" ? "Kelola mapel yang diampu & bagikan materi." : "Manage taught subjects & share materials."}
              tint="bg-gradient-magic"
            />
            <FeatureCard
              to="/guru/tugas"
              icon={<NotebookPen className="size-6" />}
              title={lang === "id" ? "Buat Tugas & Materi" : "Assignments & Materials"}
              desc={lang === "id" ? "Susun tugas, materi, dan rubrik penilaian." : "Author assignments and grading rubrics."}
              tint="bg-quest"
            />
            <FeatureCard
              to="/guru/rpp"
              icon={<NotebookPen className="size-6" />}
              title={lang === "id" ? "RPP Pekanan" : "Weekly Lesson Plan"}
              desc={lang === "id" ? "Susun rencana pembelajaran pekanan per kelas & mata pelajaran." : "Plan weekly lessons per class & subject."}
              tint="bg-primary"
            />
            <FeatureCard
              to="/guru/rekap"
              icon={<BarChart3 className="size-6" />}
              title={lang === "id" ? "Rekap Nilai & Laporan" : "Grade Recap & Report"}
              desc={lang === "id" ? "Arsip nilai per kelas/mapel + Laporan Progres (rata-rata, XP/koin, Mutaba'ah)." : "Grade archives + Progress Report (averages, XP/coins, Mutaba'ah)."}
              tint="bg-siswa"
            />
            <FeatureCard
              to="/guru/bank-soal"
              icon={<FileQuestion className="size-6" />}
              title={lang === "id" ? "Bank Soal (Perpustakaan)" : "Question Bank (Library)"}
              desc={lang === "id" ? "Simpan koleksi soal (maks 40 campuran), lalu impor ke Tugas saat akan dikirim." : "Store question sets (max 40 mixed), then import into a Task when ready to send."}
              tint="bg-accent"
            />
            <FeatureCard
              to="/guru/siswa"
              icon={<TrendingUp className="size-6" />}
              title={lang === "id" ? "Progres Siswa" : "Student Progress"}
              desc={lang === "id" ? "Ringkasan XP, nilai, dan capaian siswi." : "XP, scores, and achievement overview."}
              tint="bg-siswa"
            />
            <FeatureCard
              to="/guru/presensi"
              icon={<CalendarCheck className="size-6" />}
              title={lang === "id" ? "Presensi" : "Attendance"}
              desc={lang === "id" ? "Catat kehadiran setiap pertemuan." : "Track attendance per session."}
              tint="bg-xp"
            />
            <FeatureCard
              to="/guru/jurnal"
              icon={<ScrollText className="size-6" />}
              title={lang === "id" ? "Jurnal Mengajar" : "Teaching Journal"}
              desc={lang === "id" ? "Catat aktivitas dan refleksi mengajar." : "Log activities and teaching reflections."}
              tint="bg-primary"
            />
            <FeatureCard
              to="/guru/gamifikasi"
              icon={<Trophy className="size-6" />}
              title={lang === "id" ? "Gamifikasi & Badge" : "Gamification & Badges"}
              desc={lang === "id" ? "Atur reward XP, koin, dan lencana." : "Set XP rewards, coins, and badges."}
              tint="bg-quest"
            />
            <FeatureCard
              to="/guru/event"
              icon={<CalendarDays className="size-6" />}
              title={lang === "id" ? "Event Kelas" : "Class Events"}
              desc={lang === "id" ? "Jadwalkan acara, ujian, dan agenda." : "Schedule events, exams, and agendas."}
              tint="bg-accent"
            />
            <FeatureCard
              to="/guru/mutabaah"
              icon={<BookOpenCheck className="size-6" />}
              title={lang === "id" ? "Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"}
              desc={lang === "id" ? "Nilai setoran Halaqoh: Tajwid, Kelancaran, Fashohah & Adab." : "Assess Halaqoh: Tajwid, Fluency, Fashohah & Adab."}
              tint="bg-gradient-magic"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2"><BookOpen className="size-5 text-guru" /> {t("assignments")}</h2>
          {recentAssignments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t("empty")}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border-2 border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-4 py-3">{lang === "id" ? "Judul" : "Title"}</th><th className="px-4 py-3">{lang === "id" ? "Kelas" : "Class"}</th><th className="px-4 py-3">{lang === "id" ? "Deadline" : "Due"}</th><th className="px-4 py-3 text-right">{t("submissions")}</th></tr>
                </thead>
                <tbody>
                  {recentAssignments.map((a: any) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-4 py-3 font-display font-semibold">{a.title}</td>
                      <td className="px-4 py-3">{a.classes?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.due_at ? format(new Date(a.due_at), "dd MMM") : "—"}</td>
                      <td className="px-4 py-3 text-right"><span className="rounded-full bg-xp/15 px-3 py-1 font-display text-xs font-bold text-xp">{a.submissions?.length ?? 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2"><GraduationCap className="size-5 text-accent" /> {lang === "id" ? "Murid Terbaik" : "Top Students"}</h2>
          {topStudents.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{t("empty")}</div> : (
            <ul className="space-y-2">
              {topStudents.map((s: any, i: number) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-siswa font-display text-sm font-bold text-white">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.class_name ?? "—"}</div>
                  </div>
                  <div className="text-sm font-display font-bold text-primary">{s.xp.toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function FeatureCard({
  to, icon, title, desc, tint,
}: {
  to: string; icon: React.ReactNode; title: string; desc: string; tint: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-magic"
    >
      <div className="flex items-start gap-3">
        <div className={`grid size-11 place-items-center rounded-xl text-white shadow-soft ${tint}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-bold">{title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
