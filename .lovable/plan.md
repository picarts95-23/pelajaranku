# Mode kuis interaktif Pelajaranku

## Hasil yang akan dibuat
- Guru dapat memilih **Mode Interaktif** saat memindahkan soal dari Bank Soal ke Tugas.
- Guru dapat menentukan batas waktu pengerjaan per soal; pengaturan tetap bisa direvisi dari detail tugas.
- Siswa melihat layar persiapan sebelum mulai, berisi jumlah soal, batas waktu, dan aturan pengerjaan.
- Saat kuis dimulai, soal tampil **satu per satu** dengan nomor soal, bilah progres, timer, pilihan jawaban yang ramah sentuh, serta tombol sebelumnya/berikutnya.
- Jawaban tersimpan sementara di perangkat selama pengerjaan agar tidak hilang bila tampilan tertutup atau koneksi sesaat tidak stabil.
- Saat waktu habis, kuis berpindah ke soal berikutnya; pada soal terakhir jawaban dikirim otomatis.
- Sebelum mengirim lebih awal, siswa melihat ringkasan soal yang sudah/belum dijawab.
- Hasil akhir tetap memakai sistem penilaian Pelajaranku yang sudah ada: soal objektif dinilai otomatis dan soal esai/audio/gambar menunggu guru.
- Kuis lama tetap menggunakan tampilan biasa sehingga tidak mengubah tugas yang sudah berjalan.

## Teknis
- Simpan pengaturan mode dan durasi di data tugas melalui perubahan database yang aman dan tetap kompatibel dengan data lama.
- Pisahkan layar pengerjaan interaktif menjadi komponen khusus agar halaman tugas siswa tetap mudah dirawat.
- Pertahankan fungsi deadline, hak akses guru/siswa, unggah audio/gambar, kunci jawaban rahasia, koreksi guru, XP, dan koin.
- Perbarui paket schema mandiri agar pembeli baru memperoleh struktur yang sama.
- Uji alur guru membuat/mengedit kuis, alur siswa di HP dan laptop, pengiriman otomatis oleh timer, penilaian, serta build aplikasi.
