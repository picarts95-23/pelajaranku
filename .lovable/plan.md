## Rencana Implementasi EduQuest RPG — Fitur Lengkap

Membangun fitur lengkap untuk Guru & Siswa di atas fondasi auth + RPG theme yang sudah ada. Pekerjaan dibagi ke 4 fase agar manageable dan bisa diuji bertahap.

### Fase 1 — Skema Database & Fondasi Backend

Tambah tabel berikut di Lovable Cloud (semua dengan RLS + GRANT):

```text
classes              guru bikin kelas (nama, kode_unik, tahun_ajaran, deskripsi)
class_enrollments    siswa ↔ kelas (many-to-many, join via kode kelas)
assignments          tugas (judul, deskripsi, deadline, max_score, xp_reward, coin_reward)
submissions          pengumpulan tugas siswa (file/teks, nilai, feedback, status)
attendance           presensi (tanggal, status: hadir/izin/sakit/alpa)
journals             jurnal pembelajaran guru (tanggal, materi, catatan)
events               kegiatan/event kelas (judul, tanggal, lokasi, deskripsi)
question_bank        bank soal (pertanyaan, tipe: pg/essay, opsi, jawaban, difficulty)
badges               katalog badge (nama, ikon, deskripsi, syarat)
user_badges          badge yg sudah diraih siswa
xp_transactions      log perolehan XP/koin (sumber, jumlah, timestamp)
```

Trigger: saat `submissions` dinilai → tambah XP & koin ke `profiles`, hitung ulang level, cek auto-grant badge.

### Fase 2 — Server Functions (RPC)

Buat `*.functions.ts` di `src/lib/`:
- `classes.functions.ts` — CRUD kelas + join-by-code untuk siswa
- `students.functions.ts` — list siswa per kelas, detail progress
- `assignments.functions.ts` — CRUD tugas, list per kelas/siswa
- `submissions.functions.ts` — submit (siswa), grade (guru)
- `attendance.functions.ts` — bulk-mark presensi harian
- `journals.functions.ts` — CRUD jurnal
- `events.functions.ts` — CRUD event
- `questions.functions.ts` — CRUD bank soal
- `gamification.functions.ts` — leaderboard, badge list, XP history

Semua pakai `requireSupabaseAuth` + cek role via `has_role()`.

### Fase 3 — UI Dashboard Guru

Route di `src/routes/_authenticated/guru/`:
- `dashboard.tsx` — kartu statistik (jumlah kelas, siswa, tugas pending grading, presensi hari ini) + chart aktivitas
- `kelas.tsx` + `kelas.$id.tsx` — list/detail kelas
- `siswa.tsx` — manajemen siswa
- `tugas.tsx` — buat/grade tugas
- `presensi.tsx` — input presensi
- `jurnal.tsx` — jurnal harian
- `event.tsx` — kegiatan
- `bank-soal.tsx` — bank soal
- `gamifikasi.tsx` — kelola badge, lihat leaderboard

Layout: sidebar nav anime-RPG dengan ikon, header dengan info guru.

### Fase 4 — UI Dashboard Siswa (RPG)

Route di `src/routes/_authenticated/siswa/`:
- `dashboard.tsx` — kartu karakter (avatar, level, XP bar, koin), quest aktif (tugas due), badge terbaru
- `tugas.tsx` — list quest (tugas) dengan reward XP/koin, submit
- `nilai.tsx` — riwayat nilai & feedback
- `progress.tsx` — chart progress XP, statistik belajar
- `badge.tsx` — koleksi badge (raih/locked)
- `leaderboard.tsx` — top siswa per kelas

Visualisasi RPG: progress bar bergaya HP/MP, ikon quest, animasi level up.

### Bahasa & Tema

Semua UI bilingual ID/EN dengan toggle di header (i18n context sederhana). Pertahankan tema anime/JRPG cerah yang sudah ada.

### Catatan Teknis

- Bank soal Fase 1 fokus ke CRUD; mode kuis interaktif (timer, scoring otomatis) bisa fase berikut.
- File upload submission pakai Lovable Cloud storage bucket baru `submissions`.
- Chart pakai `recharts` (sudah umum di stack).
- Karena scope besar, saya akan implement bertahap dan minta review setelah setiap fase agar Anda bisa cek progress.

**Mulai dari Fase 1 (skema DB) setelah Anda setujui rencana ini.**
