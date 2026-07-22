import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Mail, ShieldCheck, Users, KeyRound, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const KEY = "pelajaranku-admin-onboarding-v1";

/**
 * First-time onboarding for a fresh admin login: explains — in plain Indonesian —
 * how admin was assigned (fixed email), how to open /admin, and how teacher/student
 * accounts are created without any technical jargon.
 */
export function AdminOnboarding({ email }: { email: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  const close = (permanent = true) => {
    if (permanent && typeof window !== "undefined") localStorage.setItem(KEY, "1");
    setOpen(false);
    setStep(0);
  };

  const steps = [
    {
      icon: <Sparkles className="size-6" />,
      title: "Selamat datang, Admin!",
      body: (
        <>
          <p>
            Anda masuk sebagai <b>admin utama</b> aplikasi Pelajaranku. Peran ini otomatis diberikan
            kepada email yang ditetapkan pemilik aplikasi — <b>tidak ada pendaftaran admin lewat form</b>.
          </p>
          <p className="mt-2 rounded-xl bg-muted p-3 text-xs">
            Email admin Anda: <code className="font-semibold text-foreground">{email ?? "(belum diketahui)"}</code>
          </p>
        </>
      ),
    },
    {
      icon: <Mail className="size-6" />,
      title: "Dari mana peran admin berasal?",
      body: (
        <p>
          Pemilik aplikasi menyimpan satu email khusus (<code>ADMIN_EMAIL</code>) di pengaturan server.
          Saat email itu login untuk pertama kali, sistem otomatis menaikkannya menjadi admin.
          Untuk mengganti admin, cukup ubah email di pengaturan server dan login lagi.
        </p>
      ),
    },
    {
      icon: <ShieldCheck className="size-6" />,
      title: "Cara masuk ke Panel Admin",
      body: (
        <>
          <p>Selama Anda login dengan email admin, buka <code>/admin</code> untuk mengelola pengguna.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Arsipkan pengguna untuk menyembunyikannya tanpa menghapus data.</li>
            <li>Hapus permanen jika ingin membuang akun & seluruh datanya.</li>
            <li>Ganti password pengguna jika ada yang lupa (password lama tidak dapat dilihat).</li>
          </ul>
        </>
      ),
    },
    {
      icon: <Users className="size-6" />,
      title: "Membuat akun Guru & Siswi",
      body: (
        <>
          <p>Akun dibuat oleh masing-masing orang lewat halaman <b>Daftar</b> — Anda tidak perlu membuatkannya satu per satu.</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
              <div className="font-display font-semibold">📚 Siswi</div>
              <p className="mt-1 text-muted-foreground">Cukup daftar dengan email & password. Otomatis menjadi siswi.</p>
            </div>
            <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
              <div className="font-display font-semibold">☪︎ Guru</div>
              <p className="mt-1 text-muted-foreground">
                Daftar dengan email, password, <b>dan Kode Akses Guru</b>. Bagikan kode ini
                hanya ke guru tepercaya — tanpa kode, akun akan tetap sebagai siswi.
              </p>
            </div>
          </div>
        </>
      ),
    },
    {
      icon: <KeyRound className="size-6" />,
      title: "Ringkasan alur",
      body: (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Bagikan link aplikasi ke calon guru & siswi.</li>
          <li>Siswi daftar → langsung bisa pakai.</li>
          <li>Guru daftar → masukkan Kode Akses Guru → siap mengajar.</li>
          <li>Anda (admin) memantau & merapikan lewat <code>/admin</code>.</li>
        </ol>
      ),
    },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  return (
    <>
      {/* Floating re-open button */}
      <Button variant="outline" size="sm" onClick={() => { setStep(0); setOpen(true); }}
        className="fixed bottom-4 right-4 z-30 shadow-magic">
        <Rocket className="size-4" /> Panduan Admin
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-magic text-primary-foreground shadow-magic">
                {cur.icon}
              </div>
              <div className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                Langkah {step + 1} dari {steps.length}
              </div>
            </div>
            <DialogTitle className="font-display text-xl">{cur.title}</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2 space-y-2 text-sm text-foreground/80">{cur.body}</div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => close(true)}>Tutup panduan</Button>
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Kembali</Button>}
              {!last ? (
                <Button onClick={() => setStep((s) => s + 1)}>Lanjut <ArrowRight className="size-4" /></Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { close(true); navigate({ to: "/setup" }); }}>
                    Buka Wizard Setup
                  </Button>
                  <Button onClick={() => close(true)}>Mengerti</Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
