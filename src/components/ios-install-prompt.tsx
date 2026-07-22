import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Share, Plus, Home, X } from "lucide-react";

const DISMISS_KEY = "pelajaranku:ios-a2hs-dismissed";
const REMIND_KEY = "pelajaranku:ios-a2hs-remind-at";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // iPadOS 13+ reports as Mac
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Safari yes, but not Chrome/Firefox/Edge on iOS (they show different share menus)
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function IosInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [browserOnIOS, setBrowserOnIOS] = useState<"safari" | "other" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIOS()) return;
    if (isStandalone()) return;

    setBrowserOnIOS(isSafari() ? "safari" : "other");

    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    const remindAt = window.localStorage.getItem(REMIND_KEY);
    if (dismissed === "1") return;
    if (remindAt && Date.now() < Number(remindAt)) return;

    // Small delay so it doesn't fight with initial render / onboarding
    const t = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(t);
  }, []);

  const dismissForever = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const remindLater = () => {
    try {
      // 3 days
      window.localStorage.setItem(REMIND_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    } catch {}
    setOpen(false);
  };

  if (!browserOnIOS) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && remindLater()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Pasang Pelajaranku di iPhone
            </DialogTitle>
            <DialogDescription>
              Tambahkan ke Layar Utama supaya bisa dibuka seperti aplikasi asli — full screen,
              cepat, dan tetap jalan saat internet lemot atau offline.
            </DialogDescription>
          </DialogHeader>

          {browserOnIOS === "safari" ? (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">1</span>
                <span className="flex-1">
                  Ketuk tombol <b>Bagikan</b>{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" /> di bilah bawah Safari.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">2</span>
                <span className="flex-1">
                  Gulir ke bawah, pilih{" "}
                  <b>Tambahkan ke Layar Utama</b>{" "}
                  <Plus className="inline h-4 w-4 align-text-bottom" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">3</span>
                <span className="flex-1">
                  Ketuk <b>Tambah</b> di pojok kanan atas. Ikon Pelajaranku akan muncul di Layar Utama.
                </span>
              </li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                Di iPhone/iPad, fitur <b>Tambahkan ke Layar Utama</b> hanya bekerja lewat{" "}
                <b>Safari</b>. Silakan buka Pelajaranku di Safari terlebih dahulu.
              </p>
              <ol className="space-y-2">
                <li>1. Salin alamat halaman ini.</li>
                <li>2. Buka aplikasi <b>Safari</b> di iPhone Anda.</li>
                <li>3. Tempel alamat dan buka.</li>
                <li>4. Ketuk tombol <b>Bagikan</b> → <b>Tambahkan ke Layar Utama</b>.</li>
              </ol>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Setelah terpasang, buka Pelajaranku dari ikon di Layar Utama — tampil layar penuh
            tanpa bilah alamat, dan bisa dipakai walau sinyal hilang.
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="sm" onClick={dismissForever}>
              Jangan tampilkan lagi
            </Button>
            <Button size="sm" onClick={remindLater}>
              Nanti saja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Small footer/inline hint that stays visible for iOS users who haven't installed yet. */
export function IosInstallHint() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIOS() || isStandalone()) return;
    if (window.localStorage.getItem("pelajaranku:ios-hint-dismissed") === "1") return;
    setShow(true);
  }, []);

  if (!show || dismissed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.localStorage.removeItem(DISMISS_KEY);
          window.localStorage.removeItem(REMIND_KEY);
        } catch {}
        // trigger prompt by reloading state — simplest: dispatch event
        window.dispatchEvent(new CustomEvent("pelajaranku:show-ios-install"));
      }}
      className="fixed bottom-16 right-3 z-40 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur hover:bg-accent"
      aria-label="Panduan pasang di iPhone"
    >
      <Home className="h-3.5 w-3.5 text-primary" />
      Pasang di iPhone
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          try {
            window.localStorage.setItem("pelajaranku:ios-hint-dismissed", "1");
          } catch {}
          setDismissed(true);
        }}
        className="ml-1 rounded-full p-0.5 hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}
