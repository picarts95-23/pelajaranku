import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/lang-toggle";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

export function DashboardShell({
  children,
  accent,
}: {
  children: ReactNode;
  accent: "guru" | "siswa";
}) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b-2 border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-magic shadow-soft">
              <Wand2 className="size-4 text-primary-foreground" />
            </div>
            <span className="hidden font-display text-lg font-bold sm:inline">
              EduQuest <span className="text-gradient-magic">RPG</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <LangToggle />
            <div className="hidden items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-1.5 shadow-soft sm:flex">
              <div className={`grid size-9 place-items-center rounded-xl ${accent === "guru" ? "bg-guru" : "bg-siswa"} font-display text-sm font-bold text-white`}>
                {initials}
              </div>
              <div className="leading-tight">
                <div className="text-xs text-muted-foreground">
                  {role === "guru" ? t("guru") : t("siswa")}
                </div>
                <div className="font-display text-sm font-semibold">{profile?.full_name ?? "—"}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">{t("logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>

      <footer className="border-t-2 border-border py-6 text-center text-xs text-muted-foreground">
        {lang === "id" ? "Tetap semangat, petualang!" : "Stay curious, adventurer!"} ✨
      </footer>
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
        <div className={`grid size-12 place-items-center rounded-xl ${tint} text-white shadow-soft`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-bold leading-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
