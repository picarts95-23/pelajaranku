import { useState } from "react";
import { ImageIcon, Video, Mic, X, Loader2, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceRecorder } from "@/components/voice-recorder";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

export type MediaValue = { media_type: string | null; media_url: string | null };

const BUCKET = "lesson-media";

type MediaKind = "none" | "audio" | "image" | "video";

/** Teacher media attachment: record audio, or upload an image/video to lesson-media. */
export function MediaInput({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: MediaValue;
  onChange: (v: MediaValue) => void;
}) {
  const { lang } = useLang();
  const [kind, setKind] = useState<MediaKind>((value.media_type as MediaKind) || "none");
  const [uploading, setUploading] = useState(false);

  async function uploadBlob(blob: Blob, ext: string, type: MediaKind) {
    setUploading(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: false });
      if (error) throw error;
      onChange({ media_type: type, media_url: path });
      toast.success(lang === "id" ? "Media diunggah" : "Media uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>, type: MediaKind) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() || (type === "image" ? "jpg" : "mp4");
    await uploadBlob(file, ext, type);
  }

  function clearMedia() {
    onChange({ media_type: kind === "none" ? null : kind, media_url: null });
  }

  const KINDS: { value: MediaKind; label: string; icon: typeof FileText }[] = [
    { value: "none", label: lang === "id" ? "Teks saja" : "Text only", icon: FileText },
    { value: "audio", label: lang === "id" ? "Rekam Suara" : "Audio", icon: Mic },
    { value: "image", label: lang === "id" ? "Gambar" : "Image", icon: ImageIcon },
    { value: "video", label: "Video", icon: Video },
  ];

  return (
    <div className="rounded-xl border-2 border-dashed border-border p-3 space-y-3">
      <Label className="text-xs">{lang === "id" ? "Lampiran Media" : "Media Attachment"}</Label>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = kind === k.value;
          return (
            <Button
              key={k.value}
              type="button"
              size="sm"
              variant={active ? "guru" : "outline"}
              onClick={() => { setKind(k.value); if (k.value === "none") onChange({ media_type: null, media_url: null }); }}
            >
              <Icon className="size-4" /> {k.label}
            </Button>
          );
        })}
      </div>

      {kind === "audio" && (
        <VoiceRecorder
          value={null}
          onChange={({ blob }) => { if (blob) uploadBlob(blob, "webm", "audio"); else clearMedia(); }}
        />
      )}

      {(kind === "image" || kind === "video") && (
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept={kind === "image" ? "image/*" : "video/*"}
            onChange={(e) => onFile(e, kind)}
            disabled={uploading}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-guru file:px-3 file:py-1.5 file:text-white"
          />
        </div>
      )}

      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> {lang === "id" ? "Mengunggah…" : "Uploading…"}</p>
      )}

      {value.media_url && !uploading && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="size-4" /> {lang === "id" ? "Media siap" : "Media attached"} ({value.media_type})</span>
          <Button type="button" size="icon" variant="ghost" className="size-7" onClick={clearMedia}><X className="size-4 text-destructive" /></Button>
        </div>
      )}
    </div>
  );
}

/** Renders lesson media (image/audio/video) from a private lesson-media path using a signed URL. */
export function MediaViewer({ mediaType, mediaUrl }: { mediaType: string | null; mediaUrl: string | null }) {
  const { lang } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (url || !mediaUrl) return;
    setLoading(true);
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(mediaUrl, 3600);
    setUrl(data?.signedUrl ?? null);
    setLoading(false);
  }

  if (!mediaUrl || !mediaType || mediaType === "none") return null;

  if (!url) {
    return (
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : mediaType === "audio" ? <Mic className="size-4" /> : mediaType === "video" ? <Video className="size-4" /> : <ImageIcon className="size-4" />}
        {lang === "id" ? "Tampilkan media" : "Show media"} ({mediaType})
      </Button>
    );
  }

  return (
    <div className="mt-2">
      {mediaType === "image" && <img src={url} alt="media" className="max-h-72 rounded-xl border-2 border-border object-contain" />}
      {mediaType === "audio" && <audio controls src={url} className="w-full" />}
      {mediaType === "video" && <video controls src={url} className="max-h-72 w-full rounded-xl border-2 border-border" />}
    </div>
  );
}
