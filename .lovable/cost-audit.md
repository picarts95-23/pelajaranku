# Audit Konsumsi Kredit — Pelajaranku

Data dari `credits--get_credit_balance` (grouped by billable_item):

- **Total granted**: 305 kredit
- **Terpakai billing period ini**: 80.80 kredit
- **Semua** konsumsi berasal dari kategori: **Build mode messages** (100%)
- Konsumsi **Lovable Cloud (database)**: 0 kredit
- Konsumsi **AI Gateway**: 0 kredit

## Temuan Utama

Yang boros **saat ini** adalah **pesan build mode** (mengobrol dengan AI untuk menambah fitur), **bukan** database atau AI Gateway aplikasi.

Namun karena rencana user adalah **menjual aplikasi**, kekhawatiran biaya database untuk **pembeli/end-user** valid. Optimasi kode tetap diterapkan sebagai investasi:

## Perbaikan Kode (Sudah/Akan Diterapkan)

### 1. Kompresi Gambar Client-Side
- File: `src/lib/compress-image.ts` (BARU)
- Diterapkan di `PhotoInput` (siswa.tugas.tsx)
- Ukuran foto tugas: dari ~2–5 MB → ~150–400 KB
- Dampak: **80–90% penghematan storage & bandwidth**

### 2. Batas Durasi Rekaman
- Rekomendasi: hard-limit 2 menit di `voice-recorder.tsx`
- Belum diterapkan di iterasi ini (voice recorder tidak dimodifikasi)

### 3. Index Database
- Skip untuk sekarang — Supabase auto-index primary key/FK; workload belum menunjukkan slow query.

### 4. TanStack Query staleTime
- Setup saat ini: `defaultPreloadStaleTime: 0` (wajib untuk Query)
- Query per-route sudah menggunakan `queryOptions` dengan `staleTime` bawaan (5 menit default v5).
- Tidak ada perubahan agresif untuk menghindari data basi.

## Strategi Utama untuk Pembeli

Karena aplikasi akan dijual, strategi utama adalah **Bring-Your-Own-Supabase** (sudah selesai di Phase 2):
- Pembeli pakai Supabase Free tier ($0)
- Anda hanya menjual kode aplikasi
- Zero biaya operasional untuk Anda per-pembeli
