// Server-only. Menyediakan satu file skema Supabase final (bukan tumpukan 62
// migrasi) supaya pembeli / admin cukup sekali "Run" di SQL Editor Supabase.
//
// File sumbernya dibuat dari struktur database yang sedang berjalan (tabel,
// constraint, index, fungsi, trigger, GRANT, RLS + policy, aturan storage) dan
// sudah diuji jalan bersih 3x berturut-turut di Postgres kosong — jadi aman
// dijalankan ulang (idempotent).
import schemaSql from "../../supabase/schema/pelajaranku-schema.sql?raw";

export function buildSchemaDump(): string {
  return `-- Dihasilkan: ${new Date().toISOString()}\n${schemaSql}`;
}
