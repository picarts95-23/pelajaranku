import { useEffect, useState } from "react";
import { WifiOff, Wifi, CheckCircle2, Download, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "pelajaranku:onboarding-offline-seen-v1";

/**
 * Onboarding dialog + persistent "siap offline" badge.
 * - Menjelaskan cara kerja mode offline (Service Worker + cache).
 * - Menampilkan status apakah aplikasi sudah siap dipakai tanpa internet.
 * - Muncul otomatis pada kunjungan pertama; setelah itu diakses via badge di pojok.
 */
export function OfflineOnboarding() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState<"unknown" | "ready" | "unavailable">("unknown");
  // Always start as "online" so SSR and the first client render agree; the real
  // value is read after mount (see effect below) to avoid hydration mismatches.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;

    // Show onboarding on first visit only
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        // Delay slightly so it doesn't fight with auth redirects
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore storage errors (private mode) */
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      setReady("unavailable");
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (cancelled) return;
        setReady(reg?.active ? "ready" : "unknown");
      } catch {
        if (!cancelled) setReady("unavailable");
      }
    };
    void check();
    const interval = setInterval(check, 4000);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <>
      {/* Floating status badge — bottom-left, non-obstructive. Client-only so the
          service-worker/online state never differs between server and client HTML. */}
      {mounted && (
      <button

        type="button"
        onClick={() => setOpen(true)}
        aria-label="Info mode offline"
        className={cn(
          "fixed bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur transition-all",
          "sm:bottom-4 sm:left-4 sm:px-3 sm:text-xs",
          ready === "ready" && online && "border-emerald-400/60 bg-emerald-50/95 text-emerald-800",
          ready === "ready" && !online && "border-amber-400/60 bg-amber-50/95 text-amber-800",
          ready !== "ready" && online && "border-slate-300/70 bg-white/90 text-slate-700",
          ready !== "ready" && !online && "border-red-400/60 bg-red-50/95 text-red-800",
        )}
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        {ready === "ready" ? (
          online ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden />
              <span>Siap offline</span>
            </>
          ) : (
            <>
              <WifiOff className="size-3.5" aria-hidden />
              <span>Mode offline aktif</span>
            </>
          )
        ) : online ? (
          <>
            <Wifi className="size-3.5" aria-hidden />
            <span>Menyiapkan offline…</span>
          </>
        ) : (
          <>
            <WifiOff className="size-3.5" aria-hidden />
            <span>Tanpa koneksi</span>
          </>
        )}
      </button>
      )}


      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Smartphone className="size-5 text-primary" />
              Cara Kerja Offline
            </DialogTitle>
            <DialogDescription>
              Pelajaranku bisa dibuka tanpa internet setelah kamu memakainya sekali saat online.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <StepRow
              n={1}
              title="Buka aplikasi sekali saat online"
              body="Aplikasi akan otomatis menyimpan halaman, gambar, dan panduan ke perangkatmu."
            />
            <StepRow
              n={2}
              title="Tunggu badge 'Siap offline'"
              body="Setelah muncul lencana hijau di pojok kiri bawah, aplikasi sudah siap dibuka tanpa sinyal."
            />
            <StepRow
              n={3}
              title="Buka kapan saja tanpa internet"
              body="Halaman utama, panduan, dan tugas yang sudah pernah dibuka tetap dapat diakses. Pengiriman tugas baru menunggu koneksi."
            />
            <StepRow
              n={4}
              title="Pasang di layar utama (opsional)"
              body="Di Chrome/Safari pilih 'Tambahkan ke Layar Utama' agar terasa seperti aplikasi asli."
            />

            <div
              className={cn(
                "mt-4 flex items-start gap-2 rounded-lg border p-3",
                ready === "ready"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-700",
              )}
            >
              {ready === "ready" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              ) : (
                <Download className="mt-0.5 size-5 shrink-0 text-slate-500" />
              )}
              <div className="text-xs sm:text-sm">
                <div className="font-semibold">
                  {ready === "ready"
                    ? "Aplikasi ini sudah siap digunakan tanpa internet."
                    : ready === "unavailable"
                      ? "Mode offline belum tersedia di browser ini."
                      : "Sedang menyiapkan mode offline…"}
                </div>
                <div className="mt-0.5 opacity-90">
                  {ready === "ready"
                    ? "Kamu bisa menutup dan membuka kembali aplikasi meski tidak ada sinyal."
                    : ready === "unavailable"
                      ? "Coba gunakan Chrome/Safari terbaru, atau buka melalui domain aplikasi yang sudah dipublikasikan."
                      : "Biarkan halaman ini terbuka beberapa detik hingga selesai."}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={dismiss} className="w-full sm:w-auto">
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
