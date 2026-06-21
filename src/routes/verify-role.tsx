import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldAlert, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { z } from "zod";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  role: z.enum(["guru", "siswa"]).optional(),
  auto: z.coerce.boolean().optional().default(true),
});

export const Route = createFileRoute("/verify-role")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Verifikasi Peran · EduQuest Academy" }] }),
  component: VerifyRolePage,
});

function VerifyRolePage() {
  const { role, loading, session, user, profile } = useAuth();
  const { role: chosenRole, auto } = Route.useSearch();
  const navigate = useNavigate();
  const { lang } = useLang();
  const [countdown, setCountdown] = useState(3);

  const metaRole = (user?.user_metadata?.role as AppRole | undefined) ?? null;
  const detected: AppRole | null = role ?? metaRole ?? chosenRole ?? null;
  const mismatch = chosenRole && detected && chosenRole !== detected;

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!auto || !detected || mismatch) return;
    if (countdown <= 0) {
      navigate({ to: detected === "guru" ? "/dashboard/guru" : "/dashboard/siswa" });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [auto, detected, mismatch, countdown, navigate]);

  const goToDashboard = () => {
    if (!detected) return;
    navigate({ to: detected === "guru" ? "/dashboard/guru" : "/dashboard/siswa" });
  };

  if (loading || !detected) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {lang === "id" ? "Memverifikasi peran…" : "Verifying role…"}
        </div>
      </div>
    );
  }

  const roleLabel = detected === "guru" ? (lang === "id" ? "Guru" : "Teacher") : (lang === "id" ? "Siswi" : "Student");
  const roleColor = detected === "guru" ? "guru" : "siswa";

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-8 shadow-magic"
      >
        <div className="flex flex-col items-center text-center">
          <div className={`grid size-16 place-items-center rounded-2xl shadow-glow ${
            mismatch ? "bg-destructive/15" : `bg-${roleColor}/15`
          }`}>
            {mismatch ? (
              <ShieldAlert className="size-8 text-destructive" />
            ) : (
              <CheckCircle2 className={`size-8 text-${roleColor}`} />
            )}
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold">
            {mismatch
              ? (lang === "id" ? "Peran Tidak Cocok" : "Role Mismatch")
              : (lang === "id" ? "Peran Terverifikasi" : "Role Verified")}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {profile?.full_name ?? user?.email}
          </p>

          <div className={`mt-6 inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-display font-semibold ${
            detected === "guru" ? "border-guru bg-guru/10 text-guru" : "border-siswa bg-siswa/10 text-siswa"
          }`}>
            <Sparkles className="size-4" />
            {lang === "id" ? "Peran terdeteksi: " : "Detected role: "} {roleLabel}
          </div>

          {chosenRole && (
            <p className="mt-3 text-xs text-muted-foreground">
              {lang === "id" ? "Peran dipilih saat login: " : "Selected at login: "}
              <span className="font-semibold">
                {chosenRole === "guru" ? (lang === "id" ? "Guru" : "Teacher") : (lang === "id" ? "Siswi" : "Student")}
              </span>
            </p>
          )}

          {mismatch ? (
            <div className="mt-6 w-full space-y-3 rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-4 text-left text-sm">
              <p>
                {lang === "id"
                  ? "Akun ini terdaftar sebagai peran berbeda. Kamu akan diarahkan ke dashboard sesuai peran terdaftar."
                  : "This account is registered with a different role. You'll be sent to the dashboard for the registered role."}
              </p>
              <Button onClick={goToDashboard} variant={roleColor as "guru" | "siswa"} className="w-full">
                {lang === "id" ? "Lanjut ke Dashboard " : "Continue to "} {roleLabel}
                <ArrowRight className="size-4" />
              </Button>
              <Link to="/auth" className="block text-center text-xs text-muted-foreground underline">
                {lang === "id" ? "Masuk dengan akun lain" : "Sign in with another account"}
              </Link>
            </div>
          ) : (
            <div className="mt-6 w-full space-y-3">
              <Button onClick={goToDashboard} variant={roleColor as "guru" | "siswa"} size="lg" className="w-full">
                {lang === "id" ? "Buka Dashboard " : "Open "} {roleLabel}
                <ArrowRight className="size-4" />
              </Button>
              {auto && (
                <p className="text-xs text-muted-foreground">
                  {lang === "id"
                    ? `Mengarahkan otomatis dalam ${countdown} detik…`
                    : `Redirecting automatically in ${countdown}s…`}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
