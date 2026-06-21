import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
  role: z.enum(["guru", "siswa"]).optional().default("siswa"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Masuk · EduQuest RPG" },
      { name: "description", content: "Masuk atau daftar sebagai guru atau siswa untuk memulai petualangan belajar." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, lang } = useLang();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [role, setRole] = useState<AppRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/loading" });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/loading`,
            data: {
              full_name: fullName,
              role,
              class_name: role === "siswa" ? className : null,
              school_id_number: schoolId,
              subject: role === "guru" ? subject : null,
            },
          },
        });
        if (error) throw error;
        toast.success(lang === "id" ? "Akun dibuat! Mengarahkan…" : "Account created! Redirecting…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(lang === "id" ? "Selamat datang, petualang!" : "Welcome back, adventurer!");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const seedDemo = async () => {
    setSeeding(true);
    let created = 0;
    for (const acc of DEMO_ACCOUNTS) {
      const { error } = await supabase.auth.signUp({
        email: acc.email,
        password: acc.password,
        options: {
          emailRedirectTo: `${window.location.origin}/loading`,
          data: {
            full_name: acc.full_name,
            role: acc.role,
            class_name: "class_name" in acc ? acc.class_name : null,
            school_id_number: acc.school_id_number,
            subject: "subject" in acc ? acc.subject : null,
          },
        },
      });
      if (!error) created++;
    }
    // Sign back out in case the seeding logged us in as the last account
    await supabase.auth.signOut();
    toast.success(
      lang === "id"
        ? `Selesai! ${created} akun baru ditambahkan (yang sudah ada dilewati).`
        : `Done! ${created} new accounts added (existing ones skipped).`
    );
    setSeeding(false);
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
              <Wand2 className="size-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">EduQuest <span className="text-gradient-magic">RPG</span></span>
          </div>
          <h1 className="mt-8 font-display text-5xl font-bold leading-tight">
            <span className="text-gradient-hero">{mode === "login" ? t("enterGuild") : t("startQuest")}</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            {lang === "id"
              ? "Pilih peranmu, masuk ke gerbang akademi sihir, dan mulai babak baru petualangan belajarmu."
              : "Choose your role, step through the academy gates, and start a new chapter of your learning adventure."}
          </p>

          <div className="mt-8 rounded-2xl border-2 border-dashed border-accent/40 bg-card p-5 shadow-card-rpg">
            <div className="flex items-center justify-between">
              <div className="font-display font-semibold">{t("demoCreds")}</div>
              <Button size="sm" variant="quest" onClick={seedDemo} disabled={seeding}>
                {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {t("seedDemo")}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.email} className="rounded-xl bg-muted p-3 font-mono text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase ${
                      a.role === "guru" ? "bg-guru text-white" : "bg-siswa text-white"
                    }`}>{a.role}</span>
                    <span className="font-semibold">{a.full_name}</span>
                  </div>
                  <div>📧 {a.email}</div>
                  <div>🔑 {a.password}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="rounded-3xl border-2 border-border bg-card p-6 shadow-magic sm:p-8"
        >
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
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{r === "guru" ? "☪︎ Ustadz/ah" : "✦ Santri"}</div>
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

          {/* Mobile-only seed */}
          <div className="mt-6 block border-t-2 border-dashed border-border pt-4 md:hidden">
            <Button variant="outline" size="sm" onClick={seedDemo} disabled={seeding} className="w-full">
              {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {t("seedDemo")}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-11 rounded-xl border-2 bg-card"
      />
    </div>
  );
}
