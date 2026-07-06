## Tujuan

1. **Hapus fitur "Ubah audio ke teks"** (transkripsi) dari panel penilaian — guru cukup mendengarkan/melihat bukti, tanpa konversi ke teks.
2. **Pisahkan nilai akhir per jawaban**: setiap soal yang butuh koreksi manual (audio, gambar, esai) mendapat kolom nilai sendiri, karena tiap soal berbeda. Nilai Akhir tugas = jumlah nilai otomatis (soal objektif) + nilai manual tiap soal.

## Perubahan

### 1. `src/components/quiz-grade-dialog.tsx` (inti perubahan)
- **Hapus transkripsi audio:**
  - Buang tombol "Ubah audio ke teks / Transcribe audio" beserta tampilan hasil transkrip.
  - Hapus state `transcripts`, `transcribing`, fungsi `runTranscribe`, dan pemakaian `transcribeVoiceAnswer` (`useServerFn(transcribeVoiceAnswer)`). Audio tetap bisa diputar lewat `<audio controls>`, gambar tetap tampil.
  - Hapus impor `transcribeVoiceAnswer` (tetap pakai `signAnswerFile`).
- **Nilai per jawaban (per soal manual):**
  - Tambah state `manualScores: Record<number, number>` untuk menyimpan nilai tiap soal yang bertipe `essay | voice | image`.
  - Di kartu tiap soal manual, tampilkan input kecil "Nilai soal ini (/ poin per soal)" tepat di bawah bukti jawaban (audio/gambar/teks). Poin maksimum per soal = `quiz.max_score / questions.length` (dibulatkan), konsisten dengan aturan skor otomatis yang sudah ada.
  - **Nilai Akhir** dihitung otomatis = `auto.autoScore` (soal objektif) + total `manualScores`. Field "Nilai Akhir" tetap ada sebagai ringkasan yang bisa di-override manual bila perlu, tapi default-nya mengikuti akumulasi per-soal.
  - Perbarui ringkasan "Skor otomatis" agar juga menampilkan berapa poin manual yang sudah diisi vs. soal manual yang tersisa.
- Simpan (mutation `saveMut`) tetap menulis `score` (total) + `feedback` + `status='graded'` ke `submissions` seperti sekarang; opsional menyisipkan rincian nilai per soal ke dalam catatan agar terekam. Alur auto-record ke Mutaba'ah untuk Halaqoh tidak diubah.

### 2. `src/routes/_authenticated/guru.tugas.tsx`
- Perbarui teks penjelasan yang menyebut transkripsi: ganti "mendengar & menyalin jawaban audio" / "listen & transcribe audio answers" menjadi "mendengar & meninjau jawaban audio" (tanpa transkripsi).

### 3. `src/lib/transcribe.functions.ts`
- `transcribeVoiceAnswer` menjadi tidak terpakai. Biarkan file tetap ada karena masih mengekspor `signAnswerFile` yang dipakai di dua tempat; hapus hanya fungsi `transcribeVoiceAnswer` beserta konstanta `EXT_MIME` yang khusus untuknya, agar tidak ada kode mati.

## Catatan teknis
- Tidak ada perubahan skema database. Nilai per-soal dihitung dan diakumulasikan di sisi klien, hasil akhir tetap disimpan pada kolom `submissions.score` yang sudah ada.
- Path penilaian tugas biasa (`GradeRow`, satu audio/gambar → satu nilai) tidak berubah karena memang hanya satu jawaban per pengumpulan.
- Verifikasi dengan typecheck setelah perubahan.
