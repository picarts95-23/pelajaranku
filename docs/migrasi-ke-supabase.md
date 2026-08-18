# Panduan Migrasi: Dari Lovable Cloud ke Supabase Sendiri

Panduan ini untuk memindahkan **data yang sudah ada** (guru, siswa, tugas, nilai, dsb)
dari database Lovable Cloud ke project Supabase milik Anda, lalu men-*deploy*
aplikasi agar berjalan penuh di infrastruktur Anda.

Perkiraan waktu: **30–60 menit**. Tidak perlu keahlian teknis tinggi, tapi
ikuti urutannya dengan teliti.

---

## Ringkasan Alur

```text
[Lovable Cloud]  --(1) Ekspor data (CSV/ZIP)-->  Komputer Anda
                                                      |
[Supabase Anda]  <--(3) Impor data --------------------+
        ^
        |  (2) Pasang skema (tabel + aturan keamanan)
        |
[Hosting Anda]   <--(4) Deploy aplikasi + .env berisi kunci Supabase Anda
```

Prinsipnya: **skema dulu, data belakangan, aplikasi terakhir.**

---

## Persiapan

Siapkan hal-hal ini sebelum mulai:

1. Akun **Supabase** gratis + satu project baru (region Singapore untuk Indonesia).
2. **Paket Setup Lengkap (.zip)** — unduh dari halaman **Admin** aplikasi ini
   (tombol *Unduh Paket Setup*). Di dalamnya ada `03-schema.sql`.
3. Akun hosting: **Cloudflare Pages**, **Vercel**, atau **Netlify** (semuanya
   punya paket gratis).
4. Folder kosong di komputer untuk menyimpan file ekspor, misal `migrasi-pelajaranku/`.

> ⚠️ Lakukan migrasi saat aplikasi sepi dipakai (misal malam hari atau libur),
> supaya tidak ada data baru masuk di tengah proses.

---

## Langkah 1 — Ekspor Data dari Lovable Cloud

1. Buka project ini di editor Lovable.
2. Klik tab **Cloud** di sidebar.
3. Masuk ke **Advanced settings → Export data**.
4. Klik **Export**. Lovable akan menyiapkan berkas ekspor dan memberi notifikasi
   ketika selesai (bisa beberapa menit).
5. Unduh berkasnya, lalu ekstrak ke folder `migrasi-pelajaranku/`.

Isinya berupa file **CSV per tabel** (`profiles.csv`, `classes.csv`,
`assignments.csv`, `submissions.csv`, dan seterusnya).

### Catatan penting soal file di Storage

CSV hanya berisi **teks & angka**, bukan file foto/rekaman tugas. Untuk media:

- File lama tetap tersimpan di Lovable Cloud dan **tidak otomatis ikut pindah**.
- Pilihan praktis: mulai "bersih" di Supabase baru (tugas baru pakai storage baru),
  dan minta guru mengunduh koreksi/berkas penting yang masih dibutuhkan sebelum migrasi.
- Bila file lama wajib dipertahankan, unduh manual dari panel **Storage** di tab
  Cloud, lalu unggah ulang ke bucket dengan **nama yang sama** di Supabase Anda
  (`answer-images`, `voice-answers`, `lesson-media`).

---

## Langkah 2 — Pasang Skema di Supabase Anda

1. Buka dashboard Supabase Anda → **SQL Editor** → **New query**.
2. Buka file `03-schema.sql` dari Paket Setup, salin **seluruh** isinya.
3. Tempel ke SQL Editor → klik **Run**.
4. Tunggu sampai muncul **Success**. Semua tabel, aturan keamanan (RLS), fungsi,
   dan trigger kini terpasang.
5. Buat 3 bucket di **Storage** (semuanya **Private**, jangan public):
   `answer-images`, `voice-answers`, `lesson-media`.
6. Buka **Authentication → Providers → Email**: aktifkan.
   Bila ingin login Google, aktifkan **Google** dan isi Client ID/Secret dari
   Google Cloud Console, dengan redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.

Jangan lanjut ke Langkah 3 sebelum langkah ini benar-benar "Success".

---

## Langkah 3 — Impor Data ke Supabase

### 3a. Buat ulang akun pengguna (wajib pertama)

Tabel `auth.users` **tidak bisa** diimpor lewat CSV, dan `profiles` bergantung
padanya. Ada dua cara:

- **Cara mudah (disarankan):** minta setiap guru & siswa **mendaftar ulang**
  dengan email yang sama di aplikasi baru. Akun otomatis terbentuk beserta
  profil, lalu Anda impor data lain (tugas, nilai) dengan mencocokkan email.
- **Cara lanjutan:** gunakan Supabase Auth Admin API untuk membuat ulang user
  satu per satu dari `profiles.csv` (butuh service key dan sedikit skrip). Pilih
  ini hanya bila jumlah pengguna besar dan Anda nyaman dengan skrip.

Setelah user ada, catat **UUID baru** setiap pengguna di
**Authentication → Users** (kolom `id`).

### 3b. Impor tabel data

Urutan impor harus mengikuti ketergantungan data:

| Urutan | Tabel                                                     |
| ------ | --------------------------------------------------------- |
| 1      | `profiles`, `profile_private`, `user_roles`                |
| 2      | `classes`, `class_enrollments`                             |
| 3      | `assignments`, `assignment_answer_keys`, `question_bank`   |
| 4      | `submissions`, `attendance`, `adab_scores`                 |
| 5      | `announcements`, `events`, `journals`, `lesson_plans`      |
| 6      | `annual_programs`, `semester_programs`, `tahfidz_mutabaah` |
| 7      | sisanya (`xp_transactions`, `task_requests`, dll)          |

Untuk setiap tabel:

1. Buka **Table Editor** → pilih tabel → tombol **Insert → Import data from CSV**.
2. Pilih file CSV yang sesuai.
3. **Ganti kolom `id` / `user_id` / `student_id` / `teacher_id`** dengan UUID baru
   hasil 3a. Cara termudah: buka CSV di Excel/Google Sheets, gunakan
   *Find & Replace* dari UUID lama ke UUID baru sebelum diunggah.
4. Klik **Import** dan pastikan tidak ada error merah.

> Jika muncul error *foreign key violation*, artinya tabel induk belum diimpor
> atau UUID belum diganti. Perbaiki lalu ulangi tabel tersebut saja.

### 3c. Verifikasi

Jalankan di SQL Editor untuk mengecek jumlah baris:

```sql
select 'profiles' as tabel, count(*) from public.profiles
union all select 'classes', count(*) from public.classes
union all select 'assignments', count(*) from public.assignments
union all select 'submissions', count(*) from public.submissions;
```

Bandingkan dengan jumlah baris di CSV. Harus sama.

---

## Langkah 4 — Siapkan Konfigurasi (.env)

1. Salin repositori aplikasi ini ke komputer/GitHub Anda.
2. Salin `.env.example` menjadi `.env`.
3. Isi nilainya dari Supabase Anda (**Project Settings → API**):

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon / publishable key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"

SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<anon / publishable key>"
SUPABASE_SERVICE_ROLE_KEY="<service_role key — RAHASIA>"
SUPABASE_PROJECT_ID="<project-ref>"

ADMIN_EMAIL="email-anda@sekolah.sch.id"
TEACHER_ACCESS_CODE="kode-rahasia-untuk-guru"
```

Bisa juga memakai wizard `/setup` di aplikasi untuk membentuk blok `.env` ini
otomatis dan menguji koneksinya.

> `service_role` key jangan pernah dibagikan, dikirim via WhatsApp, atau
> ditaruh di variabel berawalan `VITE_`.

---

## Langkah 5 — Deploy Aplikasi

Aplikasi memakai **TanStack Start**. Build lokal untuk memastikan sehat:

```bash
bun install
bun run build
```

### Cloudflare Pages (disarankan, gratis & cepat di Indonesia)

1. Push repositori ke GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command: `bun run build` · Output directory: `dist`.
4. **Settings → Environment variables**: masukkan semua isi `.env` Anda
   (untuk Production **dan** Preview).
5. **Save and Deploy**.

### Vercel / Netlify

Sama polanya: hubungkan repo, build command `bun run build`, output `dist`,
lalu tempel environment variables di panel project.

### Setelah deploy

1. Buka **Supabase → Authentication → URL Configuration**, isi **Site URL**
   dengan domain hasil deploy (mis. `https://pelajaranku.sekolah.sch.id`), dan
   tambahkan domain itu ke **Redirect URLs**.
2. Buka aplikasi, daftar dengan email `ADMIN_EMAIL` → refresh sekali → Anda
   otomatis menjadi **admin**.
3. Masuk `/admin` → buat **Undangan Guru** → bagikan tautannya ke para guru.
4. Guru membuat kelas → siswa mendaftar dan masuk memakai kode kelas.

---

## Langkah 6 — Uji Sebelum Dipakai Massal

Cek satu per satu dengan akun uji:

- [ ] Login guru, siswa, dan admin berhasil.
- [ ] Guru bisa membuat kelas dan tugas.
- [ ] Siswa bisa mengirim tugas foto, file, dan rekaman suara.
- [ ] Guru bisa menilai dan mengirim koreksi (audio/gambar).
- [ ] Rekap nilai, presensi, dan Mutaba'ah tampil benar.
- [ ] Dokumen Pembelajaran (Prota/Prosem/Jurnal) bisa disimpan & diedit.
- [ ] Backup ke Google Spreadsheet jalan (bila dipakai).

Setelah semua ✓, umumkan ke guru & siswa bahwa aplikasi pindah alamat, dan
hentikan pemakaian versi lama agar data tidak terbelah dua.

---

## Masalah yang Sering Muncul

| Gejala                                       | Penyebab & Solusi                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Halaman kosong / putih setelah login         | Skema belum dijalankan (Langkah 2) atau `.env` salah. Cek `/setup`.                |
| `permission denied for table ...`            | `03-schema.sql` tidak dijalankan sampai habis. Jalankan ulang seluruh file.        |
| `foreign key violation` saat impor           | Urutan tabel salah atau UUID belum diganti. Ikuti tabel urutan di Langkah 3b.      |
| Email admin tidak jadi admin                 | `ADMIN_EMAIL` beda huruf/spasi dengan email pendaftaran. Samakan, lalu redeploy.   |
| Login Google gagal                           | Provider Google belum aktif atau redirect URI belum ditambahkan di Supabase.       |
| Upload foto/rekaman gagal                    | Bucket `answer-images` / `voice-answers` / `lesson-media` belum dibuat (Langkah 2). |
| Data lama tidak muncul                       | Pengguna belum dibuat ulang (3a) sehingga baris data tidak terhubung ke akun.      |

---

## Setelah Migrasi

- **Backup**: Supabase menyediakan **Database → Backups** otomatis. Aktifkan
  juga backup ke Google Spreadsheet dari aplikasi sebagai lapisan kedua.
- **Update aplikasi**: `git pull` → `bun install` → deploy ulang. Bila ada
  migrasi SQL baru, jalankan file barunya di SQL Editor.
- **Rotasi kunci**: bila `service_role` bocor, buka Project Settings → API →
  reset key, lalu perbarui environment variables dan deploy ulang.
