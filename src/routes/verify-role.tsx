import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldAlert, Sparkles, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  role: z.enum(["guru", "siswa"]).optional(),
  auto: z.coerce.boolean().optional().default(true),
});

export const Route = createFileRoute("/verify-role")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verifikasi Peran · Pelajaranku" },
      { name: "description", content: "Memverifikasi peran akunmu untuk mengarahkan ke dashboard yang tepat." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Verifikasi Peran · Pelajaranku" },
      { property: "og:description", content: "Memverifikasi peran akunmu untuk mengarahkan ke dashboard yang tepat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyRolePage,
});

type SyncState = "syncing" | "ready" | "missing" | "error";

function VerifyRolePage() {
  const { role: ctxRole, loading, session, user, profile, refresh } = useAuth();
  const { role: chosenRole, auto } = Route.useSearch();
  const navigate = useNavigate();
  const { lang } = useLang();

  // Authoritative role pulled fresh from user_roles
  const [dbRole, setDbRole] = useState<AppRole | null>(ctxRole);
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [countdown, setCountdown] = useState(3);

  // Fetch role directly from user_roles (source of truth)
  const fetchRole = async () => {
    if (!session?.user) return;
    setSyncState("syncing");
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      const r = (data?.role as AppRole | undefined) ?? null;
      setDbRole(r);
      setSyncState(r ? "ready" : "missing");
      // Keep context in sync so the rest of the app sees the same role
      await refresh();
    } catch {
      setSyncState("error");
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    fetchRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.user?.id]);

  const destFor = (r: AppRole) => (r === "admin" ? "/admin" : r === "guru" ? "/dashboard/guru" : "/dashboard/siswa");

  // Auto redirect only after we've authoritatively synced with user_roles
  useEffect(() => {
    if (!auto || syncState !== "ready" || !dbRole) return;
    if (countdown <= 0) {
      navigate({ to: destFor(dbRole) });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [auto, syncState, dbRole, countdown, navigate]);

  const goToDashboard = () => {
    if (!dbRole) return;
    navigate({ to: destFor(dbRole) });
  };

  // ---------- Render states ----------

  if (loading || syncState === "syncing") {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <h1 className="mt-5 font-display text-xl font-bold">
            {lang === "id" ? "Menyinkronkan peran…" : "Syncing role…"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "id"
              ? "Mengambil data peran dari basis data."
              : "Fetching your role from the database."}
          </p>
        </div>
      </Shell>
    );
  }

  if (syncState === "error") {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-destructive/15">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold">
            {lang === "id" ? "Gagal memverifikasi" : "Verification failed"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "id"
              ? "Tidak bisa membaca peran dari basis data. Coba lagi."
              : "Couldn't read your role from the database. Try again."}
          </p>
          <Button onClick={fetchRole} variant="outline" className="mt-6 w-full">
            <RefreshCw className="size-4" />
            {lang === "id" ? "Coba lagi" : "Retry"}
          </Button>
        </div>
      </Shell>
    );
  }

  if (syncState === "missing" || !dbRole) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-destructive/15">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold">
            {lang === "id" ? "Peran Belum Diatur" : "No Role Assigned"}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {lang === "id"
              ? "Akun ini belum memiliki peran di basis data. Hubungi admin atau daftar ulang."
              : "This account has no role in the database. Contact admin or sign up again."}
          </p>
          <div className="mt-6 w-full space-y-3">
            <Button onClick={fetchRole} variant="outline" className="w-full">
              <RefreshCw className="size-4" />
              {lang === "id" ? "Sinkron ulang" : "Resync"}
            </Button>
            <Link to="/auth" className="block text-center text-xs text-muted-foreground underline">
              {lang === "id" ? "Kembali ke halaman masuk" : "Back to sign in"}
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ready
  const mismatch = chosenRole && chosenRole !== dbRole;
  const roleLabel = dbRole === "guru" ? (lang === "id" ? "Guru" : "Teacher") : (lang === "id" ? "Siswi" : "Student");
  const roleColor = dbRole === "guru" ? "guru" : "siswa";

  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <div className={`grid size-16 place-items-center rounded-2xl shadow-glow ${
          mismatch ? "bg-amber-500/15" : `bg-${roleColor}/15`
        }`}>
          {mismatch ? (
            <ShieldAlert className="size-8 text-amber-600" />
          ) : (
            <CheckCircle2 className={`size-8 text-${roleColor}`} />
          )}
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold">
          {mismatch
            ? (lang === "id" ? "Peran Berbeda Terdeteksi" : "Different Role Detected")
            : (lang === "id" ? "Peran Terverifikasi" : "Role Verified")}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {profile?.full_name ?? user?.email}
        </p>

        <div className={`mt-6 inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-display font-semibold ${
          dbRole === "guru" ? "border-guru bg-guru/10 text-guru" : "border-siswa bg-siswa/10 text-siswa"
        }`}>
          <Sparkles className="size-4" />
          {lang === "id" ? "Peran tersimpan: " : "Stored role: "} {roleLabel}
        </div>

        {chosenRole && (
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "id" ? "Peran dipilih saat login: " : "Selected at login: "}
            <span className="font-semibold">
              {chosenRole === "guru" ? (lang === "id" ? "Guru" : "Teacher") : (lang === "id" ? "Siswi" : "Student")}
            </span>
            {mismatch && (
              <span className="ml-1 text-amber-600">
                {lang === "id" ? "(diabaikan)" : "(ignored)"}
              </span>
            )}
          </p>
        )}

        <div className="mt-6 w-full space-y-3">
          <Button onClick={goToDashboard} variant={roleColor as "guru" | "siswa"} size="lg" className="w-full">
            {lang === "id" ? "Buka Dashboard " : "Open "} {roleLabel}
            <ArrowRight className="size-4" />
          </Button>
          {auto && !mismatch && (
            <p className="text-xs text-muted-foreground">
              {lang === "id"
                ? `Mengarahkan otomatis dalam ${countdown} detik…`
                : `Redirecting automatically in ${countdown}s…`}
            </p>
          )}
          {mismatch && (
            <p className="text-xs text-amber-600">
              {lang === "id"
                ? "Redirect mengikuti peran tersimpan, bukan pilihan saat login."
                : "Redirect follows the stored role, not your login selection."}
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-8 shadow-magic"
      >
        {children}
      </motion.div>
    </div>
  );
}
