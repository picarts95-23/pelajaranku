import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



const ANSWER_BUCKETS = new Set(["voice-answers", "answer-images"]);

/**
 * Returns a short-lived signed URL for a student's answer file (audio or image)
 * stored in a private bucket, so a teacher can view/listen to it while grading.
 * Teacher-only; signing uses the service role so it works for both regular-task
 * answers (submissions.file_url) and quiz answers (paths stored inside content).
 */
export const signAnswerFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: string; path: string }) => {
    if (!input?.path || typeof input.path !== "string") throw new Error("INVALID_PATH");
    if (!ANSWER_BUCKETS.has(input.bucket)) throw new Error("INVALID_BUCKET");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only teachers may open student answer files.
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 3600);
    if (error || !signed?.signedUrl) throw new Error("Berkas jawaban tidak ditemukan.");
    return { url: signed.signedUrl };
  });
