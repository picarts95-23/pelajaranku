# Rencana: Edit dan Hapus Kegiatan

## Hasil yang akan dibuat
- Guru dapat membuka kegiatan dari tampilan daftar maupun kalender.
- Form kegiatan yang sama digunakan untuk membuat dan mengedit, dengan data lama terisi otomatis.
- Guru dapat mengubah kelas, judul, deskripsi, lokasi, tanggal/jam, serta tautan kuis atau game.
- Setiap kegiatan memiliki tombol hapus dengan konfirmasi agar tidak terhapus tanpa sengaja.
- Setelah disimpan atau dihapus, tampilan daftar, kalender aplikasi, dan jumlah kegiatan pada status sinkron langsung diperbarui.

## Detail teknis
- Tambahkan status kegiatan yang sedang diedit dan dialog detail dari pilihan tanggal kalender.
- Gunakan aturan akses database yang sudah ada agar hanya guru pemilik kegiatan yang dapat mengubah atau menghapusnya.
- Tampilkan pesan berhasil atau gagal untuk proses edit dan hapus.
- Pertahankan alur pembuatan kegiatan dan langganan Google Kalender yang sudah berjalan.

## Verifikasi
- Uji membuat, membuka dari kalender, mengedit, dan menghapus kegiatan.
- Pastikan perubahan muncul pada mode kalender dan daftar tanpa memuat ulang halaman.
- Periksa tampilan pada HP dan desktop serta pastikan aplikasi tetap bebas error.
