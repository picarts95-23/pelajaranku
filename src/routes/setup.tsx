import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2, Copy, Database,
  KeyRound, ShieldCheck, ExternalLink, Eye, EyeOff, Rocket, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Wizard Setup Supabase · Pelajaranku" },
      { name: "description", content: "Panduan 4 langkah menghubungkan Pelajaranku ke database Supabase Anda sendiri, lengkap dengan uji koneksi otomatis." },
      { property: "og:title", content: "Wizard Setup Supabase · Pelajaranku" },
      { property: "og:description", content: "Wizard interaktif untuk pemilik aplikasi: tempel URL & key, uji koneksi, dapatkan file .env siap pakai." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupWizard,
});

type Status = "idle" | "testing" | "ok" | "fail";
interface TestResult { status: Status; message?: string }

function SetupWizard() {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [showService, setShowService] = useState(false);
  const [anonTest, setAnonTest] = useState<TestResult>({ status: "idle" });
  const [serviceTest, setServiceTest] = useState<TestResult>({ status: "idle" });

  const cleanUrl = url.trim().replace(/\/$/, "");
  const projectRef = cleanUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";

  const testAnon = async () => {
    if (!cleanUrl || !anonKey.trim()) {
      setAnonTest({ status: "fail", message: "URL dan anon key wajib diisi." });
      return;
    }
    setAnonTest({ status: "testing" });
    try {
      const r = await fetch(`${cleanUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey.trim() },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} — periksa URL & anon key.`);
      const j = await r.json();
      setAnonTest({
        status: "ok",
        message: `Terhubung! Auth aktif${j?.external?.email ? " · email login diizinkan" : ""}.`,
      });
    } catch (e: any) {
      setAnonTest({ status: "fail", message: e?.message ?? "Gagal menghubungi Supabase." });
    }
  };

  const testService = async () => {
    if (!cleanUrl || !serviceKey.trim()) {
      setServiceTest({ status: "fail", message: "URL dan service key wajib diisi." });
      return;
    }
    setServiceTest({ status: "testing" });
    try {
      // Service role can list auth users — a good privilege probe.
      const r = await fetch(`${cleanUrl}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: {
          apikey: serviceKey.trim(),
          Authorization: `Bearer ${serviceKey.trim()}`,
        },
      });
      if (r.status === 401 || r.status === 403) {
        throw new Error("Ditolak (401/403) — key ini bukan service_role.");
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} — periksa service key.`);
      setServiceTest({ status: "ok", message: "Service role terverifikasi (akses admin OK)." });
    } catch (e: any) {
      setServiceTest({ status: "fail", message: e?.message ?? "Gagal memverifikasi service key." });
    }
  };

  const envBlock = `# === Pelajaranku · .env (hasil wizard setup) ===
VITE_SUPABASE_URL="${cleanUrl}"
VITE_SUPABASE_PUBLISHABLE_KEY="${anonKey.trim()}"
VITE_SUPABASE_PROJECT_ID="${projectRef}"

SUPABASE_URL="${cleanUrl}"
SUPABASE_PUBLISHABLE_KEY="${anonKey.trim()}"
SUPABASE_SERVICE_ROLE_KEY="${serviceKey.trim()}"
SUPABASE_PROJECT_ID="${projectRef}"

ADMIN_EMAIL="${adminEmail.trim()}"
TEACHER_ACCESS_CODE="${teacherCode.trim()}"
`;

  const copyEnv = async () => {
    await navigator.clipboard.writeText(envBlock);
    toast.success(".env disalin ke clipboard");
  };

  const canNext1 = anonTest.status === "ok";
  const canNext2 = serviceTest.status === "ok";
  const canNext3 = adminEmail.trim().includes("@") && teacherCode.trim().length >= 6;

  return (
    <div className="min-h-screen bg-gradient-sunset px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Beranda
          </Link>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Buka Supabase <ExternalLink className="size-3.5" />
          </a>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-border bg-card p-6 shadow-magic sm:p-8">
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
              <Rocket className="size-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">Wizard Setup Supabase</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Panduan 4 langkah untuk menghubungkan Pelajaranku ke database Supabase milik Anda sendiri.
                Semua uji koneksi berjalan langsung dari browser — tidak ada data yang dikirim ke server kami.
              </p>
            </div>
          </div>

          {/* Stepper */}
          <ol className="mt-6 grid grid-cols-4 gap-2 text-xs">
            {["URL & Anon", "Service Key", "Admin & Guru", "Selesai"].map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <li key={label} className={`rounded-xl border-2 px-2 py-2 text-center font-display font-semibold transition ${
                  done ? "border-primary bg-primary/10 text-primary"
                    : active ? "border-foreground bg-background"
                    : "border-border bg-muted text-muted-foreground"
                }`}>
                  <div className="text-[10px] uppercase tracking-wider">Langkah {n}</div>
                  <div className="mt-0.5 truncate">{label}</div>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 space-y-4">
            {step === 1 && (
              <section className="space-y-4">
                <StepIntro icon={<Database className="size-5" />} title="Tempel URL project & anon key"
                  hint="Buka Supabase → Project Settings → Data API. Salin 'Project URL' dan 'Project API Keys → anon public'." />
                <div>
                  <Label className="mb-1.5 block">Project URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xxxxxx.supabase.co" className="h-11 rounded-xl border-2 font-mono text-sm" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Anon / Publishable Key</Label>
                  <Textarea value={anonKey} onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOi… (JWT panjang)" rows={3}
                    className="rounded-xl border-2 font-mono text-xs" />
                </div>
                <TestButton onClick={testAnon} result={anonTest} label="Uji koneksi anon" />
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <StepIntro icon={<KeyRound className="size-5" />} title="Tempel service_role key"
                  hint="Di halaman Data API yang sama, salin 'service_role secret'. Key ini punya akses penuh — JANGAN pernah tampilkan di kode client." />
                <div>
                  <Label className="mb-1.5 block">Service Role Key</Label>
                  <div className="relative">
                    <Textarea value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}
                      placeholder="eyJhbGciOi… (JWT panjang, awalan berbeda dari anon)"
                      rows={3}
                      className={`rounded-xl border-2 font-mono text-xs ${showService ? "" : "[-webkit-text-security:disc] [text-security:disc]"}`} />
                    <button type="button" onClick={() => setShowService((v) => !v)}
                      className="absolute right-2 top-2 rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground">
                      {showService ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <TestButton onClick={testService} result={serviceTest} label="Uji service key" />
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <StepIntro icon={<ShieldCheck className="size-5" />} title="Tetapkan admin & kode guru"
                  hint="Email admin dipromosikan otomatis saat login pertama. Kode guru adalah 'kata sandi' yang Anda bagikan ke calon guru saat mendaftar." />
                <div>
                  <Label className="mb-1.5 block">Email Admin (akan menjadi admin utama)</Label>
                  <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@sekolah-anda.sch.id" className="h-11 rounded-xl border-2" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Kode Akses Guru (min. 6 karakter)</Label>
                  <Input value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)}
                    placeholder="misal: GuruSMPN12-2026" className="h-11 rounded-xl border-2 font-mono" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bagikan kode ini hanya ke guru tepercaya. Bisa diganti kapan saja lewat panel Admin.
                  </p>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4">
                <StepIntro icon={<ClipboardCheck className="size-5" />} title="Selesai! Salin .env di bawah"
                  hint="Buat file bernama .env di root project, tempel isi di bawah, lalu deploy. Login pertama pakai email admin di atas — akun otomatis jadi admin." />
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-sm">
                  <div className="flex items-center gap-2 font-display font-semibold text-primary">
                    <CheckCircle2 className="size-4" /> Ringkasan koneksi
                  </div>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>• Project ref: <code className="text-foreground">{projectRef || "—"}</code></li>
                    <li>• Anon key: {anonTest.status === "ok" ? "✅ terverifikasi" : "belum diuji"}</li>
                    <li>• Service key: {serviceTest.status === "ok" ? "✅ terverifikasi" : "belum diuji"}</li>
                    <li>• Admin email: <code className="text-foreground">{adminEmail || "—"}</code></li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>File .env siap pakai</Label>
                    <Button size="sm" variant="outline" onClick={copyEnv}>
                      <Copy className="size-4" /> Salin
                    </Button>
                  </div>
                  <Textarea readOnly value={envBlock} rows={13}
                    className="rounded-xl border-2 bg-muted/50 font-mono text-xs" />
                </div>
                <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4 text-sm">
                  <div className="font-display font-semibold">Langkah berikutnya:</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Login ke <code>/admin</code> di aplikasi Anda, unduh skema (.sql), tempel ke Supabase SQL Editor → Run.</li>
                    <li>Simpan .env di root project, deploy ulang.</li>
                    <li>Daftar dengan email admin di atas → otomatis jadi admin. Panduan lengkap: <code>docs/self-hosting.md</code>.</li>
                  </ol>
                </div>
              </section>
            )}
          </div>

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" /> Kembali
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}>
                Lanjut <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={copyEnv}><Copy className="size-4" /> Salin .env</Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StepIntro({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-border bg-background p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-magic text-primary-foreground">{icon}</div>
      <div>
        <div className="font-display font-semibold">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function TestButton({ onClick, result, label }: { onClick: () => void; result: TestResult; label: string }) {
  return (
    <div>
      <Button onClick={onClick} disabled={result.status === "testing"} variant="secondary" className="w-full sm:w-auto">
        {result.status === "testing" && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {result.status !== "idle" && result.status !== "testing" && (
        <div className={`mt-2 flex items-start gap-2 rounded-xl border-2 p-3 text-sm ${
          result.status === "ok"
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}>
          {result.status === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
