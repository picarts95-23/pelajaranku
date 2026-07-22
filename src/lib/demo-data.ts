/**
 * Data dummy untuk mode /demo — tidak menyentuh Supabase sama sekali.
 * Semua nilai bisa diubah bebas; hanya dipakai untuk tur calon pembeli.
 */

export const demoClass = {
  id: "demo-class-1",
  name: "Kelas 6 Al-Fatih",
  code: "DEMO01",
  subjects: ["Matematika", "Bahasa Indonesia", "PAI"],
  students: 24,
};

export const demoTopStudents = [
  { name: "Aisyah Nur Hafizah", xp: 1420, level: 15, avatar: "🌟" },
  { name: "Muhammad Faris", xp: 1280, level: 13, avatar: "🚀" },
  { name: "Zahra Khalisa", xp: 1150, level: 12, avatar: "🌸" },
  { name: "Ahmad Ridho", xp: 980, level: 10, avatar: "⚡" },
  { name: "Fatimah Az-Zahra", xp: 860, level: 9, avatar: "🌙" },
];

export const demoAssignments = [
  { id: "d1", title: "Latihan Perkalian Pecahan", type: "quiz", dueDays: 2, submitted: 18, total: 24 },
  { id: "d2", title: "Rekam Bacaan Surat An-Naba (1-10)", type: "voice", dueDays: 5, submitted: 12, total: 24 },
  { id: "d3", title: "Foto Karya Kaligrafi", type: "image", dueDays: 7, submitted: 8, total: 24 },
  { id: "d4", title: "Ringkasan Cerita Rakyat", type: "link", dueDays: 3, submitted: 15, total: 24 },
];

export const demoAnnouncements = [
  {
    id: "a1",
    author: "Ustadz Ahmad",
    title: "Ulangan Tengah Semester Minggu Depan",
    body: "Anak-anak, siapkan diri untuk UTS Senin depan. Materi: bab 1-4. Jangan lupa membawa alat tulis lengkap.",
    reactions: { "👍": 18, "❤️": 12, "😊": 5 },
    comments: 7,
  },
  {
    id: "a2",
    author: "Ustadzah Sarah",
    title: "Selamat kepada Juara Kelas!",
    body: "Selamat kepada Aisyah, Muhammad, dan Zahra atas prestasi terbaik bulan ini. Terus semangat!",
    reactions: { "👍": 24, "❤️": 20, "🎉": 15 },
    comments: 12,
  },
];

export const demoTahfidz = [
  { name: "Aisyah Nur Hafizah", ziyadah: 92, murojaah: 88, tilawah: 90, daily: 90 },
  { name: "Muhammad Faris", ziyadah: 85, murojaah: 80, tilawah: 88, daily: 84 },
  { name: "Zahra Khalisa", ziyadah: 78, murojaah: 82, tilawah: 85, daily: 82 },
];
