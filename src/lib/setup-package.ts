// Client-side helper that assembles the "Paket Setup Lengkap" ZIP:
// panduan pembeli + panduan self-hosting + SQL schema + template .env +
// README singkat + langkah aktivasi. Pembeli tinggal ekstrak & ikuti.
import JSZip from "jszip";
import panduanPembeliMd from "../../docs/panduan-pembeli.md?raw";
import selfHostingMd from "../../docs/self-hosting.md?raw";

const README = `# Paket Setup Lengkap — Pelajaranku

Selamat datang! Paket ini berisi semua yang Anda butuhkan untuk memasang
aplikasi Pelajaranku memakai database Supabase sendiri (gratis) dan
mengaktifkan lisensi Anda.

## Isi paket

1. \`00-MULAI-DISINI.txt\`       — ringkas 6 langkah, dibuka di Notepad
2. \`01-panduan-pembeli.md\`     — panduan lengkap untuk pembeli awam
3. \`02-panduan-self-hosting.md\` — detail teknis Bring-Your-Own-Supabase
4. \`03-schema.sql\`             — SQL lengkap (tabel, RLS, fungsi) untuk Supabase
5. \`04-env-template.txt\`       — isian variabel yang akan Anda tempel di Setup Wizard
6. \`05-langkah-aktivasi.md\`    — cara memasukkan kode aktivasi produk

## Urutan singkat

1. Baca \`00-MULAI-DISINI.txt\`.
2. Buat project gratis di supabase.com.
3. Jalankan \`03-schema.sql\` di SQL Editor Supabase Anda.
4. Salin URL & anon key ke Setup Wizard aplikasi (\`/setup\`).
5. Isi service key (dari Project Settings → API).
6. Aktifkan lisensi di \`/aktivasi\` sesuai \`05-langkah-aktivasi.md\`.

Semua langkah dijelaskan dengan bahasa sederhana di file-file berikutnya.
`;

const QUICKSTART = `PELAJARANKU — 6 LANGKAH CEPAT SETUP
=====================================

1. Buat akun gratis di https://supabase.com (klik "Start your project").
2. Bikin project baru. Simpan password database Anda.
3. Buka menu "SQL Editor" -> New query -> tempel isi file 03-schema.sql
   -> klik RUN. Tunggu sampai "Success".
4. Buka menu "Project Settings" -> API. Salin:
   - Project URL          (contoh: https://xxxx.supabase.co)
   - anon public key      (kunci panjang yang boleh publik)
   - service_role key     (kunci rahasia — jangan disebar)
5. Buka aplikasi Pelajaranku -> halaman /setup. Tempel ketiga nilai di
   atas. Klik "Uji Koneksi" sampai semua centang hijau.
6. Buka /aktivasi -> tempel kode lisensi Anda (format PJKU-XXXX-XXXX-XXXX).
   Selesai! Login sebagai admin dengan email yang Anda tetapkan di
   ADMIN_EMAIL.

Kalau macet: buka 01-panduan-pembeli.md — ada solusi gambar per langkah.
`;

const ENV_TEMPLATE = `# Isi nilai di bawah, lalu tempel di Setup Wizard aplikasi (/setup).
# JANGAN mengunggah file ini ke internet — service_role adalah kunci rahasia.

# --- Wajib ---
VITE_SUPABASE_URL=https://<project-anda>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-public-key-dari-supabase>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-dari-supabase>

# --- Admin & akses guru ---
# Email berikut akan otomatis menjadi admin saat pertama kali login.
ADMIN_EMAIL=admin@sekolahanda.sch.id

# Kode rahasia untuk mendaftarkan diri sebagai guru (bebas Anda tentukan).
TEACHER_ACCESS_CODE=guru-2026-rahasia

# --- Opsional (biarkan kosong jika tidak dipakai) ---
GOOGLE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
`;

const AKTIVASI_MD = `# Langkah Aktivasi Lisensi

Setelah database (Supabase) dan Setup Wizard beres, aktifkan lisensi Anda:

## 1. Buka halaman aktivasi
Kunjungi \`https://<domain-anda>/aktivasi\` di browser.

## 2. Tempel kode lisensi
Format kode: \`PJKU-XXXX-XXXX-XXXX\` (4 blok, huruf kapital & angka).
Kode ini Anda terima dari penjual setelah pembayaran.

## 3. Klik "Aktifkan"
Aplikasi akan memverifikasi kode secara lokal (SHA-256) dan menyimpan
status aktif di browser. Anda hanya perlu melakukan ini satu kali per
perangkat admin.

## 4. Login sebagai admin
Buka \`/auth\`, daftar dengan email yang Anda tetapkan di
\`ADMIN_EMAIL\`. Sistem otomatis menaikkan role Anda menjadi admin
saat login pertama.

## 5. Undang guru
Dari Panel Admin (\`/admin\`) buka tab **Undangan Guru** → **Buat Kode**.
Bagikan tautan aktivasi ke masing-masing guru — mereka cukup membuka
tautan, mendaftar akun, dan role guru langsung menempel.

## Troubleshooting

- **Kode ditolak** → cek huruf O vs angka 0 dan huruf I vs angka 1.
- **Email admin tidak jadi admin** → pastikan \`ADMIN_EMAIL\` di Setup
  Wizard sama persis (huruf kecil semua) dengan email pendaftaran.
- **Undangan guru gagal** → cek koneksi Supabase di \`/setup\`; harus
  hijau semua.
`;

export type SetupPackageOptions = {
  sql: string;
  generatedAt: string;
};

export async function buildSetupPackageZip(opts: SetupPackageOptions): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("pelajaranku-setup")!;
  folder.file("README.md", README);
  folder.file("00-MULAI-DISINI.txt", QUICKSTART);
  folder.file("01-panduan-pembeli.md", panduanPembeliMd);
  folder.file("02-panduan-self-hosting.md", selfHostingMd);
  folder.file(
    "03-schema.sql",
    `-- Pelajaranku — skema Supabase lengkap\n-- Dibuat: ${opts.generatedAt}\n-- Jalankan di SQL Editor Supabase Anda.\n\n${opts.sql}\n`,
  );
  folder.file("04-env-template.txt", ENV_TEMPLATE);
  folder.file("05-langkah-aktivasi.md", AKTIVASI_MD);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
