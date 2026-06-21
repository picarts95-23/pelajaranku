import { createContext, useContext } from "react";

export type Lang = "id" | "en";

export const translations = {
  appName: { id: "EduQuest Madrasah", en: "EduQuest Madrasah" },
  tagline: {
    id: "Perjalanan menuntut ilmu untuk ustadz/ah & santriwati",
    en: "A journey of knowledge for teachers & students",
  },
  heroTitle: {
    id: "Ubah Kelas Jadi Taman Ilmu",
    en: "Turn the Classroom Into a Garden of Knowledge",
  },
  heroSub: {
    id: "Tunaikan setiap amal belajar, kumpulkan kebaikan, kuasai mata pelajaran, dan jadi teladan di halaqahmu.",
    en: "Complete every learning task, gather rewards, master subjects, and become a role model in your halaqah.",
  },
  startQuest: { id: "Mulai Menuntut Ilmu", en: "Start Learning" },
  enterGuild: { id: "Masuk ke Halaqah", en: "Enter the Halaqah" },
  loginGuru: { id: "Masuk sebagai Ustadz/ah", en: "Sign in as Teacher" },
  loginSiswa: { id: "Masuk sebagai Santriwati", en: "Sign in as Student" },
  signupGuru: { id: "Daftar sebagai Ustadz/ah", en: "Sign up as Teacher" },
  signupSiswa: { id: "Daftar sebagai Santriwati", en: "Sign up as Student" },
  features: { id: "Fitur Unggulan", en: "Featured Tools" },
  feat1Title: { id: "Misi Harian", en: "Daily Missions" },
  feat1Desc: { id: "Tugas dan latihan jadi misi bermakna penuh ilmu & kebaikan.", en: "Tasks and exercises become meaningful missions full of knowledge & rewards." },
  feat2Title: { id: "Tantangan Kuis", en: "Quiz Challenges" },
  feat2Desc: { id: "Asah cepat & cermat bersama teman dalam tantangan kuis interaktif.", en: "Sharpen speed and focus with friends in interactive quiz challenges." },
  feat3Title: { id: "Halaqah Kelas", en: "Class Halaqah" },
  feat3Desc: { id: "Ustadz/ah memantau progres, mengelola tugas, dan administrasi kelas.", en: "Teachers track progress, manage tasks, and class admin." },
  feat4Title: { id: "Sistem Tingkatan Ilmu", en: "Knowledge Level System" },
  feat4Desc: { id: "Naik tingkat, raih badge, koleksi avatar muslimah pilihan.", en: "Level up, earn badges, collect curated muslimah avatars." },
  login: { id: "Masuk", en: "Sign in" },
  signup: { id: "Daftar", en: "Sign up" },
  email: { id: "Email", en: "Email" },
  password: { id: "Kata Sandi", en: "Password" },
  fullName: { id: "Nama Lengkap", en: "Full Name" },
  className: { id: "Kelas", en: "Class" },
  schoolId: { id: "NIS / NIP", en: "Student/Teacher ID" },
  subject: { id: "Mata Pelajaran", en: "Subject" },
  role: { id: "Peran", en: "Role" },
  guru: { id: "Guru", en: "Teacher" },
  siswa: { id: "Siswa", en: "Student" },
  logout: { id: "Keluar", en: "Sign out" },
  dashboard: { id: "Dashboard", en: "Dashboard" },
  welcome: { id: "Selamat datang kembali", en: "Welcome back" },
  level: { id: "Level", en: "Level" },
  xp: { id: "XP", en: "XP" },
  coins: { id: "Koin", en: "Coins" },
  seedDemo: { id: "Buat 2 akun demo (guru & siswa)", en: "Create 2 demo accounts (teacher & student)" },
  seedDone: { id: "Akun demo siap! Gunakan kredensial di bawah.", en: "Demo accounts ready! Use the credentials below." },
  demoCreds: { id: "Akun Demo", en: "Demo Accounts" },
  loadingPortal: { id: "Membuka gerbang menuju EduQuest…", en: "Opening the gate to EduQuest…" },
  myQuests: { id: "Misi Saya", en: "My Missions" },
  classRoster: { id: "Daftar Murid", en: "Class Roster" },
  assignments: { id: "Tugas", en: "Assignments" },
  submissions: { id: "Pengumpulan", en: "Submissions" },
  leaderboard: { id: "Papan Peringkat", en: "Leaderboard" },
  stats: { id: "Statistik", en: "Stats" },
  noData: { id: "Belum ada data", en: "No data yet" },

  // Nav
  navDashboard: { id: "Dashboard", en: "Dashboard" },
  navClasses: { id: "Kelas", en: "Classes" },
  navStudents: { id: "Siswa", en: "Students" },
  navAssignments: { id: "Tugas", en: "Assignments" },
  navAttendance: { id: "Presensi", en: "Attendance" },
  navJournal: { id: "Jurnal", en: "Journal" },
  navEvents: { id: "Kegiatan", en: "Events" },
  navQuestionBank: { id: "Bank Soal", en: "Question Bank" },
  navGamification: { id: "Gamifikasi", en: "Gamification" },
  navMyQuests: { id: "Quest Saya", en: "My Quests" },
  navGrades: { id: "Nilai Saya", en: "My Grades" },
  navBadges: { id: "Badge", en: "Badges" },
  navProfile: { id: "Profil", en: "Profile" },

  // CRUD/forms
  create: { id: "Buat", en: "Create" },
  edit: { id: "Ubah", en: "Edit" },
  delete: { id: "Hapus", en: "Delete" },
  save: { id: "Simpan", en: "Save" },
  cancel: { id: "Batal", en: "Cancel" },
  confirm: { id: "Konfirmasi", en: "Confirm" },
  submit: { id: "Kirim", en: "Submit" },
  search: { id: "Cari…", en: "Search…" },
  back: { id: "Kembali", en: "Back" },
  detail: { id: "Detail", en: "Details" },
  empty: { id: "Belum ada data di sini.", en: "Nothing here yet." },
  required: { id: "Wajib diisi", en: "Required" },
  yes: { id: "Ya", en: "Yes" },
  no: { id: "Tidak", en: "No" },

  // Classes
  className2: { id: "Nama Kelas", en: "Class Name" },
  classCode: { id: "Kode Kelas", en: "Class Code" },
  joinClass: { id: "Gabung Kelas", en: "Join Class" },
  enterCode: { id: "Masukkan kode kelas", en: "Enter class code" },
  academicYear: { id: "Tahun Ajaran", en: "Academic Year" },
  newClass: { id: "Kelas Baru", en: "New Class" },
  members: { id: "Anggota", en: "Members" },
  copyCode: { id: "Salin kode", en: "Copy code" },
  codeCopied: { id: "Kode disalin", en: "Code copied" },

  // Assignment
  title: { id: "Judul", en: "Title" },
  description: { id: "Deskripsi", en: "Description" },
  deadline: { id: "Deadline", en: "Deadline" },
  maxScore: { id: "Nilai Maks", en: "Max Score" },
  xpReward: { id: "Hadiah XP", en: "XP Reward" },
  coinReward: { id: "Hadiah Koin", en: "Coin Reward" },
  newAssignment: { id: "Tugas Baru", en: "New Assignment" },
  yourAnswer: { id: "Jawaban kamu", en: "Your answer" },
  fileUrl: { id: "Link file (opsional)", en: "File URL (optional)" },
  submitted: { id: "Terkirim", en: "Submitted" },
  graded: { id: "Sudah dinilai", en: "Graded" },
  notSubmitted: { id: "Belum dikumpul", en: "Not submitted" },
  giveGrade: { id: "Beri Nilai", en: "Grade" },
  score: { id: "Nilai", en: "Score" },
  feedback: { id: "Umpan Balik", en: "Feedback" },

  // Attendance
  date: { id: "Tanggal", en: "Date" },
  status: { id: "Status", en: "Status" },
  hadir: { id: "Hadir", en: "Present" },
  izin: { id: "Izin", en: "Excused" },
  sakit: { id: "Sakit", en: "Sick" },
  alpa: { id: "Alpa", en: "Absent" },
  recordAttendance: { id: "Catat Presensi", en: "Record Attendance" },
  selectClass: { id: "Pilih kelas", en: "Select a class" },

  // Journal & events
  topic: { id: "Topik / Materi", en: "Topic / Material" },
  notes: { id: "Catatan", en: "Notes" },
  newJournal: { id: "Jurnal Baru", en: "New Journal" },
  newEvent: { id: "Kegiatan Baru", en: "New Event" },
  location: { id: "Lokasi", en: "Location" },
  startAt: { id: "Mulai", en: "Starts" },
  endAt: { id: "Selesai", en: "Ends" },

  // Question bank
  question: { id: "Pertanyaan", en: "Question" },
  options: { id: "Pilihan (pisah baris)", en: "Options (one per line)" },
  answer: { id: "Jawaban", en: "Answer" },
  qType: { id: "Jenis", en: "Type" },
  difficulty: { id: "Kesulitan", en: "Difficulty" },
  easy: { id: "Mudah", en: "Easy" },
  medium: { id: "Sedang", en: "Medium" },
  hard: { id: "Sulit", en: "Hard" },
  multipleChoice: { id: "Pilihan Ganda", en: "Multiple Choice" },
  essay: { id: "Esai", en: "Essay" },
  trueFalse: { id: "Benar/Salah", en: "True/False" },
  newQuestion: { id: "Soal Baru", en: "New Question" },

  // Gamification
  badgeCatalog: { id: "Katalog Badge", en: "Badge Catalog" },
  earnedBadges: { id: "Badge Diraih", en: "Earned Badges" },
  locked: { id: "Terkunci", en: "Locked" },
  earned: { id: "Diraih", en: "Earned" },
  xpHistory: { id: "Riwayat XP", en: "XP History" },
  progress: { id: "Progres", en: "Progress" },

  // Student-facing labels
  questAvailable: { id: "Quest tersedia", en: "Available quests" },
  rewardSummary: { id: "Hadiah", en: "Reward" },
  due: { id: "Tenggat", en: "Due" },
  myClasses: { id: "Kelas Saya", en: "My Classes" },
} as const;

export type Key = keyof typeof translations;

export const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}>({ lang: "id", setLang: () => {}, t: (k) => translations[k].id });

export const useLang = () => useContext(LangContext);
