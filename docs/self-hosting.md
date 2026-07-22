# Panduan Self-Hosting Pelajaranku

Aplikasi ini bisa dijalankan **100% di akun Supabase milik Anda sendiri** — bukan
di database Lovable. Cocok bila Anda ingin:

- Data siswa & guru tersimpan di server milik sekolah/pribadi.
- Menjual aplikasi kepada sekolah lain, masing-masing dengan database sendiri.
- Menghindari batas kuota atau biaya layanan pihak ketiga.

Semua data (murid, tugas, nilai, pengumuman, dsb) akan tersimpan di project
Supabase Anda. Lovable hanya berperan sebagai kode sumber.

---

## Langkah 1 · Siapkan project Supabase gratis

1. Buat akun di <https://supabase.com> (gratis, tanpa kartu kredit).
2. Klik **New Project** → pilih region terdekat (Singapore untuk Indonesia).
3. Simpan **Database Password** yang Anda buat — akan diminta saat memulihkan
   data.
4. Setelah project selesai dibuat, buka **Project Settings → API**. Anda akan
   melihat tiga nilai penting:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (RAHASIA! jangan pernah dibagikan atau ditaruh di
     frontend)
5. Buka **Project Settings → General**, salin **Reference ID** (mis. `abcdxyz`).

---

## Langkah 2 · Pasang skema database

Aplikasi butuh belasan tabel, RLS, dan fungsi database. Ada dua cara:

### Cara A — Unduh dari panel Admin (paling mudah)

1. Login ke aplikasi Pelajaranku (versi Lovable) sebagai **admin**.
2. Buka halaman **Admin** (`/admin`).
3. Klik tombol **"Unduh skema Supabase (.sql)"**.
4. Buka Supabase project baru Anda → **SQL Editor → New query**.
5. Tempel isi file `.sql` yang tadi diunduh, klik **Run**.
6. Selesai — semua tabel, RLS, dan fungsi terpasang.

### Cara B — Dari kode sumber

Semua migrasi berada di folder `supabase/migrations/`. Jalankan berurutan
(paling lama tanggal file paling awal) di SQL Editor Supabase Anda, atau
gunakan Supabase CLI:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

---

## Langkah 3 · Konfigurasi environment

1. Fork/salin repository ini.
2. Salin `.env.example` menjadi `.env` di root project.
3. Isi setiap nilai sesuai Langkah 1 (URL, anon key, service role key, dsb).
4. Pilih dan simpan **ADMIN_EMAIL** (email yang akan menjadi admin) dan
   **TEACHER_ACCESS_CODE** (kode rahasia untuk pendaftaran guru).

---

## Langkah 4 · Aktifkan Auth di Supabase

1. Buka **Authentication → Providers → Email**: aktifkan.
2. (Opsional tapi disarankan) **Google**: aktifkan, isi Client ID & Client
   Secret dari Google Cloud Console. Tambahkan
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` sebagai redirect URI.
3. **Authentication → URL Configuration**: isi **Site URL** dengan alamat
   aplikasi Anda (mis. `https://pelajaranku.sekolah.sch.id`).

---

## Langkah 5 · Deploy

Aplikasi ini pakai **TanStack Start** — bisa dideploy ke Cloudflare Pages,
Vercel, Netlify, atau server sendiri:

```bash
bun install
bun run build
```

Contoh Cloudflare Pages:

1. Push repo ke GitHub.
2. Di Cloudflare Dashboard → **Workers & Pages → Create → Connect repo**.
3. Build command: `bun run build` · Output: `dist`.
4. Environment variables: tempel seluruh isi `.env` Anda.
5. Deploy.

---

## Langkah 6 · Login pertama sebagai admin

1. Buka aplikasi di alamat baru Anda.
2. Daftar dengan email yang **sama persis** seperti `ADMIN_EMAIL`.
3. Setelah login, refresh sekali — akun Anda otomatis dipromosikan menjadi
   admin.
4. Buka `/admin` untuk mengelola pengguna.

---

## Pemeliharaan

- **Update aplikasi**: pull perubahan repo, jalankan `bun install`, lalu deploy
  ulang. Bila ada migrasi baru, jalankan file SQL yang baru (`supabase/migrations/`).
- **Backup**: Supabase menyediakan **Database → Backups** otomatis (harian pada
  Pro plan). Anda juga bisa `pg_dump` manual kapan saja.
- **Rotasi kunci**: bila `SUPABASE_SERVICE_ROLE_KEY` bocor, buka Project
  Settings → API → **Reset service_role** — lalu update `.env` dan redeploy.

---

## Bantuan

Bila macet, hubungi pembuat aplikasi disertai:

- Screenshot pesan error.
- Nama browser & device.
- URL project Supabase Anda (URL saja, **jangan** kirim service_role key).
