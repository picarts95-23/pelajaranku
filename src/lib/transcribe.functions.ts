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
    if (input.path.length > 500 || !/^[A-Za-z0-9._\-\/]+$/.test(input.path) || input.path.includes(".."))
      throw new Error("INVALID_PATH");
    if (!ANSWER_BUCKETS.has(input.bucket)) throw new Error("INVALID_BUCKET");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only teachers may open student answer files.
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("FORBIDDEN");

    // Verify the requesting teacher actually owns an assignment referencing this
    // file path — either as submissions.file_url, or inside quiz answer content.
    // Uses the user-scoped client so RLS restricts the join to the caller's
    // own assignments (assignments.teacher_id = auth.uid()).
    // `file_url` bisa berisi beberapa path (dipisah baris baru) untuk jawaban
    // multi-foto, jadi pencocokan memakai ilike alih-alih kesamaan penuh.
    const { data: direct } = await supabase
      .from("submissions")
      .select("id, assignment:assignments!inner(teacher_id)")
      .ilike("file_url", `%${data.path}%`)
      .eq("assignment.teacher_id", userId)
      .limit(1);

    let owned = !!direct && direct.length > 0;
    if (!owned) {
      const { data: viaContent } = await supabase
        .from("submissions")
        .select("id, assignment:assignments!inner(teacher_id)")
        .ilike("content", `%${data.path}%`)
        .eq("assignment.teacher_id", userId)
        .limit(1);
      owned = !!viaContent && viaContent.length > 0;
    }
    if (!owned) throw new Error("FORBIDDEN");
    // The file must sit in the folder of a student who submitted to one of
    // this teacher's assignments (uploads are stored under <student_id>/...).
    const [ownerFolder, fileName = ""] = data.path.split("/");
    const assignmentId = fileName.slice(0, 36);
    const { data: ownerSub } = await supabase
      .from("submissions")
      .select("id, assignment:assignments!inner(teacher_id)")
      .eq("student_id", ownerFolder)
      .eq("assignment_id", assignmentId)
      .eq("assignment.teacher_id", userId)
      .limit(1);
    if (!ownerSub || ownerSub.length === 0) throw new Error("FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 3600);
    if (error || !signed?.signedUrl) throw new Error("Berkas jawaban tidak ditemukan.");
    return { url: signed.signedUrl };
  });
