# Rencana: Database Murah + Siap Jual

Tujuan: turunkan konsumsi kredit Lovable Cloud, dan siapkan aplikasi agar pembeli bisa memakai Supabase gratis mereka sendiri — tanpa mengganggu sistem yang sudah berjalan.

## Prinsip

- Semua perubahan **backward-compatible**. Aplikasi tetap jalan di Lovable Cloud seperti sekarang.
- Tidak mengubah skema tabel yang sudah ada. Hanya menambah, mengoptimalkan, dan membangun tooling.
- Pembeli tidak perlu paham istilah teknis: cukup ikuti wizard yang sudah ada + panduan visual.

---

## Bagian 1 — Audit & Optimasi Kredit Cloud

Sasaran: turunkan konsumsi kredit 40–70% tanpa mengurangi fungsi.

**1.1 Audit sumber pemborosan** (baca-only, tidak mengubah kode)
- Cek `credits--get_credit_balance` dengan `group_by: billable_item` untuk melihat kategori terbesar (database CPU, storage, edge functions, AI Gateway).
- Cek `ai_gateway_logs--list_ai_gateway_requests` untuk melihat panggilan AI termahal (transcribe suara, grading kuis).
- Cek `supabase--slow_queries` dan `supabase--db_health` untuk query yang lambat/berulang.
- Hasil audit ditulis ke `.lovable/cost-audit.md`.

**1.2 Perbaikan kode berdasarkan hasil audit**
- Naikkan `staleTime` di TanStack Query untuk data yang jarang berubah (profil, kelas, badges) — dari 0 detik jadi 5 menit.
- Tambahkan indeks database untuk kolom yang sering di-filter (`assignments.class_id`, `submissions.assignment_id`, `xp_transactions.user_id`).
- Kompresi otomatis foto tugas di sisi klien sebelum upload (turunkan dari ~2MB jadi ~200KB) di `PhotoInput`.
- Batasi durasi rekaman audio maks 2 menit untuk hemat storage & biaya transcribe.
- Tambahkan cron mingguan yang menghapus file `answer-images` lebih tua dari 90 hari (kecuali ditandai penting).

**1.3 Dashboard "Konsumsi Kredit" di panel Admin**
- Halaman baru menampilkan estimasi biaya bulanan dan tips penghematan berdasarkan data nyata.

---

## Bagian 2 — Panduan Setup Supabase untuk Pembeli

Sasaran: pembeli awam bisa self-host di Supabase gratis dalam < 15 menit.

**2.1 Panduan visual bergambar**
- Buat `docs/panduan-pembeli.md` (bahasa Indonesia, non-teknis) berisi:
  - Kenapa perlu Supabase sendiri (analogi kasir vs buku catatan).
  - Cara buat akun Supabase gratis (link + screenshot langkah demi langkah).
  - Cara ambil URL, anon key, service key dari dashboard Supabase.
  - Cara buka Setup Wizard di aplikasi, tempel 3 nilai, klik "Uji Koneksi".
  - Cara download schema dari `/admin` → paste ke SQL Editor Supabase → Run.
  - Cara set `ADMIN_EMAIL` agar akun pertama otomatis jadi admin.
- Tautan panduan ini muncul di dalam `/setup` wizard step 1.

**2.2 Video / GIF singkat**
- Sediakan slot placeholder di panduan untuk screencast (Anda rekam sendiri nanti).

**2.3 File paket siap-jual**
- Skrip `scripts/build-buyer-package.sh` yang mengumpulkan: source code minus `.env`, schema dump, panduan PDF, template `.env.example`, README instalasi.

---

## Bagian 3 — Mode Demo Tanpa Database

Sasaran: calon pembeli bisa mencoba aplikasi lewat halaman demo tanpa perlu login atau Supabase.

**3.1 Route `/demo`** (public, tidak butuh auth)
- Landing page ringkas: judul, 3 screenshot fitur utama (dashboard guru, tugas siswa, mutaba'ah), tombol "Coba Sekarang".
- Klik "Coba Sekarang" → masuk ke `/demo/tour` dengan data hardcoded (mock) di memory.

**3.2 Route `/demo/tour`**
- Tur berjalan otomatis 5 langkah dengan overlay penjelasan:
  1. Dashboard guru dengan top students dummy.
  2. Buat tugas → contoh soal kuis.
  3. Siswa mengumpulkan → tampilan nilai.
  4. Mutaba'ah Tahfidz mock.
  5. Papan pengumuman + reaksi.
- Tidak menyentuh Supabase sama sekali; semua data dari `src/lib/demo-data.ts`.

**3.3 CTA beli**
- Di akhir tur ada tombol "Beli Aplikasi Ini" → arahkan ke halaman kontak/lisensi (Bagian 4).

---

## Bagian 4 — Halaman Lisensi & Aktivasi Produk

Sasaran: hanya pembeli sah yang bisa menjalankan aplikasi setelah instalasi.

**4.1 Tabel `license_keys`** (di Supabase pembeli, bukan Lovable Cloud Anda)
- Kolom: kode lisensi, email pembeli, tanggal aktivasi, status.
- Row-level: hanya service role yang bisa baca/tulis.

**4.2 Halaman `/aktivasi`**
- Muncul otomatis saat aplikasi baru diinstal dan belum aktif.
- Pembeli input kode lisensi + email.
- Aplikasi hash kode + email + domain → simpan sebagai flag "aktif" di database mereka.
- Setelah aktif, halaman ini di-skip selamanya.

**4.3 Cara Anda menerbitkan lisensi**
- Halaman `/admin/lisensi` (hanya untuk Anda) yang generate kode acak → simpan di catatan pribadi Anda → kirim ke pembeli.
- Verifikasi lisensi berjalan offline (tidak perlu server pusat) — cocok karena Anda menjual "kode + aplikasi", bukan SaaS.

**4.4 Batasan yang jujur**
- Anda tidak bisa mencegah pembajakan 100% (karena source code ada di tangan pembeli). Lisensi ini menghambat pembajakan kasual, bukan pembajakan serius. Ini standar untuk model jual-putus.

---

## Urutan Eksekusi

1. **Bagian 1** dulu (audit + optimasi) — dampak langsung ke tagihan Anda sekarang.
2. **Bagian 2** (panduan pembeli) — bisa langsung dipakai jual meski Bagian 3–4 belum ada.
3. **Bagian 3** (demo) — booster penjualan.
4. **Bagian 4** (lisensi) — pengaman jual-beli.

## Yang TIDAK Dilakukan

- Tidak mengubah struktur tabel yang sudah ada.
- Tidak menyentuh alur auth/routing yang sudah stabil.
- Tidak menambah dependency berat baru.
- Tidak mengaktifkan pembayaran Stripe/Paddle (Anda belum meminta itu).
