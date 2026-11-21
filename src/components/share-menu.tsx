import { useState } from "react";
import { Share2, Copy as CopyIcon, MessageCircle, Send, Mail, Facebook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/i18n";

export type ShareMenuProps = {
  /** Pre-formatted message body shared to WhatsApp / Telegram / etc. */
  message: string;
  /** Optional short title (used for e-mail subject & native share). */
  subject?: string;
  /** Optional link appended to the message (e.g. quiz link). */
  url?: string;
  label?: string;
};

export function ShareMenu({ message, subject, url, label }: ShareMenuProps) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(message);

  // Keep the editable text in sync when the source assignment changes.
  const [seed, setSeed] = useState(message);
  if (seed !== message) {
    setSeed(message);
    setText(message);
  }

  const full = url ? `${text}\n${url}` : text;
  const enc = encodeURIComponent(full);
  const title = subject ?? (lang === "id" ? "Info Tugas" : "Assignment Info");

  const targets = [
    { key: "wa", label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${enc}`, cls: "text-emerald-600" },
    { key: "tg", label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${encodeURIComponent(url ?? "")}&text=${enc}`, cls: "text-sky-600" },
    { key: "fb", label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url ?? (typeof window !== "undefined" ? window.location.origin : ""))}&quote=${enc}`, cls: "text-blue-600" },
    { key: "mail", label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${enc}`, cls: "text-amber-600" },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      toast.success(lang === "id" ? "Teks tugas disalin" : "Text copied");
    } catch {
      toast.error(lang === "id" ? "Gagal menyalin" : "Copy failed");
    }
  };

  const nativeShare = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (!nav.share) {
      void copy();
      return;
    }
    try {
      await nav.share({ title, text: full });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title={lang === "id" ? "Bagikan info tugas" : "Share assignment"}>
          <Share2 className="size-4 text-guru" />
          {label && <span className="ml-1 text-xs">{label}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === "id" ? "Bagikan Info Tugas" : "Share Assignment Info"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {lang === "id"
              ? "Teks bisa diedit dulu sebelum dibagikan ke grup WhatsApp, Telegram, atau media lain."
              : "Edit the text before sharing to WhatsApp, Telegram, or other apps."}
          </p>
          <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} className="text-sm" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {targets.map((tg) => (
              <a key={tg.key} href={tg.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <tg.icon className={`size-4 ${tg.cls}`} />
                  <span className="text-xs">{tg.label}</span>
                </Button>
              </a>
            ))}
            <Button variant="outline" className="justify-start gap-2" onClick={copy}>
              <CopyIcon className="size-4 text-muted-foreground" />
              <span className="text-xs">{lang === "id" ? "Salin" : "Copy"}</span>
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={nativeShare}>
              <Share2 className="size-4 text-guru" />
              <span className="text-xs">{lang === "id" ? "Bagikan…" : "Share…"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
