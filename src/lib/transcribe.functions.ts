import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXT_MIME: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

/**
 * Transcribes a student's voice answer (stored in the private `voice-answers`
 * bucket) into text so a teacher can read and grade it alongside playback.
 * Only teachers may call this; the audio is fetched server-side with the
 * service role and forwarded to the Lovable AI transcription gateway.
 */
export const transcribeVoiceAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => {
    if (!input?.path || typeof input.path !== "string") throw new Error("INVALID_PATH");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only teachers may transcribe student answers.
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("FORBIDDEN");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI belum dikonfigurasi.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from("voice-answers").download(data.path);
    if (error || !file) throw new Error("Rekaman tidak ditemukan.");

    const ext = (data.path.split(".").pop() || "webm").toLowerCase();
    const mime = EXT_MIME[ext] ?? "audio/webm";
    const blob = new Blob([await file.arrayBuffer()], { type: mime });
    if (blob.size < 512) throw new Error("Rekaman terlalu pendek atau kosong.");

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `answer.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Transkripsi gagal (${res.status}). ${detail.slice(0, 120)}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
