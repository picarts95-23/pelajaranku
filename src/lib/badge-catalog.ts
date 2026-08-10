// Katalog badge siap pakai: prestasi akademik (per mata pelajaran) & non-akademik.
// Guru cukup memilih badge dari katalog, lalu memberikannya ke siswa atau seluruh kelas.

export type CatalogBadge = {
  name: string;
  description: string;
  icon: string;
  xp_requirement?: number;
};

export type CatalogGroup = {
  key: string;
  label: string;
  badges: CatalogBadge[];
};

export const BADGE_CATALOG: CatalogGroup[] = [
  {
    key: "akademik-umum",
    label: "Akademik Umum",
    badges: [
      { name: "Juara Kelas", description: "Peringkat 1 di kelas pada periode penilaian.", icon: "🏆" },
      { name: "Peringkat 2 Kelas", description: "Peringkat 2 di kelas pada periode penilaian.", icon: "🥈" },
      { name: "Peringkat 3 Kelas", description: "Peringkat 3 di kelas pada periode penilaian.", icon: "🥉" },
      { name: "Nilai Sempurna", description: "Meraih nilai 100 pada sebuah tugas atau ujian.", icon: "💯" },
      { name: "Bintang Kenaikan Nilai", description: "Peningkatan nilai paling signifikan.", icon: "📈" },
      { name: "Tugas Tepat Waktu", description: "Mengumpulkan semua tugas sebelum deadline.", icon: "⏰" },
      { name: "Rajin Membaca", description: "Aktif membaca materi dan buku pelajaran.", icon: "📚" },
      { name: "Penanya Terbaik", description: "Sering mengajukan pertanyaan berkualitas di kelas.", icon: "🙋" },
      { name: "Pemikir Kritis", description: "Menunjukkan analisis dan penalaran yang tajam.", icon: "🧠" },
      { name: "Pekerja Keras", description: "Konsisten berusaha meski materi sulit.", icon: "💪" },
    ],
  },
  {
    key: "mapel",
    label: "Prestasi Mata Pelajaran",
    badges: [
      { name: "Ahli Matematika", description: "Unggul dalam Matematika dan pemecahan soal hitung.", icon: "➗" },
      { name: "Jago Berhitung Cepat", description: "Cepat dan tepat dalam operasi hitung.", icon: "🔢" },
      { name: "Ilmuwan Cilik (IPA)", description: "Unggul dalam Ilmu Pengetahuan Alam & praktikum.", icon: "🔬" },
      { name: "Peneliti Muda", description: "Menyelesaikan proyek penelitian/eksperimen dengan baik.", icon: "🧪" },
      { name: "Penjelajah IPS", description: "Unggul dalam Ilmu Pengetahuan Sosial.", icon: "🌍" },
      { name: "Ahli Sejarah", description: "Menguasai materi sejarah dengan baik.", icon: "🏛️" },
      { name: "Sastrawan Bahasa Indonesia", description: "Unggul dalam menulis dan berbahasa Indonesia.", icon: "✍️" },
      { name: "English Star", description: "Unggul dalam Bahasa Inggris (speaking/writing).", icon: "🔤" },
      { name: "Bintang Bahasa Arab", description: "Unggul dalam Bahasa Arab.", icon: "🕌" },
      { name: "Ahli Fiqih", description: "Menguasai materi Fiqih dengan baik.", icon: "📜" },
      { name: "Hafidz/Hafidzah Qur'an", description: "Mencapai target hafalan Al-Qur'an.", icon: "📖" },
      { name: "Tartil & Tajwid Terbaik", description: "Bacaan tartil dan tajwid paling baik.", icon: "📿" },
      { name: "Iqro Naik Jilid", description: "Berhasil naik jilid Iqro.", icon: "🌟" },
      { name: "Ahli Akidah Akhlak", description: "Unggul dalam Akidah Akhlak.", icon: "🤲" },
      { name: "Master Komputer/TIK", description: "Unggul dalam teknologi informasi & komputer.", icon: "💻" },
      { name: "Seniman Kelas", description: "Berprestasi dalam Seni Budaya (gambar/kerajinan).", icon: "🎨" },
      { name: "Bintang Olahraga (PJOK)", description: "Berprestasi dalam Pendidikan Jasmani.", icon: "⚽" },
      { name: "Ahli Geografi", description: "Menguasai peta, iklim, dan materi geografi.", icon: "🗺️" },
      { name: "Bintang PPKn", description: "Unggul dalam Pendidikan Pancasila & Kewarganegaraan.", icon: "🎗️" },
      { name: "Ahli Biologi", description: "Unggul dalam materi biologi dan makhluk hidup.", icon: "🌿" },
      { name: "Ahli Fisika", description: "Unggul dalam materi fisika dan pengukuran.", icon: "⚡" },
      { name: "Ahli Kimia", description: "Unggul dalam materi kimia dan reaksi zat.", icon: "⚗️" },
      { name: "Juara Kuis", description: "Skor tertinggi pada kuis kelas.", icon: "🎯" },
    ],
  },
  {
    key: "adab",
    label: "Adab & Akhlak",
    badges: [
      { name: "Adab Terbaik", description: "Menunjukkan adab dan sopan santun terbaik.", icon: "❤️" },
      { name: "Jujur & Amanah", description: "Selalu jujur dan dapat dipercaya.", icon: "🤝" },
      { name: "Rajin Shalat", description: "Disiplin menjalankan shalat berjamaah.", icon: "☪️" },
      { name: "Ramah & Penyayang", description: "Ramah kepada guru dan teman.", icon: "😊" },
      { name: "Suka Menolong", description: "Aktif membantu teman yang kesulitan.", icon: "🫶" },
      { name: "Sabar & Tangguh", description: "Sabar menghadapi kesulitan belajar.", icon: "🕊️" },
      { name: "Peduli Kebersihan", description: "Menjaga kebersihan kelas dan lingkungan.", icon: "🧹" },
    ],
  },
  {
    key: "kehadiran",
    label: "Kedisiplinan & Kehadiran",
    badges: [
      { name: "Kehadiran Sempurna", description: "Hadir penuh tanpa absen dalam satu bulan.", icon: "🗓️" },
      { name: "Selalu Tepat Waktu", description: "Tidak pernah terlambat masuk kelas.", icon: "⌚" },
      { name: "Seragam Rapi", description: "Selalu berpakaian rapi dan sesuai aturan.", icon: "🎽" },
      { name: "Piket Teladan", description: "Melaksanakan tugas piket dengan baik.", icon: "🧺" },
      { name: "Streak 7 Hari", description: "Aktif belajar 7 hari berturut-turut.", icon: "🔥" },
    ],
  },
  {
    key: "non-akademik",
    label: "Non Akademik & Bakat",
    badges: [
      { name: "Juara Lomba", description: "Meraih kejuaraan dalam lomba sekolah/luar sekolah.", icon: "🏅" },
      { name: "Pemimpin Hebat", description: "Menjadi ketua kelompok/kelas yang inspiratif.", icon: "👑" },
      { name: "Tim Solid", description: "Kerja sama kelompok yang sangat baik.", icon: "🙌" },
      { name: "Orator Muda", description: "Berani tampil pidato/presentasi di depan kelas.", icon: "🎤" },
      { name: "Bintang Kaligrafi", description: "Karya kaligrafi/tulisan indah terbaik.", icon: "🖌️" },
      { name: "Bintang Nasyid", description: "Berprestasi dalam nasyid/seni suara.", icon: "🎵" },
      { name: "Atlet Sekolah", description: "Mewakili sekolah dalam ajang olahraga.", icon: "🏃" },
      { name: "Pramuka Tangguh", description: "Aktif dan berprestasi di kegiatan kepramukaan.", icon: "⛺" },
      { name: "Kreator Kreatif", description: "Menghasilkan karya kreatif yang menonjol.", icon: "💡" },
      { name: "Duta Literasi", description: "Menginspirasi teman untuk gemar membaca.", icon: "📗" },
      { name: "Relawan Sosial", description: "Aktif dalam kegiatan sosial dan bakti masyarakat.", icon: "🤗" },
      { name: "Sahabat Lingkungan", description: "Aktif menjaga dan menanam penghijauan.", icon: "🌱" },
    ],
  },
  {
    key: "progres",
    label: "Progres & XP",
    badges: [
      { name: "Langkah Pertama", description: "Menyelesaikan tugas pertama.", icon: "✨", xp_requirement: 50 },
      { name: "Petualang XP", description: "Mengumpulkan 250 XP.", icon: "🚀", xp_requirement: 250 },
      { name: "Ksatria XP", description: "Mengumpulkan 500 XP.", icon: "🛡️", xp_requirement: 500 },
      { name: "Legenda XP", description: "Mengumpulkan 1000 XP.", icon: "💎", xp_requirement: 1000 },
      { name: "Kolektor Koin", description: "Mengumpulkan banyak koin dari misi.", icon: "🪙" },
      { name: "Misi Tuntas", description: "Menyelesaikan seluruh misi pada satu periode.", icon: "🏁" },
    ],
  },
];

export const CATALOG_TOTAL = BADGE_CATALOG.reduce((n, g) => n + g.badges.length, 0);
