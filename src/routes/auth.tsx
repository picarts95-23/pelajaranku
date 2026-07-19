import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Compass, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { claimTeacherRole } from "@/lib/roles.functions";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
  role: z.enum(["guru", "siswa"]).optional().default("siswa"),
  email: z.string().optional(),
  reset: z.enum(["success"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Masuk atau Daftar · Pelajaranku" },
      { name: "description", content: "Masuk atau daftar sebagai guru atau siswi untuk memulai perjalanan menuntut ilmu di Pelajaranku." },
      { property: "og:title", content: "Masuk atau Daftar · Pelajaranku" },
      { property: "og:description", content: "Masuk atau daftar sebagai guru atau siswi untuk memulai perjalanan menuntut ilmu." },
      { property: "og:url", content: "https://pelajaranku.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://pelajaranku.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, role: initialRole, email: initialEmail, reset } = Route.useSearch();
  const navigate = useNavigate();
  const { session, refresh } = useAuth();
  const { t, lang } = useLang();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [role, setRole] = useState<AppRole>(initialRole);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  // Prevents the session listener from redirecting mid-signup, before the
  // teacher role has been granted (which would land teachers on /siswa).
  const submittingRef = useRef(false);

  const openForgot = () => { setResetEmail(email); setForgotOpen(true); };

  const sendReset = async () => {
    const target = resetEmail.trim();
    if (!target) { toast.error(lang === "id" ? "Masukkan email" : "Enter your email"); return; }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(lang === "id"
        ? "Tautan atur ulang dikirim ke email Anda."
        : "Reset link sent to your email.");
      setForgotOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingReset(false);
    }
  };

  useEffect(() => {
    if (session && !submittingRef.current) navigate({ to: "/loading" });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    submittingRef.current = true;
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/loading`,
            data: {
              full_name: fullName,
              class_name: role === "siswa" ? className : null,
              school_id_number: schoolId,
              subject: role === "guru" ? subject : null,
            },
          },
        });
        if (error) throw error;
        // Roles are assigned server-side only. Teacher accounts must prove the
        // shared teacher access code to be elevated from the default student role.
        if (role === "guru") {
          await claimTeacherRole({ data: { code: teacherCode } });
          // Re-read the role into context BEFORE navigating so the loading
          // screen routes to the teacher dashboard, not the student one.
          await refresh();
          toast.success(lang === "id" ? "Akun guru dibuat! Mengarahkan…" : "Teacher account created! Redirecting…");
          submittingRef.current = false;
          navigate({ to: "/loading", search: { role: "guru" } });
          return;
        }
        toast.success(lang === "id" ? "Akun dibuat! Mengarahkan…" : "Account created! Redirecting…");
        submittingRef.current = false;
        navigate({ to: "/loading", search: { role: "siswa" } });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setFailedAttempts(0);
        await refresh();
        toast.success(lang === "id" ? "Selamat datang kembali!" : "Welcome back!");
        submittingRef.current = false;
        navigate({ to: "/loading" });
        return;
      }
    } catch (err) {
      if (mode === "login") {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= 3) {
          setResetEmail(email);
          setForgotOpen(true);
          toast.error(lang === "id"
            ? "Sudah 3 kali gagal. Silakan atur ulang kata sandi Anda."
            : "3 failed attempts. Please reset your password.");
        }
      }
      toast.error((err as Error).message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };


  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute -left-20 top-10 -z-10 size-72 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute -right-10 bottom-10 -z-10 size-80 rounded-full bg-primary/25 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {lang === "id" ? "Kembali" : "Back"}
        </Link>
        <LangToggle />
      </header>

      <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-12 md:grid-cols-2">
        {/* Left poster */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}
          className="hidden md:block"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
              <Compass className="size-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">Pelajaranku <span className="text-gradient-magic">Academy</span></span>
          </div>
          <h1 className="mt-8 font-display text-5xl font-bold leading-tight">
            <span className="text-gradient-hero">{mode === "login" ? t("enterGuild") : t("startQuest")}</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            {lang === "id"
              ? "Pilih peranmu, masuk ke Gerbang Akademi, dan mulai babak baru petualangan menuntut ilmumu."
              : "Choose your role, step through the Academy Gate, and start a new chapter of your learning quest."}
          </p>

          <div className="mt-8 rounded-2xl border-2 border-dashed border-accent/40 bg-card p-5 shadow-card-rpg">
            <div className="font-display font-semibold">
              {lang === "id" ? "Mendaftar sebagai guru?" : "Registering as a teacher?"}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "id"
                ? "Peran guru hanya dapat diaktifkan dengan kode akses guru yang diberikan admin sekolah. Tanpa kode, akun akan terdaftar sebagai siswa."
                : "Teacher access is granted only with the school admin's teacher access code. Without it, the account is registered as a student."}
            </p>
          </div>
        </motion.div>


        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="rounded-3xl border-2 border-border bg-card p-6 shadow-magic sm:p-8"
        >
          {/* Mode switch */}
          {reset === "success" && (
            <div className="mb-5 rounded-2xl border-2 border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
              <p className="font-display font-semibold">
                {lang === "id" ? "Password baru sudah tersimpan" : "New password saved"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {lang === "id"
                  ? "Silakan masuk dengan password baru. Sistem akan membuka dashboard sesuai peran akun Anda."
                  : "Sign in with your new password. The app will open the dashboard for your account role."}
              </p>
            </div>
          )}

          {/* Mode switch */}
          <div className="mb-6 inline-flex rounded-full border-2 border-border bg-muted p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-5 py-2 text-sm font-display font-semibold transition-all ${
                  mode === m
                    ? "bg-gradient-magic text-primary-foreground shadow-soft"
                    : "text-muted-foreground"
                }`}
              >
                {m === "login" ? t("login") : t("signup")}
              </button>
            ))}
          </div>

          {/* Role choose */}
          <div className="mb-5">
            <Label className="mb-2 block">{t("role")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["siswa", "guru"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left font-display transition-all ${
                    role === r
                      ? r === "guru"
                        ? "border-guru bg-guru/10 shadow-soft"
                        : "border-siswa bg-siswa/10 shadow-soft"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{r === "guru" ? "☪︎ Guru" : "✦ Siswi"}</div>
                  <div className="text-base font-bold">{r === "guru" ? t("guru") : t("siswa")}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field label={t("fullName")} value={fullName} onChange={setFullName} required />
                <Field label={t("schoolId")} value={schoolId} onChange={setSchoolId} placeholder={role === "guru" ? "NIP" : "NIS"} />
                {role === "siswa" ? (
                  <Field label={t("className")} value={className} onChange={setClassName} placeholder="VIII-A" />
                ) : (
                  <Field label={t("subject")} value={subject} onChange={setSubject} placeholder="Matematika" />
                )}
              </>
            )}
            <Field label={t("email")} type="email" value={email} onChange={setEmail} required placeholder="you@school.edu" />
            <Field label={t("password")} type="password" value={password} onChange={setPassword} required placeholder="••••••••" />

            {mode === "login" && (
              <div className="flex justify-end">
                <button type="button" onClick={openForgot}
                  className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  {lang === "id" ? "Lupa kata sandi?" : "Forgot password?"}
                </button>
              </div>
            )}

            {mode === "login" && failedAttempts >= 3 && (
              <div className="rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm">
                <p className="font-display font-semibold text-destructive">
                  {lang === "id" ? "Gagal masuk 3 kali" : "3 failed sign-in attempts"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {lang === "id"
                    ? "Lupa kata sandi? Kirim tautan untuk mengatur ulang, atau minta admin menggantinya."
                    : "Forgot your password? Send a reset link, or ask the admin to change it."}
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={openForgot}>
                  <KeyRound className="size-4" /> {lang === "id" ? "Atur ulang kata sandi" : "Reset password"}
                </Button>
              </div>
            )}

            {mode === "signup" && role === "guru" && (
              <Field
                label={lang === "id" ? "Kode Akses Guru" : "Teacher Access Code"}
                value={teacherCode}
                onChange={setTeacherCode}
                required
                placeholder={lang === "id" ? "Dari admin sekolah" : "From school admin"}
              />
            )}

            <Button
              type="submit"
              variant={role === "guru" ? "guru" : "siswa"}
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? t("login") : t("signup")} · {role === "guru" ? t("guru") : t("siswa")}
            </Button>
          </form>
        </motion.div>

      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); sendReset(); }}>
            <DialogHeader>
              <DialogTitle>{lang === "id" ? "Atur ulang kata sandi" : "Reset password"}</DialogTitle>
              <DialogDescription>
                {lang === "id"
                  ? "Masukkan email akunmu. Tautan untuk membuat password baru akan dikirim ke inbox."
                  : "Enter your account email. A link to create a new password will be sent to your inbox."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-1.5 block">{t("email")}</Label>
              <Input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                className="h-11 rounded-xl border-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={sendingReset}>
                {sendingReset && <Loader2 className="mr-2 size-4 animate-spin" />}
                {lang === "id" ? "Kirim tautan" : "Send link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  return (
    <div>
      <Label className="mb-1.5 block">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden> *</span>}
      </Label>
      <div className="relative">
        <Input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          aria-required={required}
          className={`h-11 rounded-xl border-2 bg-card ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
