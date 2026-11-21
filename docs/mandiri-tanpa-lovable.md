# Menjalankan Pelajaranku Mandiri (Tanpa Lovable)

Branch ini menghapus semua ketergantungan **kode** pada layanan Lovable:

| Dulu | Sekarang |
| --- | --- |
| `LOVABLE_API_KEY` + `@lovable.dev/ai-gateway` (AI) | `GOOGLE_API_KEY` (Gemini langsung). Asisten guru juga bisa `OPENAI_API_KEY`. |
| `connector-gateway.lovable.dev` (Google Sheets) | Google Sheets API langsung lewat Service Account (atau refresh token OAuth). |
| `bun.lock` mengarah ke registry npm internal Lovable | Registry npm publik (default). |
| Link bagikan `pelajaranku.lovable.app` | Alamat situs tempat aplikasi dibuka. |

Yang **tidak** diubah dan aman: paket `@lovable.dev/vite-tanstack-config` (paket npm publik
pembungkus konfigurasi Vite/TanStack/Nitro) serta kode khusus preview Lovable
(`previewAuthStorage.ts`, `register-sw.ts`, `lovable-error-reporting.ts`) yang otomatis
tidak aktif di luar Lovable.

## 1. Environment variables

Salin `.env.example` ke `.env` (lokal) atau isi di panel hosting (Cloudflare/Vercel/Netlify).

Wajib: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`,
`ADMIN_EMAIL`, `TEACHER_ACCESS_CODE`.

> File `.env` yang ada di repositori ini berisi kunci project Supabase **lama (Lovable Cloud)**.
> Ganti semuanya dengan nilai project Supabase baru Anda sebelum deploy.

## 2. Fitur AI (Gemini, gratis)

1. Buat API key di <https://aistudio.google.com/apikey>.
2. Isi `GOOGLE_API_KEY`. Tanpa key, fitur AI menampilkan pesan "Fitur AI belum aktif" dan
   fitur lain tetap berjalan.

## 3. Backup / ekspor Google Spreadsheet

Cara A — Service Account (disarankan, tidak kedaluwarsa):

1. Google Cloud Console → buat project → aktifkan **Google Sheets API** dan **Google Drive API**.
2. IAM & Admin → Service Accounts → buat akun → tab Keys → **Add key → JSON**.
3. Isi `GOOGLE_SERVICE_ACCOUNT_EMAIL` (`client_email`) dan
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (`private_key`).
4. Isi `GOOGLE_SHEETS_OWNER_EMAIL` dengan email Google Anda agar spreadsheet yang dibuat
   service account otomatis dibagikan ke Anda.

Cara B — refresh token akun Google sendiri: isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_SHEETS_REFRESH_TOKEN` (scope `spreadsheets` dan `drive.file`). Jika layar persetujuan
OAuth masih berstatus *Testing*, token kedaluwarsa setiap 7 hari — gunakan status *In production*.

### Jadwal backup otomatis

Endpoint `POST /api/public/hooks/sync-sheets` (header `apikey` = anon key) menjalankan backup
semua guru. Jadwalkan dari Supabase (SQL Editor), ganti domain dan anon key:

```sql
select cron.schedule(
  'sync-sheets-daily', '0 17 * * *',  -- 00:00 WIB
  $$ select net.http_post(
       url := 'https://DOMAIN-ANDA/api/public/hooks/sync-sheets',
       headers := '{"Content-Type":"application/json","apikey":"ANON-KEY-ANDA"}'::jsonb,
       body := '{}'::jsonb) $$
);
```

## 4. Install dan build

```bash
bun install
bun run build
```

`bun.lock` sudah dinormalkan ke registry publik. Setelah `bun install` pertama, commit
`bun.lock` yang diperbarui bila ada perubahan.

## 5. Deploy

Ikuti `docs/self-hosting.md` (Cloudflare Pages / Vercel / Netlify). Setelah build pertama,
pastikan folder output sesuai target hosting (Nitro dapat menulis ke `.output`, bukan `dist`).
Terakhir, isi **Site URL** dan **Redirect URLs** di Supabase Auth dengan domain baru.
