import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sapu file storage yang sudah tidak dirujuk dari database ("orphan") plus
 * file sangat lama yang aman dihapus (default 365 hari — arsip tahun ajaran).
 *
 * - `voice-answers` & `answer-images`: dianggap orphan bila path-nya tidak muncul
 *   di kolom `submissions.file_url`. Diberi grace 7 hari supaya siswa yang sedang
 *   mengerjakan tugas tidak terhapus jawabannya.
 * - `lesson-media`: dianggap orphan bila tidak dirujuk `materials.attachment_url`,
 *   `assignments.file_url`, atau `question_bank.attachment_url`.
 *
 * Bisa dipanggil manual oleh admin atau otomatis lewat pg_cron
 * (lihat `src/routes/api/public/hooks/media-cleanup.ts`).
 */

const BUCKETS = ["voice-answers", "answer-images", "lesson-media"] as const;
const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const HARD_DELETE_DAYS = 365;

async function listAllPaths(admin: any, bucket: string) {
  const out: { path: string; created_at: string | null }[] = [];
  // Traverse top-level folders (per-user), lalu file di dalamnya.
  const { data: folders, error } = await admin.storage.from(bucket).list("", { limit: 1000 });
  if (error) throw error;
  for (const entry of folders ?? []) {
    if (entry.id) {
      // File langsung di root bucket.
      out.push({ path: entry.name, created_at: entry.created_at ?? null });
      continue;
    }
    const { data: files } = await admin.storage.from(bucket).list(entry.name, { limit: 1000 });
    for (const f of files ?? []) {
      if (!f.id) continue;
      out.push({ path: `${entry.name}/${f.name}`, created_at: f.created_at ?? null });
    }
  }
  return out;
}

async function collectReferencedPaths(
  admin: any,
): Promise<{ answers: Set<string>; lesson: Set<string> }> {
  const answers = new Set<string>();
  const lesson = new Set<string>();

  const { data: subs } = await admin
    .from("submissions")
    .select("file_url")
    .not("file_url", "is", null);
  for (const s of subs ?? []) {
    const url: string = s.file_url ?? "";
    if (url && !url.startsWith("http")) answers.add(url);
  }

  // Kunci jawaban kuis kadang menyimpan path per soal (voice/image).
  const { data: mats } = await admin
    .from("materials")
    .select("attachment_url")
    .not("attachment_url", "is", null);
  for (const m of mats ?? []) if (m.attachment_url && !m.attachment_url.startsWith("http")) lesson.add(m.attachment_url);

  const { data: asg } = await admin
    .from("assignments")
    .select("file_url")
    .not("file_url", "is", null);
  for (const a of asg ?? []) if (a.file_url && !a.file_url.startsWith("http")) lesson.add(a.file_url);

  const { data: qb } = await admin
    .from("question_bank")
    .select("attachment_url")
    .not("attachment_url", "is", null);
  for (const q of qb ?? []) if (q.attachment_url && !q.attachment_url.startsWith("http")) lesson.add(q.attachment_url);

  return { answers, lesson };
}

async function sweepBucket(
  admin: any,
  bucket: (typeof BUCKETS)[number],
  referenced: Set<string>,
  dryRun: boolean,
) {
  const objects = await listAllPaths(admin, bucket);
  const now = Date.now();
  const toDelete: string[] = [];
  let scanned = 0;

  for (const obj of objects) {
    scanned++;
    const age = obj.created_at ? now - new Date(obj.created_at).getTime() : 0;
    const isReferenced = referenced.has(obj.path);
    const isVeryOld = obj.created_at
      ? age > HARD_DELETE_DAYS * 24 * 60 * 60 * 1000
      : false;
    const isOrphanEligible = !isReferenced && age > ORPHAN_GRACE_MS;

    if (isVeryOld || isOrphanEligible) toDelete.push(obj.path);
  }

  let deleted = 0;
  if (!dryRun && toDelete.length > 0) {
    // Supabase remove menerima array, batching 100 file per panggilan.
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (!error) deleted += chunk.length;
    }
  }
  return { bucket, scanned, orphan: toDelete.length, deleted };
}

export const cleanupMediaStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean }) => ({ dryRun: !!input?.dryRun }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw error;
    if (!isAdmin) throw new Error("Hanya admin yang dapat menjalankan pembersihan media.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const refs = await collectReferencedPaths(supabaseAdmin);

    const results = [] as Awaited<ReturnType<typeof sweepBucket>>[];
    for (const b of BUCKETS) {
      const referenced = b === "lesson-media" ? refs.lesson : refs.answers;
      results.push(await sweepBucket(supabaseAdmin, b, referenced, data.dryRun));
    }
    return {
      dryRun: data.dryRun,
      ranAt: new Date().toISOString(),
      buckets: results,
      totals: {
        scanned: results.reduce((s, r) => s + r.scanned, 0),
        orphan: results.reduce((s, r) => s + r.orphan, 0),
        deleted: results.reduce((s, r) => s + r.deleted, 0),
      },
    };
  });
