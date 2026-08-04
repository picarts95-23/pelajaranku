import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Manajemen file storage — dijalankan MANUAL oleh admin, tidak lagi otomatis.
 *
 * - `getStorageUsage`: dashboard pemakaian per bucket (jumlah file, total byte,
 *   file yatim yang bisa dihapus).
 * - `cleanupMediaStorage`: hapus file berdasarkan pilihan admin
 *   (bucket mana + scope: hanya orphan atau semua file). Tetap ada grace 7 hari
 *   untuk file yatim supaya tugas yang sedang dikerjakan tidak ikut hilang.
 *
 * File yang dianggap "orphan":
 *   - `voice-answers` & `answer-images`: path tidak muncul di `submissions.file_url`.
 *   - `lesson-media`: path tidak muncul di `materials.file_url/media_url` atau
 *     `question_bank.image_url`.
 */

export const BUCKETS = ["voice-answers", "answer-images", "lesson-media"] as const;
export type MediaBucket = (typeof BUCKETS)[number];
const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const BUCKET_LABEL: Record<MediaBucket, string> = {
  "voice-answers": "Rekaman jawaban siswa",
  "answer-images": "Foto jawaban siswa",
  "lesson-media": "Lampiran materi & bank soal",
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Hanya admin yang dapat mengelola file media.");
}

type StoredObject = {
  path: string;
  size: number;
  created_at: string | null;
};

async function listAllObjects(admin: any, bucket: string): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  const { data: folders, error } = await admin.storage.from(bucket).list("", { limit: 1000 });
  if (error) throw error;
  for (const entry of folders ?? []) {
    if (entry.id) {
      out.push({
        path: entry.name,
        size: entry.metadata?.size ?? 0,
        created_at: entry.created_at ?? null,
      });
      continue;
    }
    const { data: files } = await admin.storage.from(bucket).list(entry.name, { limit: 1000 });
    for (const f of files ?? []) {
      if (!f.id) continue;
      out.push({
        path: `${entry.name}/${f.name}`,
        size: f.metadata?.size ?? 0,
        created_at: f.created_at ?? null,
      });
    }
  }
  return out;
}

async function collectReferencedPaths(admin: any) {
  const answers = new Set<string>();
  const lesson = new Set<string>();

  const [subs, mats, qb] = await Promise.all([
    admin.from("submissions").select("file_url").not("file_url", "is", null),
    admin.from("materials").select("file_url, media_url"),
    admin.from("question_bank").select("image_url").not("image_url", "is", null),
  ]);
  for (const s of (subs.data as any[] | null) ?? []) {
    // file_url bisa memuat beberapa path (jawaban multi-foto), dipisah baris baru.
    for (const u of String(s.file_url ?? "").split("\n").map((x) => x.trim())) {
      if (u && !u.startsWith("http")) answers.add(u);
    }
  }

  for (const m of (mats.data as any[] | null) ?? []) {
    for (const v of [m.file_url, m.media_url]) {
      if (v && !String(v).startsWith("http")) lesson.add(v);
    }
  }
  for (const q of (qb.data as any[] | null) ?? []) {
    if (q.image_url && !q.image_url.startsWith("http")) lesson.add(q.image_url);
  }
  return { answers, lesson };
}

function refsFor(bucket: MediaBucket, refs: { answers: Set<string>; lesson: Set<string> }) {
  return bucket === "lesson-media" ? refs.lesson : refs.answers;
}

export interface BucketUsage {
  bucket: MediaBucket;
  label: string;
  fileCount: number;
  totalBytes: number;
  orphanCount: number;
  orphanBytes: number;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
}

export interface StorageUsageResult {
  buckets: BucketUsage[];
  totals: {
    fileCount: number;
    totalBytes: number;
    orphanCount: number;
    orphanBytes: number;
  };
  scannedAt: string;
}

export const getStorageUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorageUsageResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const refs = await collectReferencedPaths(supabaseAdmin);
    const now = Date.now();

    const per: BucketUsage[] = [];
    for (const bucket of BUCKETS) {
      const objects = await listAllObjects(supabaseAdmin, bucket);
      const referenced = refsFor(bucket, refs);
      let bytes = 0;
      let orphanCount = 0;
      let orphanBytes = 0;
      let oldest: string | null = null;
      let newest: string | null = null;
      for (const o of objects) {
        bytes += o.size;
        if (o.created_at) {
          if (!oldest || o.created_at < oldest) oldest = o.created_at;
          if (!newest || o.created_at > newest) newest = o.created_at;
        }
        const age = o.created_at ? now - new Date(o.created_at).getTime() : 0;
        if (!referenced.has(o.path) && age > ORPHAN_GRACE_MS) {
          orphanCount++;
          orphanBytes += o.size;
        }
      }
      per.push({
        bucket,
        label: BUCKET_LABEL[bucket],
        fileCount: objects.length,
        totalBytes: bytes,
        orphanCount,
        orphanBytes,
        oldestCreatedAt: oldest,
        newestCreatedAt: newest,
      });
    }

    return {
      buckets: per,
      totals: {
        fileCount: per.reduce((s, r) => s + r.fileCount, 0),
        totalBytes: per.reduce((s, r) => s + r.totalBytes, 0),
        orphanCount: per.reduce((s, r) => s + r.orphanCount, 0),
        orphanBytes: per.reduce((s, r) => s + r.orphanBytes, 0),
      },
      scannedAt: new Date().toISOString(),
    };
  });

export type CleanupScope = "orphan" | "all";

export interface CleanupResult {
  dryRun: boolean;
  scope: CleanupScope;
  ranAt: string;
  buckets: Array<{
    bucket: MediaBucket;
    scanned: number;
    matched: number;
    deleted: number;
    bytesFreed: number;
  }>;
  totals: { scanned: number; matched: number; deleted: number; bytesFreed: number };
}

export const cleanupMediaStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    buckets?: MediaBucket[];
    scope?: CleanupScope;
    dryRun?: boolean;
  }) => {
    const scope: CleanupScope = input?.scope === "all" ? "all" : "orphan";
    const requested = Array.isArray(input?.buckets) ? input!.buckets : [];
    const buckets = requested.filter((b): b is MediaBucket =>
      (BUCKETS as readonly string[]).includes(b),
    );
    if (buckets.length === 0) throw new Error("Pilih minimal satu jenis file untuk dibersihkan.");
    return { buckets, scope, dryRun: !!input?.dryRun };
  })
  .handler(async ({ data, context }): Promise<CleanupResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const refs = data.scope === "orphan" ? await collectReferencedPaths(supabaseAdmin) : null;
    const now = Date.now();

    const results: CleanupResult["buckets"] = [];
    for (const bucket of data.buckets) {
      const objects = await listAllObjects(supabaseAdmin, bucket);
      const toDelete: StoredObject[] = [];
      for (const o of objects) {
        if (data.scope === "all") {
          toDelete.push(o);
          continue;
        }
        const referenced = refs ? refsFor(bucket, refs) : new Set<string>();
        const age = o.created_at ? now - new Date(o.created_at).getTime() : 0;
        if (!referenced.has(o.path) && age > ORPHAN_GRACE_MS) toDelete.push(o);
      }

      let deleted = 0;
      let bytesFreed = 0;
      if (!data.dryRun && toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 100) {
          const chunk = toDelete.slice(i, i + 100);
          const { error } = await supabaseAdmin.storage
            .from(bucket)
            .remove(chunk.map((c) => c.path));
          if (!error) {
            deleted += chunk.length;
            bytesFreed += chunk.reduce((s, c) => s + c.size, 0);
          }
        }
      }
      results.push({
        bucket,
        scanned: objects.length,
        matched: toDelete.length,
        deleted,
        bytesFreed,
      });
    }

    return {
      dryRun: data.dryRun,
      scope: data.scope,
      ranAt: new Date().toISOString(),
      buckets: results,
      totals: {
        scanned: results.reduce((s, r) => s + r.scanned, 0),
        matched: results.reduce((s, r) => s + r.matched, 0),
        deleted: results.reduce((s, r) => s + r.deleted, 0),
        bytesFreed: results.reduce((s, r) => s + r.bytesFreed, 0),
      },
    };
  });
