# Rencana Perbaikan EduQuest Academy

Saya kelompokkan menjadi 7 area. Item DB ditandai (DB), penyimpanan (Storage), dan butuh kunci API Anda (KEY).

## 1. Perbaikan Peran (Guru ↔ Siswa tidak tertukar)
Penyebab: halaman `loading` memakai peran yang dipilih saat login (`preferredRole`) sebagai tujuan sebelum peran asli dari database termuat, sehingga guru bisa masuk ke dashboard siswa lalu "loncat" balik.
- `loading.tsx`: hanya arahkan berdasarkan peran dari database (`user_roles`). Jika peran belum termuat, tunggu; jika benar-benar kosong, arahkan ke `verify-role`. Pilihan peran saat login tidak lagi menentukan tujuan.
- Pertegas penjaga di tiap halaman: tunggu `loading` selesai sebelum redirect.
- `auth.tsx`: hapus override peran pada navigasi login.

## 2. Tampilan Dashboard (sidebar, greeting)
- `dashboard-shell.tsx`: ubah sidebar menjadi kolom flex dengan area menu `flex-1 overflow-y-auto` agar daftar pintasan kiri bisa di-scroll (guru & siswa).
- Footer & sapaan dibuat sesuai peran: guru tidak lagi melihat kalimat "…siswi!". Sapaan guru: "Selamat datang, Ustadz/Ustadzah <nama>"; siswa tetap.

## 3. Login & Form
- Tombol mata 👁 untuk lihat/sembunyikan password di `auth.tsx`.
- Penanda wajib: tambahkan tanda bintang merah (*) pada field wajib di form login/daftar, pembuatan tugas, dan materi. Komponen `Field`/`Label` diberi prop `required` yang merender tanda.

## 4. Asisten AI dengan kunci API Anda (KEY)
Anda memilih memakai kunci sendiri. Langkah:
- Saya siapkan pemilih model di jendela asisten: **Gemini** (Google) dan **ChatGPT** (OpenAI).
- Server function `ai-assistant.functions.ts` diubah agar memanggil OpenAI atau Google sesuai pilihan, memakai kunci yang Anda simpan.
- Pada langkah implementasi saya akan meminta kunci `OPENAI_API_KEY` dan/atau `GEMINI_API_KEY` lewat form aman (Anda boleh isi salah satu saja).

## 5. Materi, Tugas & Bank Soal multimedia (DB + Storage)
- Buat bucket penyimpanan privat `lesson-media` dengan kebijakan akses (guru unggah, siswa kelasnya melihat lewat URL bertanda).
- `materials` (DB): tambah `media_type` (text/audio/image/video) dan `media_url`. UI guru di `guru.mapel.tsx`: tulis teks, **rekam suara**, atau unggah gambar/video. Siswa melihat/memutar di `siswa.mapel.tsx`.
- `question_bank` (DB): tambah `image_url` agar soal bisa bergambar.
- Komponen unggah/rekam dipakai ulang dari `voice-recorder.tsx` plus uploader baru.

## 6. Notifikasi & Pintasan
- **Notifikasi materi/tugas baru (siswa)**: badge "baru" pada menu Mapel & Tugas berdasarkan waktu kunjungan terakhir (disimpan di perangkat), tampil di sidebar dan kartu menu.
- **Notifikasi pengumpulan (guru)**: panel di dashboard guru berisi daftar siswa yang baru mengumpulkan (status "terkumpul") dengan nama + judul tugas, tertaut ke penilaian.
- **Gabung pintasan siswa**: 
  - "Kolom Tugas" + "Mengerjakan Tugas" + "Mengumpulkan Tugas" → satu kartu **"Tugas Saya"** (berisi daftar, tandai selesai, kirim).
  - "Membuat Status" + "Komentar" + "Emoji & Like" → satu kartu **"Status & Interaksi"**.
- **Pintasan guru berfungsi**: kartu/stat Tugas, Kelas, Siswa, dan Pengumpulan mengarah ke halaman terkait (Pengumpulan → halaman penilaian tugas).
- **Emoji di Papan Peringkat**: tombol reaksi (❤️ 👍 🔥 🌟 dst.) per siswa di `siswa.leaderboard.tsx`, tersimpan di tabel baru `peer_reactions` (DB) dengan hitungan reaksi.

## 7. Tugas dikelompokkan & Rekap Nilai (DB)
- **Pengelompokan tugas (guru)**: daftar tugas dikelompokkan per jenis jawaban (Deskripsi, Pilihan Ganda, PG Kompleks, Rekam Suara, Muroja'ah). Klik jenis → tampil tugasnya → klik tugas → daftar pengumpulan siswa beserta jawaban (lihat gambar / dengar audio / baca teks) dan umpan balik langsung (sudah sebagian ada, tinggal lapisan grup + dukungan media jawaban gambar/video).
- **Tanda jenis ujian**: tambah kolom `exam_type` pada `assignments` ('harian' | 'uts' | 'uas', default 'harian'). Guru memilih saat membuat tugas.
- **Nilai Adab**: tabel baru `adab_scores` (DB) (per siswa, kelas, mapel) diisi guru di halaman Rekap.
- **Rumus Rekap** di `guru.rekap.tsx` per siswa/mapel:
  - Kehadiran 10% (otomatis dari presensi), Adab 20% (input), Tugas Harian 20% (rata-rata tugas `harian` dinilai), UTS 20% (tugas `uts`), UAS 30% (tugas `uas`).
  - Nilai akhir = 0.1·hadir + 0.2·adab + 0.2·harian + 0.2·uts + 0.3·uas.
  - Predikat: A (90–100), B (80–89), C (70–79), di bawah 70 ditandai perlu perbaikan.
  - Tabel menampilkan rincian tiap komponen + nilai akhir + predikat, bisa diekspor.

---

## Catatan Teknis
- Migrasi DB (satu paket): kolom `materials.media_type/media_url`, `question_bank.image_url`, `assignments.exam_type`; tabel `adab_scores` dan `peer_reactions` dengan GRANT + RLS (guru kelola, siswa baca/relasi sesuai kepemilikan).
- Bucket `lesson-media` (privat) + kebijakan `storage.objects`.
- Rahasia: `OPENAI_API_KEY` dan/atau `GEMINI_API_KEY` (diminta saat implementasi).
- Badge "baru" memakai penanda waktu kunjungan di perangkat (tanpa tabel) agar ringan.
- Verifikasi: build, cek alur login kedua peran via Playwright, dan uji rumus rekap dengan data contoh.

## Urutan Pengerjaan
1) Perbaikan peran + sidebar + greeting + login (cepat, berdampak besar)
2) Penggabungan pintasan + notifikasi + emoji peringkat
3) Migrasi DB + bucket
4) Materi/tugas/bank soal multimedia
5) Pengelompokan tugas + umpan balik media
6) Rumus rekap nilai + input adab + tanda UTS/UAS
7) Integrasi AI kunci sendiri (minta kunci)