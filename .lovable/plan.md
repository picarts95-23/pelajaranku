# Pelajaranku — Roadmap Kepemilikan Data & Offline

## Fase 1 · Backup Spreadsheet per akun guru (SEKARANG)
**Masalah saat ini:** `sheets-sync.server.ts` memakai 1 connector Google Sheets tingkat workspace
(`GOOGLE_SHEETS_API_KEY`). Artinya seluruh guru menulis ke Drive milik akun yang di-connect
pemilik workspace Lovable — bukan Drive masing-masing guru. Karena itu:
- Kolom "spreadsheet_url" per guru sebenarnya file di akun yang sama.
- Kalau connector expired atau kuota habis → semua guru gagal backup.
- Guru tidak punya kepemilikan penuh data mereka.

**Solusi:** ganti ke **Google Sheets App User Connector**. Tiap guru menekan tombol
"Hubungkan Google Sheets saya", login Google-nya sendiri (popup OAuth), dan kunci
koneksi disimpan terenkripsi di `app_user_connections`. Backup lalu ditulis ke Drive guru itu.

Langkah:
1. Konfigurasi Google OAuth client di workspace (tool `connector_app_user--connect_client`,
   `connector_id: google_sheets`).
2. Migration: tabel `app_user_connections (user_id, connector_id, ciphertext)`.
3. Server helpers `appUserConnector.ts` (dari knowledge tanstack-app-user-connector) +
   `connectionKeyCrypto.ts` untuk enkripsi AES-GCM.
4. Server fn baru:
   - `connectMySheets()` → mulai OAuth popup, simpan kunci
   - `disconnectMySheets()` → hapus kunci + panggil disconnectAppUser
   - `getMySheetsStatus()` → apakah sudah terhubung + email akun Google-nya
5. Refactor `sheets-sync.server.ts` → gunakan `callAsAppUser` dengan kunci guru
   (bukan `GATEWAY_URL` + `GOOGLE_SHEETS_API_KEY` workspace).
6. Cron `/api/public/hooks/sync-sheets` → hanya loop guru yang punya baris di
   `app_user_connections` untuk `google_sheets`.
7. UI: kartu `SheetBackupCard` diperbarui — tombol "Hubungkan Google" +
   "Putuskan" + tampilkan email akun.

## Fase 2 · Bring-Your-Own-Supabase (turn tersendiri)
Target: tiap pembeli aplikasi memakai project Supabase mereka sendiri
(gratis dari supabase.com), data 100% di server mereka.

Kendala teknis:
- `src/integrations/supabase/client.ts` di-generate otomatis dan tidak boleh diedit.
- Semua kode saat ini `import { supabase } from "@/integrations/supabase/client"`.
- Auth-middleware server-side juga baca env var tetap.

Pendekatan realistis:
- **Opsi A — Fork/Deploy sendiri**: sediakan panduan "Deploy aplikasi ke Supabase
  Anda sendiri" berupa SQL dump migrasi + `.env.example`. Pembeli fork repo,
  isi env, deploy. Paling aman & paling cepat dibangun. (Rekomendasi.)
- **Opsi B — Runtime switching**: bikin wrapper `getSupabase()` yang baca URL+key
  dari localStorage (setup wizard). Perlu menulis ulang ~40 file import.
  Berat & rawan bug. Ditunda kecuali Opsi A tidak cukup.

Deliverable Opsi A:
- Skrip export migrasi Supabase → satu file SQL yang bisa dijalankan pembeli.
- `docs/self-hosting.md` (langkah buat project Supabase, isi env, deploy).
- Halaman `/admin/export-schema` untuk admin unduh dump SQL kapan saja.

## Fase 3 · Offline: Baca + antrikan kirim (turn tersendiri)
Target: siswa bisa lihat tugas/materi terakhir & isi jawaban tanpa sinyal,
otomatis terkirim saat online.

Komponen:
- **Service Worker** (`vite-plugin-pwa` mode `injectManifest`): cache app shell +
  runtime cache untuk GET Supabase (stale-while-revalidate).
- **IndexedDB** (via `idb`): antrian mutasi tertunda
  (submissions, attendance, journal, mutabaah).
- **Sync worker**: saat `navigator.onLine`, flush antrian ke Supabase satu per satu.
- **Konflik**: last-write-wins berbasis timestamp; tolak jika deadline sudah lewat.
- **UI**: badge "Offline · N item menunggu terkirim" di header.
- Yang **tidak** offline: login pertama kali, kuis auto-grade
  (butuh RPC), realtime pengumuman.

## Fase 4 · (opsional) Fitur premium untuk dijual
- Whitelabel: logo & nama sekolah di-set admin sekolah.
- Batas siswa per lisensi.
- Halaman lisensi + kode aktivasi.
