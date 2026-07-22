import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Share, Plus, Home, X } from "lucide-react";

const DISMISS_KEY = "pelajaranku:ios-a2hs-dismissed";
const REMIND_KEY = "pelajaranku:ios-a2hs-remind-at";
const HINT_HIDDEN_KEY = "pelajaranku:ios-hint-hidden";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function isSafariOnIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
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
  const [eligible, setEligible] = useState(false);
  const [safari, setSafari] = useState(true);
  const [hintHidden, setHintHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIOS() || isStandalone()) return;
    setEligible(true);
    setSafari(isSafariOnIOS());
    setHintHidden(window.localStorage.getItem(HINT_HIDDEN_KEY) === "1");

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    const remindAt = Number(window.localStorage.getItem(REMIND_KEY) || 0);
    const shouldAuto = !dismissed && Date.now() >= remindAt;

    if (shouldAuto) {
      const t = setTimeout(() => setOpen(true), 3500);
      return () => {
        clearTimeout(t);
      };
    }
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("pelajaranku:show-ios-install", handler);
    return () => window.removeEventListener("pelajaranku:show-ios-install", handler);
  }, []);

  const dismissForever = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const remindLater = () => {
    try {
      window.localStorage.setItem(REMIND_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    } catch {}
    setOpen(false);
  };

  const hideHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      window.localStorage.setItem(HINT_HIDDEN_KEY, "1");
    } catch {}
    setHintHidden(true);
  };

  if (!eligible) return null;

  return (
    <>
      {!hintHidden && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-16 right-3 z-40 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur hover:bg-accent"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
          aria-label="Panduan pasang di iPhone"
        >
          <Home className="h-3.5 w-3.5 text-primary" />
          Pasang di iPhone
          <span
            role="button"
            tabIndex={0}
            onClick={hideHint}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
            aria-label="Sembunyikan"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      )}

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

          {safari ? (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">1</span>
                <span className="flex-1">
                  Ketuk tombol <b>Bagikan</b>{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" /> di bilah bawah Safari
                  (ikon kotak dengan panah ke atas).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">2</span>
                <span className="flex-1">
                  Gulir ke bawah lalu pilih{" "}
                  <b>Tambahkan ke Layar Utama</b>{" "}
                  <Plus className="inline h-4 w-4 align-text-bottom" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">3</span>
                <span className="flex-1">
                  Ketuk <b>Tambah</b> di pojok kanan atas. Ikon <b>Pelajaranku</b> akan muncul di Layar Utama.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">4</span>
                <span className="flex-1">
                  Buka Pelajaranku dari ikon tersebut — kini tampil layar penuh dan siap
                  dipakai walau tanpa internet.
                </span>
              </li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                Di iPhone/iPad, fitur <b>Tambahkan ke Layar Utama</b> hanya tersedia lewat{" "}
                <b>Safari</b>. Silakan buka Pelajaranku di Safari terlebih dahulu.
              </p>
              <ol className="space-y-2 pl-1">
                <li>1. Salin alamat halaman ini.</li>
                <li>2. Buka aplikasi <b>Safari</b> di iPhone Anda.</li>
                <li>3. Tempel alamat lalu buka halaman.</li>
                <li>4. Ketuk <b>Bagikan</b> → <b>Tambahkan ke Layar Utama</b>.</li>
              </ol>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Tips: setelah terpasang, buka dari ikon Layar Utama. Aplikasi berjalan penuh tanpa bilah alamat
            dan data pembelajaran tetap bisa diakses meski sinyal lemah.
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
