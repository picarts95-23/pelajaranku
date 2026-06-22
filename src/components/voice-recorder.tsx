import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

type Props = {
  /** Existing recording URL (e.g. previously saved answer) */
  value?: string | null;
  /** Called with the recorded blob + an object URL whenever a new clip is captured or cleared */
  onChange?: (data: { blob: Blob | null; url: string | null }) => void;
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ value, onChange }: Props) {
  const { lang } = useLang();
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(value ?? null);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError(null);
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const newUrl = URL.createObjectURL(blob);
        setUrl(newUrl);
        onChange?.({ blob, url: newUrl });
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(lang === "id" ? "Akses mikrofon ditolak." : "Microphone access denied.");
    } finally {
      setRequesting(false);
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function clear() {
    setUrl(null);
    setSeconds(0);
    setPlaying(false);
    onChange?.({ blob: null, url: null });
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  }

  return (
    <div className="rounded-xl border-2 border-border bg-muted/30 p-3">
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        {!recording ? (
          <Button type="button" size="sm" variant="guru" onClick={start} disabled={requesting}>
            {requesting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
            {url ? (lang === "id" ? "Rekam ulang" : "Re-record") : (lang === "id" ? "Mulai rekam" : "Start recording")}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="destructive" onClick={stop}>
            <Square className="size-4" /> {lang === "id" ? "Berhenti" : "Stop"}
          </Button>
        )}

        {recording && (
          <span className="inline-flex items-center gap-2 font-display text-sm font-bold text-destructive">
            <span className="size-2 animate-pulse rounded-full bg-destructive" /> {fmt(seconds)}
          </span>
        )}

        {url && !recording && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={togglePlay}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {lang === "id" ? "Putar" : "Play"}
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={clear}>
              <Trash2 className="size-4" />
            </Button>
            <audio
              ref={audioRef}
              src={url}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </>
        )}
      </div>
      {!url && !recording && (
        <p className="mt-2 text-xs text-muted-foreground">
          {lang === "id" ? "Rekam jawabanmu dengan suara." : "Record your answer with your voice."}
        </p>
      )}
    </div>
  );
}
