import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, KeyRound, Eye, EyeOff, Compass } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atur Ulang Kata Sandi · EduQuest Academy" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Supabase sets a temporary recovery session when the user opens the email
  // link (type=recovery in the URL hash). We confirm a session exists before
  // allowing the password change.
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(lang === "id" ? "Password minimal 6 karakter" : "Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error(lang === "id" ? "Konfirmasi password tidak cocok" : "Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(lang === "id" ? "Password berhasil diganti!" : "Password updated!");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute -left-20 top-10 -z-10 size-72 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute -right-10 bottom-10 -z-10 size-80 rounded-full bg-primary/25 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/auth" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {lang === "id" ? "Kembali ke Masuk" : "Back to Sign in"}
        </Link>
        <LangToggle />
      </header>

      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full rounded-3xl border-2 border-border bg-card p-6 shadow-magic sm:p-8"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
              <KeyRound className="size-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-tight">
                {lang === "id" ? "Atur Ulang Kata Sandi" : "Reset Password"}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "id" ? "Buat kata sandi baru untuk akunmu" : "Create a new password for your account"}
              </div>
            </div>
          </div>

          {!ready ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> {lang === "id" ? "Memuat…" : "Loading…"}
            </div>
          ) : !hasSession ? (
            <div className="rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-display font-semibold text-destructive">
                {lang === "id" ? "Tautan tidak valid atau kedaluwarsa" : "Invalid or expired link"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {lang === "id"
                  ? "Silakan minta tautan atur ulang baru dari halaman masuk."
                  : "Please request a new reset link from the sign-in page."}
              </p>
              <Button asChild className="mt-4 w-full"><Link to="/auth">{lang === "id" ? "Ke halaman masuk" : "Go to sign in"}</Link></Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">{lang === "id" ? "Password baru" : "New password"}</Label>
                <div className="relative">
                  <Input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="h-11 rounded-xl border-2 bg-card pr-11"
                  />
                  <button type="button" onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Sembunyikan" : "Tampilkan"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">{lang === "id" ? "Ulangi password" : "Confirm password"}</Label>
                <Input
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-11 rounded-xl border-2 bg-card"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {lang === "id" ? "Simpan password baru" : "Save new password"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 text-xs text-muted-foreground">
        <Compass className="size-3.5" /> EduQuest Academy
      </div>
    </div>
  );
}
