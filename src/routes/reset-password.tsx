import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, KeyRound, Eye, EyeOff, Compass } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";

const searchSchema = z.object({
  code: z.string().optional(),
  token_hash: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Atur Ulang Kata Sandi · Pelajaranku" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Atur Ulang Kata Sandi untuk mengelola dan memantau pembelajaran di Pelajaranku." },
      { property: "og:title", content: "Atur Ulang Kata Sandi · Pelajaranku" },
      { property: "og:description", content: "Atur Ulang Kata Sandi untuk mengelola dan memantau pembelajaran di Pelajaranku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { lang } = useLang();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const beginRecovery = async () => {
    setLinkError(null);

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hashType = hashParams.get("type");
    const errorDescription = hashParams.get("error_description") || queryParams.get("error_description");

    if (errorDescription) {
      setLinkError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
      setReady(true);
      return;
    }

    try {
      if (accessToken && refreshToken && hashType === "recovery") {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        setHasSession(!!data.session);
        setAccountEmail(data.session?.user.email ?? null);
        window.history.replaceState({}, document.title, "/reset-password");
        setReady(true);
        return;
      }

      if (search.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(search.code);
        if (error) throw error;
        setHasSession(!!data.session);
        setAccountEmail(data.session?.user.email ?? null);
        window.history.replaceState({}, document.title, "/reset-password");
        setReady(true);
        return;
      }

      if (search.token_hash && search.type === "recovery") {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: search.token_hash,
          type: "recovery",
        });
        if (error) throw error;
        setHasSession(!!data.session);
        setAccountEmail(data.session?.user.email ?? null);
        window.history.replaceState({}, document.title, "/reset-password");
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setAccountEmail(data.session?.user.email ?? null);
      setReady(true);
    } catch (err) {
      setLinkError((err as Error).message);
      setHasSession(false);
      setReady(true);
    }
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setAccountEmail(session?.user.email ?? null);
      }
    });
    beginRecovery();
    return () => { active = false; sub.subscription.unsubscribe(); };
    // Recovery is handled once when the email link opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const email = accountEmail ?? undefined;
      await supabase.auth.signOut();
      navigate({ to: "/auth", search: { mode: "login", email, reset: "success" } });
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
                {linkError || (lang === "id"
                  ? "Silakan minta tautan atur ulang baru dari halaman masuk."
                  : "Please request a new reset link from the sign-in page.")}
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/auth" search={{ mode: "login" }}>{lang === "id" ? "Ke halaman masuk" : "Go to sign in"}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {accountEmail && (
                <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
                  {lang === "id" ? "Akun" : "Account"}: <span className="font-semibold text-foreground">{accountEmail}</span>
                </div>
              )}
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
        <Compass className="size-3.5" /> Pelajaranku
      </div>
    </div>
  );
}
