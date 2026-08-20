import { useEffect, useState, type ReactNode } from "react";
import { ClipboardCopy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ParsePreview<T> = { data: T[]; warnings: string[]; lines: string[] };

/**
 * Generic "paste from AI" importer: teacher pastes output from Gemini/ChatGPT,
 * sees a parsed preview, then applies it as an editable draft.
 */
export function AiPasteDialog<T>({
  open,
  onOpenChange,
  title,
  promptTemplate,
  parse,
  onApply,
  applyLabel,
  extra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  promptTemplate: string;
  parse: (text: string) => ParsePreview<T>;
  onApply: (data: T[]) => void | Promise<void>;
  applyLabel?: string;
  extra?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParsePreview<T> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setText(""); setResult(null); }
  }, [open]);

  const doParse = () => {
    if (!text.trim()) { toast.error("Tempel dulu hasil dari AI."); return; }
    const r = parse(text);
    setResult(r);
    if (r.data.length) toast.success(`${r.data.length} baris terbaca — periksa lalu terapkan.`);
    else toast.error(r.warnings[0] ?? "Tidak ada data terbaca.");
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptTemplate);
      toast.success("Prompt disalin — tempel ke Gemini/ChatGPT.");
    } catch {
      toast.error("Gagal menyalin. Pilih teks prompt lalu salin manual.");
    }
  };

  const apply = async () => {
    if (!result?.data.length) return;
    setBusy(true);
    try {
      await onApply(result.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-display font-bold text-muted-foreground">Langkah 1 — minta ke AI</span>
              <Button type="button" size="sm" variant="outline" onClick={copyPrompt}>
                <ClipboardCopy className="size-4" /> Salin prompt
              </Button>
            </div>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{promptTemplate}</pre>
          </div>

          {extra}

          <div>
            <Label>Langkah 2 — tempel hasil dari AI</Label>
            <Textarea
              rows={9}
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              placeholder="Tempel di sini hasil dari Gemini / ChatGPT (teks berlabel, tabel dengan |, atau JSON)…"
              className="font-mono text-xs"
            />
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={doParse}>
              <Wand2 className="size-4" /> Baca &amp; periksa
            </Button>
          </div>

          {result && (
            <div className="rounded-xl border-2 border-border bg-card p-3">
              <div className="text-xs font-display font-bold text-guru">
                {result.data.length} baris terbaca
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="mt-1 text-xs text-destructive">{w}</p>
              ))}
              {result.lines.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-foreground/80">
                  {result.lines.map((l, i) => <li key={i} className="truncate">• {l}</li>)}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Hasil impor tetap bisa diedit kapan saja setelah disimpan.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button variant="guru" disabled={!result?.data.length || busy} onClick={apply}>
            <Sparkles className="size-4" /> {applyLabel ?? "Terapkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
