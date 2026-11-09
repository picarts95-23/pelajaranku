import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePracticeQuestions } from "./ai-practice";
import { buildPracticeResult, type PracticeResultInput } from "./practice-result";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const savePracticeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PracticeResultInput) => input)
  .handler(async ({ data, context }) => {
    const classId = String(data.classId ?? "");
    const clientId = String(data.clientId ?? "");
    if (!uuid.test(classId) || !uuid.test(clientId)) throw new Error("Sesi latihan tidak valid.");
    const subject = String(data.subject ?? "").trim().slice(0, 100);
    const topic = String(data.topic ?? "").trim().slice(0, 200);
    const level = data.level === "dasar" || data.level === "mahir" ? data.level : "menengah";
    if (!subject || !topic) throw new Error("Mata pelajaran dan topik wajib diisi.");

    const { data: enrollment, error: enrollmentError } = await context.supabase
      .from("class_enrollments").select("id").eq("class_id", classId).eq("student_id", context.userId).maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) throw new Error("Kamu tidak terdaftar di kelas ini.");

    const questions = normalizePracticeQuestions({ questions: data.questions });
    const result = buildPracticeResult(questions, data.results);
    const row = {
      client_id: clientId,
      student_id: context.userId,
      class_id: classId,
      subject,
      topic,
      level,
      score: result.score,
      correct_count: result.correctCount,
      question_count: questions.length,
      hints_used: result.hintsUsed,
      weak_concepts: result.weakConcepts,
      feedback: result.feedback,
      answers: result.answers,
    };
    // Only the validated server flow may create attempts and trigger the teacher journal.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: saved, error } = await db.from("practice_attempts").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await db.from("practice_attempts").select("id").eq("student_id", context.userId).eq("client_id", clientId).maybeSingle();
        if (existing) return { id: existing.id as string, ...result };
      }
      throw error;
    }
    return { id: saved.id as string, ...result };
  });
