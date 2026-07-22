import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailCheck, XCircle, LogIn, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { redeemTeacherInvite } from "@/lib/invites.functions";

const search = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/undangan")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Aktivasi Undangan Guru · Pelajaranku" },
      { name: "description", content: "Aktifkan akun guru Anda dengan kode undangan dari admin — tanpa perlu memahami istilah teknis." },
      { property: "og:title", content: "Aktivasi Undangan Guru · Pelajaranku" },
      { property: "og:description", content: "Masukkan kode undangan Anda dan mulai mengajar di Pelajaranku." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InviteActivation,
});

type Status = "idle" | "working" | "ok" | "fail";

function InviteActivation() {
  const { code: initialCode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading, refresh } = useAuth();
  const redeem = useServerFn(redeemTeacherInvite);
  const [code, setCode] = useState((initialCode ?? "").toUpperCase());
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const activate = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setStatus("fail");
      setMessage("Masukkan kode undangan terlebih dahulu.");
      return;
    }
    setStatus("working");
    setMessage("");
    try {
      await redeem({ data: { code: trimmed } });
      await refresh();
      setStatus("ok");
      setMessage("Selamat! Akun guru Anda sudah aktif.");
      toast.success("Akun guru aktif");
      setTimeout(() => navigate({ to: "/loading" }), 1200);
    } catch (e: any) {
      setStatus("fail");
      setMessage(e?.message ?? "Gagal mengaktifkan undangan.");
    }
  };

  // Auto-redeem if user arrives already signed in with ?code=...
  useEffect(() => {
    if (loading) return;
    if (!session) return;
    if (!initialCode) return;
    if (status !== "idle") return;
    activate(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, initialCode]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-sunset">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    // Remember the invite so we can auto-return after sign-in.
    if (typeof window !== "undefined" && initialCode) {
      try { window.localStorage.setItem("pending_teacher_invite", initialCode); } catch { /* ignore */ }
    }
    return (
      <div className="min-h-screen bg-gradient-sunset px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-magic">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
            <MailCheck className="size-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-bold">Undangan Guru</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Masuk atau daftar dulu dengan email Anda. Setelah berhasil masuk,
            akun Anda akan otomatis diaktifkan sebagai guru.
          </p>
          {initialCode && (
            <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-center text-sm">
              Kode Anda: <code className="font-mono font-semibold text-primary">{initialCode}</code>
            </div>
          )}
          <div className="mt-5 grid gap-2">
            <Button asChild className="w-full">
              <Link to="/auth" search={{ mode: "signup", role: "siswa" }}>
                <MailCheck className="size-4" /> Daftar akun baru
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth" search={{ mode: "login", role: "siswa" }}>
                <LogIn className="size-4" /> Sudah punya akun — masuk
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sunset px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-magic">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
          <KeyRound className="size-6 text-primary-foreground" />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">Aktivasi Akun Guru</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Masukkan kode undangan sekali pakai yang Anda terima dari admin sekolah.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <Label className="mb-1.5 block">Kode undangan</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
              className="h-12 rounded-xl border-2 text-center font-mono text-base tracking-widest"
            />
          </div>
          <Button
            onClick={() => activate(code)}
            disabled={status === "working" || status === "ok"}
            className="w-full">
            {status === "working" && <Loader2 className="size-4 animate-spin" />}
            {status === "ok" ? "Berhasil" : "Aktifkan sekarang"}
          </Button>

          {status === "ok" && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{message} Mengarahkan ke dashboard guru…</span>
            </div>
          )}
          {status === "fail" && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Tidak punya kode? Hubungi admin sekolah Anda untuk mendapatkan undangan.
        </p>
      </motion.div>
    </div>
  );
}
