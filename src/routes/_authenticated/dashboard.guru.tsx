import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, ScrollText, TrendingUp, Users, ClipboardCheck, FileQuestion, CalendarCheck, NotebookPen, Trophy, CalendarDays, ArrowRight, Library, BarChart3, BookOpenCheck, Megaphone, AlertTriangle } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatar } from "@/lib/character-roster";
import { SheetBackupCard } from "@/components/sheet-backup-card";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/guru")({
  head: () => ({ meta: [{ title: "Dashboard Guru · Pelajaranku" }] }),
  component: GuruDashboard,
});

function GuruDashboard() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: role === "admin" ? "/admin" : "/dashboard/siswa" });
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

  // Top students grouped per class (3 per class).
  const { data: topByClass = [] } = useQuery({
    queryKey: ["guru-top-by-class", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: classes } = await supabase.from("classes").select("id, name").eq("teacher_id", user!.id).order("name");
      const clsList = (classes ?? []) as any[];
      if (clsList.length === 0) return [];
      const classIds = clsList.map((c) => c.id);
      const { data: enrolls } = await supabase.from("class_enrollments").select("class_id, student_id").in("class_id", classIds);
      const idSet = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      const { data: profs } = idSet.length
        ? await supabase.from("profiles").select("id, full_name, xp, level").in("id", idSet)
        : { data: [] as any[] };
      const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return clsList.map((c) => ({
        id: c.id as string,
        name: c.name as string,
        students: (enrolls ?? [])
          .filter((e: any) => e.class_id === c.id)
          .map((e: any) => profById.get(e.student_id))
          .filter(Boolean)
          .sort((a: any, b: any) => (b.xp ?? 0) - (a.xp ?? 0))
          .slice(0, 3),
      }));
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

  // Missed-assignment recap: past-deadline tasks with no submission from enrolled students.
  const { data: missed = [] } = useQuery({
    queryKey: ["guru-missed-tasks", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: assigns } = await supabase
        .from("assignments")
        .select("id, title, class_id, due_at, subject, classes(name)")
        .eq("teacher_id", user!.id)
        .not("due_at", "is", null)
        .lte("due_at", new Date().toISOString())
        .order("due_at", { ascending: false });
      const list = (assigns ?? []) as any[];
      if (list.length === 0) return [];
      const classIds = Array.from(new Set(list.map((a) => a.class_id).filter(Boolean)));
      const assignIds = list.map((a) => a.id);
      const [{ data: enrolls }, { data: subs }] = await Promise.all([
        supabase.from("class_enrollments").select("class_id, student_id").in("class_id", classIds),
        supabase.from("submissions").select("assignment_id, student_id").in("assignment_id", assignIds),
      ]);
      const studentIds = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      const [{ data: profs }, { data: privs }] = await Promise.all([
        studentIds.length ? supabase.from("profiles").select("id, full_name").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
        studentIds.length ? supabase.from("profile_private").select("id, school_id_number").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      const nisById = new Map((privs ?? []).map((p: any) => [p.id, p.school_id_number]));
      const rosterByClass = new Map<string, string[]>();
      for (const e of (enrolls ?? []) as any[]) {
        if (!rosterByClass.has(e.class_id)) rosterByClass.set(e.class_id, []);
        rosterByClass.get(e.class_id)!.push(e.student_id);
      }
      const submittedKeys = new Set((subs ?? []).map((s: any) => `${s.assignment_id}::${s.student_id}`));
      const rows: { key: string; assignmentId: string; title: string; className: string; dueAt: string; studentId: string; studentName: string; nis: string | null }[] = [];
      for (const a of list) {
        const roster = a.class_id ? rosterByClass.get(a.class_id) ?? [] : [];
        for (const sid of roster) {
          if (submittedKeys.has(`${a.id}::${sid}`)) continue;
          rows.push({
            key: `${a.id}::${sid}`,
            assignmentId: a.id,
            title: a.title,
            className: a.classes?.name ?? "—",
            dueAt: a.due_at,
            studentId: sid,
            studentName: nameById.get(sid) ?? "—",
            nis: nisById.get(sid) ?? null,
          });
        }
      }
      return rows;
    },
  });

  if (loading || role !== "guru") {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground" role="status">{lang === "id" ? "Memuat akun…" : "Loading account…"}</div>;
  }

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

      <section className="mt-6 rounded-3xl border-2 border-destructive/40 bg-destructive/5 p-5 shadow-card-rpg">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {lang === "id" ? "Rekap Siswa Tidak Mengerjakan Tugas" : "Missed Assignments Recap"}
            <span className="grid min-w-6 place-items-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">{missed.length}</span>
          </h2>
          <Link to="/guru/tugas"><Button size="sm" variant="ghost">{lang === "id" ? "Buka tugas" : "Open tasks"} →</Button></Link>
        </div>
        {missed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "id"
              ? "Alhamdulillah, tidak ada siswa yang melewatkan tugas."
              : "No students have missed a deadline."}
          </p>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-2xl border-2 border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{lang === "id" ? "Siswa" : "Student"}</th>
                  <th className="px-3 py-2">NIS</th>
                  <th className="px-3 py-2">{lang === "id" ? "Kelas" : "Class"}</th>
                  <th className="px-3 py-2">{lang === "id" ? "Tugas" : "Assignment"}</th>
                  <th className="px-3 py-2">{lang === "id" ? "Tenggat" : "Deadline"}</th>
                </tr>
              </thead>
              <tbody>
                {missed.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-3 py-2 font-display font-semibold">{r.studentName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.nis ?? "—"}</td>
                    <td className="px-3 py-2">{r.className}</td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 text-destructive">{format(new Date(r.dueAt), "dd MMM yyyy HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>



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
              title={lang === "id" ? "Dokumen Pembelajaran" : "Learning Documents"}
              desc={lang === "id" ? "Prota, Prosem, dan Jurnal Guru." : "Annual, semester programs & journal."}
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
              to="/guru/pengumuman"
              icon={<Megaphone className="size-6" />}
              title={lang === "id" ? "Papan Pengumuman" : "Announcements"}
              desc={lang === "id" ? "Kirim pengumuman ke siswa & lihat reaksi serta masukan mereka." : "Post announcements & see student reactions and feedback."}
              tint="bg-gradient-sunset"
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
            <div className="overflow-x-auto rounded-2xl border-2 border-border">
              <table className="w-full min-w-[520px] text-sm">
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
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2"><GraduationCap className="size-5 text-accent" /> {lang === "id" ? "Murid Terbaik per Kelas" : "Top Students per Class"}</h2>
          {topByClass.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{t("empty")}</div> : (
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {topByClass.map((c: any) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-display font-bold text-guru">
                    <BookOpen className="size-4" /> {c.name}
                  </div>
                  {c.students.length === 0 ? (
                    <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{lang === "id" ? "Belum ada siswa" : "No students yet"}</div>
                  ) : (
                    <ul className="space-y-2">
                      {c.students.map((s: any, i: number) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                          <div className={`grid size-8 place-items-center rounded-lg font-display text-sm font-bold text-white ${i === 0 ? "bg-coin text-quest-foreground" : i === 1 ? "bg-siswa" : "bg-muted-foreground/50"}`}>{i + 1}</div>
                          <div className="min-w-0 flex-1 truncate font-display font-semibold">{s.full_name}</div>
                          <div className="text-sm font-display font-bold text-primary">{(s.xp ?? 0).toLocaleString()} XP</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
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
