# Panduan Setup Pelajaranku (Untuk Pembeli)

Panduan ini ditulis untuk pengguna awam. Anda tidak perlu tahu istilah teknis. Ikuti langkah demi langkah dan aplikasi Anda siap dalam waktu ± 15 menit.

---

## Kenapa Perlu "Database Sendiri"?

Bayangkan aplikasi seperti **mesin kasir** di toko. Database adalah **buku catatan** yang menyimpan semua transaksi.

- **Mesin kasir (aplikasi Pelajaranku)** → sudah Anda beli, milik Anda.
- **Buku catatan (database)** → harus Anda siapkan sendiri, agar semua data siswa, tugas, dan nilai **100% milik Anda**, bukan dititipkan ke pihak lain.

Kabar baiknya: buku catatan digital yang kita pakai (namanya **Supabase**) **gratis** untuk pemakaian normal (sampai ratusan siswa dan puluhan ribu tugas).

---

## Yang Anda Butuhkan Sebelum Mulai

1. Komputer/laptop dengan browser (Chrome/Firefox/Safari).
2. Email aktif.
3. Waktu 15 menit.
4. Aplikasi Pelajaranku sudah terinstal (dari paket yang Anda beli).

---

## Langkah 1 — Buat Akun Supabase (Gratis)

1. Buka **[supabase.com](https://supabase.com)** di browser.
2. Klik tombol hijau **"Start your project"** di kanan atas.
3. Login pakai akun **GitHub** atau email Anda.
4. Setelah masuk, klik **"New Project"**.
5. Isi:
   - **Name**: `pelajaranku-sekolah-saya` (bebas, huruf kecil semua)
   - **Database Password**: klik tombol **Generate a password** → **SIMPAN password ini di catatan** (nanti tidak bisa dilihat lagi).
   - **Region**: pilih **Southeast Asia (Singapore)** — paling dekat dengan Indonesia.
   - **Plan**: pilih **Free** (Rp 0).
6. Klik **Create new project**. Tunggu 2–3 menit sampai statusnya hijau ✓.

📸 *Slot untuk screenshot: dashboard Supabase project baru*

---

## Langkah 2 — Ambil 3 Kunci Rahasia

Di dashboard project Supabase Anda:

1. Di kiri, klik ikon **Settings** (gerigi).
2. Klik **API** di menu Settings.
3. Anda akan melihat:
   - **Project URL** — contoh: `https://abcdef.supabase.co`
   - **anon public** — kunci panjang (aman untuk browser)
   - **service_role secret** — kunci lebih panjang (rahasia, jangan pernah dibagikan)

**Salin ketiganya ke Notepad/catatan.** Anda akan menempelnya di aplikasi.

📸 *Slot untuk screenshot: halaman API keys*

⚠️ **PENTING**: `service_role` adalah kunci maha kuasa. Jangan pernah dikirim via WhatsApp, email publik, atau ditulis di dokumen yang dibagikan.

---

## Langkah 3 — Setup di Aplikasi Pelajaranku

1. Buka aplikasi Pelajaranku Anda → menu **`/setup`** (contoh: `https://sekolah-saya.com/setup`).
2. Ikuti wizard 4 langkah:
   - **Langkah 1**: Tempel **Project URL**.
   - **Langkah 2**: Tempel **anon public** key.
   - **Langkah 3**: Tempel **service_role secret** key.
   - **Langkah 4**: Klik **"Uji Koneksi"**. Kalau muncul ✓ hijau, lanjut.
3. Aplikasi akan memberi Anda **blok .env** yang berisi konfigurasi lengkap. Salin ke file `.env` di server Anda dan restart aplikasi.

📸 *Slot untuk screenshot: wizard setup step 4 (uji koneksi berhasil)*

---

## Langkah 4 — Buat Tabel Database (Sekali Saja)

1. Kembali ke dashboard Supabase, klik ikon **SQL Editor** di kiri (ikon terminal).
2. Klik **New query**.
3. Buka aplikasi Pelajaranku → menu **Admin** → tombol **Download Schema (SQL)**.
4. Buka file SQL yang terdownload, salin **semua isinya**.
5. Tempel di SQL Editor Supabase → klik **Run** (kanan bawah).
6. Tunggu sampai muncul **"Success"** di bagian bawah.

📸 *Slot untuk screenshot: SQL Editor dengan tombol Run*

Sekarang database Anda sudah lengkap: 30+ tabel siap pakai, aturan keamanan aktif.

---

## Langkah 5 — Set Anda Sebagai Admin

1. Di aplikasi Pelajaranku, buka file konfigurasi (biasanya panel hosting Anda → **Environment Variables**).
2. Tambah baris:
   ```
   ADMIN_EMAIL=email-anda@sekolah.sch.id
   ```
3. Restart aplikasi.
4. Buka `/auth`, daftar dengan email tersebut. Setelah masuk, Anda otomatis jadi **Admin**.

---

## Langkah 6 — Undang Guru & Siswa

**Untuk guru:**
1. Masuk sebagai Admin → menu **Undangan Guru**.
2. Klik **Buat Kode Baru** → salin link `undangan?code=…`.
3. Kirim link ke calon guru via WhatsApp. Mereka klik → daftar → otomatis jadi guru.

**Untuk siswa:**
1. Guru masing-masing membuat kelas → dapat kode kelas 6 huruf.
2. Siswa daftar sendiri di `/auth`, lalu masuk kode kelas.

---

## Selesai! 🎉

Aplikasi Anda sekarang berjalan **penuh di server sendiri**:
- Semua data siswa, nilai, foto tugas → di **Supabase Anda**.
- Anda pemilik penuh: bisa backup, ekspor, hapus kapan saja.
- Tidak ada biaya bulanan selama di bawah 500 MB (biasanya cukup untuk 200–300 siswa selama 2 tahun).

---

## Bila Ada Masalah

### "Uji Koneksi" gagal
- **Format URL salah** → pastikan diawali `https://` dan diakhiri `.supabase.co`.
- **Kunci ditolak (401)** → pastikan Anda menyalin **anon public**, bukan yang lain. Coba salin ulang tanpa spasi di depan/belakang.
- **Kunci tertukar** → pastikan `anon` di kolom anon, dan `service_role` di kolom service. Wizard akan otomatis mendeteksi kesalahan ini.

### Halaman kosong setelah login
- Pastikan Langkah 4 (jalankan SQL) sudah dilakukan, kalau belum tabel-tabelnya belum ada.

### Admin tidak muncul
- Cek `ADMIN_EMAIL` sama persis dengan email yang Anda pakai daftar (case-sensitive di beberapa hosting).

Butuh bantuan? Email: **pelajaranku.support@gmail.com**

---

## Catatan Biaya Jangka Panjang

| Ukuran Sekolah | Perkiraan Storage/Tahun | Biaya Supabase |
|----------------|-------------------------|-----------------|
| < 100 siswa    | < 200 MB                | **Gratis**      |
| 100–500 siswa  | 500 MB – 2 GB           | **Gratis** (upgrade ke Pro $25/bulan jika perlu backup harian) |
| 500+ siswa     | 2+ GB                   | **Pro $25/bulan** (~Rp 400 rb) |

Bandingkan dengan platform SaaS umum yang bisa mencapai **Rp 2–5 juta/bulan** untuk 500 siswa.
