import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LogOut, Compass, LayoutDashboard, BookOpen, Users, ScrollText, CalendarCheck,
  NotebookPen, CalendarDays, Database, Trophy, Sword, GraduationCap, Award, Menu, X, UserCircle2, History,
  Library, BarChart3, ArrowLeft, BookOpenCheck, Megaphone,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/lang-toggle";
import { AiAssistant } from "@/components/ai-assistant";
import { useAuth } from "@/lib/auth-context";
import { useLang, type Key } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { resolveAvatar } from "@/lib/character-roster";
import { supabase } from "@/integrations/supabase/client";
import { useUnseenCount } from "@/lib/notifications";

type NavItem = { to: string; key: Key; icon: React.ComponentType<{ className?: string }> };

const GURU_NAV: NavItem[] = [
  { to: "/dashboard/guru", key: "navDashboard", icon: LayoutDashboard },
  { to: "/guru/kelas", key: "navClasses", icon: BookOpen },
  { to: "/guru/siswa", key: "navStudents", icon: Users },
  { to: "/guru/mapel", key: "navSubjects", icon: Library },
  { to: "/guru/rpp", key: "navRPP", icon: NotebookPen },
  { to: "/guru/tugas", key: "navAssignments", icon: ScrollText },
  { to: "/guru/rekap", key: "navRecap", icon: BarChart3 },
  { to: "/guru/presensi", key: "navAttendance", icon: CalendarCheck },
  { to: "/guru/jurnal", key: "navJournal", icon: NotebookPen },
  { to: "/guru/mutabaah", key: "navMutabaah", icon: BookOpenCheck },
  { to: "/guru/event", key: "navEvents", icon: CalendarDays },
  { to: "/guru/pengumuman", key: "navAnnouncements", icon: Megaphone },
  { to: "/guru/bank-soal", key: "navQuestionBank", icon: Database },
  { to: "/guru/gamifikasi", key: "navGamification", icon: Trophy },
];

const SISWA_NAV: NavItem[] = [
  { to: "/dashboard/siswa", key: "navDashboard", icon: LayoutDashboard },
  { to: "/siswa/kelas", key: "myClasses", icon: BookOpen },
  { to: "/siswa/mapel", key: "navSubjects", icon: Library },
  { to: "/siswa/tugas", key: "navMyQuests", icon: Sword },
  { to: "/siswa/mutabaah", key: "navMutabaah", icon: BookOpenCheck },
  { to: "/siswa/pengumuman", key: "navAnnouncements", icon: Megaphone },
  { to: "/siswa/nilai", key: "navGrades", icon: GraduationCap },
  { to: "/siswa/badge", key: "navBadges", icon: Award },
  { to: "/siswa/riwayat", key: "navHistory", icon: History },
  { to: "/siswa/leaderboard", key: "leaderboard", icon: Trophy },
  { to: "/siswa/profil", key: "navProfile", icon: UserCircle2 },
];


export function DashboardShell({
  children,
  accent,
}: {
  children: ReactNode;
  accent: "guru" | "siswa";
}) {
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = accent === "guru" ? GURU_NAV : SISWA_NAV;

  // Student "new since last visit" badges for materials & assignments
  const { data: matList } = useQuery({
    queryKey: ["nav-materials", user?.id], enabled: !!user && accent === "siswa",
    queryFn: async () => (await supabase.from("materials").select("created_at")).data ?? [],
  });
  const { data: tugasList } = useQuery({
    queryKey: ["nav-assignments", user?.id], enabled: !!user && accent === "siswa",
    queryFn: async () => (await supabase.from("assignments").select("created_at")).data ?? [],
  });
  const unseenMaterials = useUnseenCount(user?.id, "materials", matList ?? []);
  const unseenTugas = useUnseenCount(user?.id, "assignments", tugasList ?? []);
  const badgeFor = (to: string) =>
    accent === "siswa" && to === "/siswa/mapel" ? unseenMaterials
      : accent === "siswa" && to === "/siswa/tugas" ? unseenTugas
      : 0;

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const avatarSrc = resolveAvatar(profile as any, role as "guru" | "siswa" | null);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b-2 border-border bg-card/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-gradient-magic shadow-soft">
                <Compass className="size-4 text-primary-foreground" />
              </div>
              <span className="hidden font-display text-lg font-bold sm:inline">
                EduQuest <span className="text-gradient-magic">Academy</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle />
            <div className="hidden items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-1.5 shadow-soft md:flex">
              <div className={cn("grid size-10 place-items-center overflow-hidden rounded-xl ring-2", accent === "guru" ? "ring-guru bg-guru/10" : "ring-siswa bg-siswa/10")}>
                <img src={avatarSrc} alt={profile?.full_name ?? "Avatar"} width={40} height={40} className="size-full object-cover" loading="lazy" />
              </div>
              <div className="leading-tight">
                <div className="text-xs text-muted-foreground">{role === "guru" ? t("guru") : t("siswa")}</div>
                <div className="font-display text-sm font-semibold">{profile?.full_name ?? "—"}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">{t("logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-2 sm:px-4 lg:px-6">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-16 left-0 z-30 flex w-64 flex-col border-r-2 border-border bg-card p-3 transition-transform lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              const badge = badgeFor(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-display font-semibold transition-all",
                    active
                      ? accent === "guru"
                        ? "bg-guru text-white shadow-soft"
                        : "bg-siswa text-white shadow-soft"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" /> <span className="flex-1">{t(item.key)}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                      active ? "bg-white text-siswa" : "bg-destructive text-white",
                    )}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {open && <button aria-label="close" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

        <main className="min-w-0 flex-1 py-4 sm:py-6">
          {pathname !== (accent === "guru" ? "/dashboard/guru" : "/dashboard/siswa") && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-3"
              onClick={() => navigate({ to: accent === "guru" ? "/dashboard/guru" : "/dashboard/siswa" })}
            >
              <ArrowLeft className="size-4" /> {lang === "id" ? "Kembali ke Dashboard" : "Back to Dashboard"}
            </Button>
          )}
          {children}
        </main>
      </div>

      <footer className="border-t-2 border-border py-6 text-center text-xs text-muted-foreground">
        {accent === "guru"
          ? (lang === "id" ? "Barakallahu fiikum, semoga ilmu yang diajarkan menjadi amal jariyah. ✨" : "May your teaching be a lasting good deed. ✨")
          : (lang === "id" ? "Tetap semangat menuntut ilmu! ✨" : "Stay curious, dear student! ✨")}
      </footer>

      {accent === "guru" && <AiAssistant />}
    </div>
  );
}

export function StatCard({
  icon, label, value, tint, sub,
}: {
  icon: ReactNode; label: string; value: string | number; tint: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-center gap-3">
        <div className={`grid size-12 place-items-center rounded-xl ${tint} text-white shadow-soft`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-bold leading-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: {
  title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
