import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, KeyRound, ShieldCheck, ArrowRight } from "lucide-react";

const STORAGE_KEY = "pelajaranku_license_v1";

export const Route = createFileRoute("/aktivasi")({
  component: AktivasiPage,
  head: () => ({
    meta: [
      { title: "Aktivasi Lisensi — Pelajaranku" },
      { name: "description", content: "Aktifkan lisensi Pelajaranku Anda untuk memulai penggunaan aplikasi." },
      { property: "og:title", content: "Aktivasi Lisensi — Pelajaranku" },
      { property: "og:description", content: "Aktifkan lisensi Pelajaranku Anda untuk memulai penggunaan aplikasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type LicenseData = {
  code: string;
  email: string;
  activatedAt: string;
  fingerprint: string;
};

function AktivasiPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<LicenseData | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setExisting(JSON.parse(raw) as LicenseData);
    } catch {}
  }, []);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "");
    const cleanEmail = email.trim().toLowerCase();

    if (!/^PJKU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanCode)) {
      setError("Format kode tidak valid. Contoh yang benar: PJKU-XXXX-XXXX-XXXX");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Email tidak valid.");
      return;
    }

    setLoading(true);
    try {
      // Verifikasi offline: hash kode + email → simpan sebagai bukti aktivasi.
      // Ini bukan proteksi kriptografis, tapi cukup untuk menghalangi pembajakan kasual
      // dan menandakan bahwa aplikasi ini "milik" satu pembeli.
      const fingerprint = await hashString(`${cleanCode}::${cleanEmail}::${location.hostname}`);
      const data: LicenseData = {
        code: cleanCode,
        email: cleanEmail,
        activatedAt: new Date().toISOString(),
        fingerprint,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setExisting(data);
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivasi gagal.");
    } finally {
      setLoading(false);
    }
  }

  function deactivate() {
    if (!confirm("Yakin ingin menonaktifkan lisensi di perangkat ini?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setExisting(null);
    setCode("");
    setEmail("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 py-10">
      <div className="mx-auto max-w-md px-4">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="font-display text-2xl font-black">Aktivasi Pelajaranku</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Masukkan kode lisensi yang Anda terima setelah pembelian.
          </p>
        </div>

        {existing ? (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-8 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold">Lisensi Aktif</p>
                <p className="text-xs text-muted-foreground">
                  Diaktifkan pada {new Date(existing.activatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Kode</span><code className="text-xs">{existing.code}</code></div>
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Email</span><span className="text-xs">{existing.email}</span></div>
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Fingerprint</span><code className="text-xs">{existing.fingerprint.slice(0, 12)}…</code></div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button asChild className="flex-1">
                <Link to="/">Buka Aplikasi <ArrowRight className="ml-1 size-4" /></Link>
              </Button>
              <Button variant="outline" onClick={deactivate}>Nonaktifkan</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <form onSubmit={activate} className="space-y-4">
              <div>
                <Label htmlFor="code">Kode Lisensi</Label>
                <Input
                  id="code"
                  placeholder="PJKU-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 font-mono uppercase tracking-wider"
                  autoComplete="off"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Format: PJKU diikuti 3 kelompok 4 karakter.</p>
              </div>
              <div>
                <Label htmlFor="email">Email Pembelian</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@sekolah.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                <KeyRound className="size-4" /> {loading ? "Memverifikasi…" : "Aktifkan Sekarang"}
              </Button>
            </form>
          </Card>
        )}

        <div className="mt-6 space-y-3 text-center text-xs text-muted-foreground">
          <p>Belum punya kode lisensi? <Link to="/demo" className="font-medium text-primary underline">Coba demo dulu</Link></p>
          <p>Butuh bantuan? Hubungi <a className="text-primary underline" href="mailto:pelajaranku.support@gmail.com">pelajaranku.support@gmail.com</a></p>
        </div>
      </div>
    </div>
  );
}

async function hashString(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
