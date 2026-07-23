/**
 * Cron endpoint: bersihkan file storage yang sudah tidak dirujuk.
 * Dipanggil pg_cron mingguan. Auth pakai apikey Supabase (bypass middleware
 * via `/api/public/*`), lalu authorize via ADMIN_EMAIL + service role di dalam.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/media-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Kumpulkan path yang masih dirujuk DB.
          const answers = new Set<string>();
          const lesson = new Set<string>();

          const [subs, mats, qb] = await Promise.all([
            supabaseAdmin.from("submissions").select("file_url").not("file_url", "is", null),
            supabaseAdmin.from("materials").select("file_url, media_url"),
            supabaseAdmin.from("question_bank").select("image_url").not("image_url", "is", null),
          ]);
          for (const s of (subs.data as any[] | null) ?? []) {
            const u: string = s.file_url ?? "";
            if (u && !u.startsWith("http")) answers.add(u);
          }
          for (const m of (mats.data as any[] | null) ?? []) {
            for (const v of [m.file_url, m.media_url]) {
              if (v && !String(v).startsWith("http")) lesson.add(v);
            }
          }
          for (const q of (qb.data as any[] | null) ?? []) {
            if (q.image_url && !q.image_url.startsWith("http")) lesson.add(q.image_url);
          }

          const BUCKETS = ["voice-answers", "answer-images", "lesson-media"] as const;
          const GRACE = 7 * 24 * 60 * 60 * 1000;
          const HARD = 365 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          const results: Array<{ bucket: string; scanned: number; deleted: number }> = [];

          for (const bucket of BUCKETS) {
            const referenced = bucket === "lesson-media" ? lesson : answers;
            const toDelete: string[] = [];
            let scanned = 0;

            const { data: folders } = await supabaseAdmin.storage.from(bucket).list("", { limit: 1000 });
            for (const entry of folders ?? []) {
              if (entry.id) {
                scanned++;
                const age = entry.created_at ? now - new Date(entry.created_at).getTime() : 0;
                if (age > HARD || (!referenced.has(entry.name) && age > GRACE)) toDelete.push(entry.name);
                continue;
              }
              const { data: files } = await supabaseAdmin.storage.from(bucket).list(entry.name, { limit: 1000 });
              for (const f of files ?? []) {
                if (!f.id) continue;
                scanned++;
                const path = `${entry.name}/${f.name}`;
                const age = f.created_at ? now - new Date(f.created_at).getTime() : 0;
                if (age > HARD || (!referenced.has(path) && age > GRACE)) toDelete.push(path);
              }
            }

            let deleted = 0;
            for (let i = 0; i < toDelete.length; i += 100) {
              const chunk = toDelete.slice(i, i + 100);
              const { error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
              if (!error) deleted += chunk.length;
            }
            results.push({ bucket, scanned, deleted });
          }

          return Response.json({ ok: true, ranAt: new Date().toISOString(), buckets: results });
        } catch (err) {
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
