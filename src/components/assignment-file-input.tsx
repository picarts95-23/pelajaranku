import { useState } from "react";
import { Paperclip, X, Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

const BUCKET = "lesson-media";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export type AttachmentValue = {
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
};

export const emptyAttachment = (): AttachmentValue => ({
  attachment_url: null,
  attachment_name: null,
  attachment_type: null,
});

/** Guru: unggah berkas tugas/materi (Word/PDF/Excel/PowerPoint/gambar/zip) ke lesson-media. */
export function AssignmentFileInput({
  userId,
  value,
  onChange,
  folder = "tugas",
  label,
}: {
  userId: string;
  value: AttachmentValue;
  onChange: (v: AttachmentValue) => void;
  folder?: string;
  label?: string;
}) {
  const { lang } = useLang();
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size === 0) {
      toast.error(lang === "id" ? "Berkas kosong." : "Empty file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        lang === "id"
          ? `Ukuran ${(file.size / 1048576).toFixed(1)} MB melebihi batas 20 MB.`
          : `Size ${(file.size / 1048576).toFixed(1)} MB exceeds the 20 MB limit.`,
      );
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/tugas/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw error;
      onChange({
        attachment_url: path,
        attachment_name: file.name,
        attachment_type: file.type || null,
      });
      toast.success(lang === "id" ? "Berkas terunggah ✅" : "File uploaded ✅");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-border p-3 space-y-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <Paperclip className="size-3.5 text-guru" />
        {lang === "id" ? "Lampiran Berkas (Word/PDF/Gambar, maks 20 MB)" : "File attachment (Word/PDF/Image, max 20 MB)"}
      </Label>

      {value.attachment_url ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText className="size-4 shrink-0 text-guru" />
            <span className="truncate">{value.attachment_name || value.attachment_url}</span>
          </span>
          <Button type="button" size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => onChange(emptyAttachment())}>
            <X className="size-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,image/*,application/pdf"
          onChange={onFile}
          disabled={uploading}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-guru file:px-3 file:py-1.5 file:text-white"
        />
      )}

      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {lang === "id" ? "Mengunggah…" : "Uploading…"}
        </p>
      )}
    </div>
  );
}

/** Tombol unduh/buka lampiran tugas (URL bertanda tangan, berlaku 1 jam). */
export function AssignmentFileLink({
  attachmentUrl,
  attachmentName,
}: {
  attachmentUrl: string | null | undefined;
  attachmentName?: string | null;
}) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);

  if (!attachmentUrl) return null;

  async function open() {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachmentUrl!, 3600, {
        download: attachmentName || true,
      });
      if (error || !data?.signedUrl) throw error ?? new Error("URL gagal dibuat");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" className="mt-2 max-w-full" onClick={open} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      <span className="truncate">
        {lang === "id" ? "Unduh lampiran" : "Download attachment"}
        {attachmentName ? `: ${attachmentName}` : ""}
      </span>
    </Button>
  );
}
