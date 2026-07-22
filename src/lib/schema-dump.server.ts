// Server-only. Inlines every SQL migration as a string at build time via Vite's
// import.meta.glob, then concatenates them in filename order so admins can
// download a single "install fresh Supabase" SQL file.

const modules = import.meta.glob("../../supabase/migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export function buildSchemaDump(): string {
  const entries = Object.entries(modules).sort(([a], [b]) => (a < b ? -1 : 1));
  const parts: string[] = [];
  parts.push("-- Pelajaranku · Skema Supabase lengkap");
  parts.push(`-- Dibuat otomatis: ${new Date().toISOString()}`);
  parts.push(`-- Jumlah migrasi: ${entries.length}`);
  parts.push("-- Jalankan file ini di SQL Editor Supabase project baru Anda.");
  parts.push("");
  for (const [path, sql] of entries) {
    const name = path.split("/").pop() ?? path;
    parts.push(`-- ============================================================`);
    parts.push(`-- ${name}`);
    parts.push(`-- ============================================================`);
    parts.push(sql.trim());
    parts.push("");
  }
  return parts.join("\n");
}
