import { createContext, useContext } from "react";

export type Lang = "id" | "en" | "ar";

export const LANG_OPTIONS: { code: Lang; label: string; native: string; dir: "ltr" | "rtl" }[] = [
  { code: "id", label: "ID", native: "Indonesia", dir: "ltr" },
  { code: "en", label: "EN", native: "English", dir: "ltr" },
  { code: "ar", label: "AR", native: "العربية", dir: "rtl" },
];

export const translations = {
  appName: { id: "EduQuest Academy", en: "EduQuest Academy", ar: "أكاديمية إديوكويست" },
  tagline: {
    id: "Petualangan menuntut ilmu untuk guru & siswi",
    en: "A learning quest for teachers & students",
    ar: "رحلة طلب العلم للمعلمين والطلاب",
  },
  heroTitle: {
    id: "Mulai Quest, Raih Ilmu, Jadi Teladan",
    en: "Start the Quest, Earn Knowledge, Be a Role Model",
    ar: "ابدأ المهمة، انل العلم، كن قدوة",
  },
  heroSub: {
    id: "Tunaikan misi belajar harian, naik level, kumpulkan koin kebaikan, dan taklukkan setiap mata pelajaran bersama halaqahmu.",
    en: "Complete daily learning quests, level up, collect reward coins, and conquer every subject with your halaqah.",
    ar: "أنجز المهام اليومية، ارتقِ بالمستوى، اجمع عملات المكافأة، واستوعب كل المواد مع حلقتك.",
  },
  startQuest: { id: "Mulai Quest", en: "Start the Quest", ar: "ابدأ المهمة" },
  enterGuild: { id: "Masuk Gerbang Akademi", en: "Enter the Academy Gate", ar: "ادخل بوابة الأكاديمية" },
  loginGuru: { id: "Masuk sebagai Guru", en: "Sign in as Teacher", ar: "الدخول كمعلم" },
  loginSiswa: { id: "Masuk sebagai Siswi", en: "Sign in as Student", ar: "الدخول كطالبة" },
  signupGuru: { id: "Daftar sebagai Guru", en: "Sign up as Teacher", ar: "التسجيل كمعلم" },
  signupSiswa: { id: "Daftar sebagai Siswi", en: "Sign up as Student", ar: "التسجيل كطالبة" },
  features: { id: "Fitur Unggulan", en: "Featured Tools", ar: "المزايا المميزة" },
  feat1Title: { id: "Misi Harian", en: "Daily Quests", ar: "مهام يومية" },
  feat1Desc: { id: "Tugas & latihan berubah jadi misi bermakna penuh ilmu & pahala.", en: "Tasks and exercises turn into meaningful quests full of knowledge & reward.", ar: "تتحول الواجبات والتمارين إلى مهام نافعة مليئة بالعلم والأجر." },
  feat2Title: { id: "Tantangan Kuis", en: "Quiz Challenges", ar: "تحديات الاختبارات" },
  feat2Desc: { id: "Adu cepat & cermat bersama teman halaqah dalam kuis interaktif.", en: "Race friends in interactive quiz challenges.", ar: "تنافس مع أصدقاء الحلقة في اختبارات تفاعلية." },
  feat3Title: { id: "Halaqah Kelas", en: "Class Halaqah", ar: "حلقة الفصل" },
  feat3Desc: { id: "Guru memantau progres, mengelola misi, dan administrasi kelas.", en: "Teachers track progress, manage quests, and class admin.", ar: "يتابع المعلم التقدم ويدير المهام وشؤون الفصل." },
  feat4Title: { id: "Level & Badge Ilmu", en: "Level & Knowledge Badges", ar: "المستويات وشارات العلم" },
  feat4Desc: { id: "Naik level, raih badge, koleksi avatar muslimah pilihan.", en: "Level up, earn badges, collect curated muslimah avatars.", ar: "ارتقِ بالمستوى، انل الشارات، واجمع شخصيات مسلمة مختارة." },
  login: { id: "Masuk", en: "Sign in", ar: "تسجيل الدخول" },
  signup: { id: "Daftar", en: "Sign up", ar: "إنشاء حساب" },
  email: { id: "Email", en: "Email", ar: "البريد الإلكتروني" },
  password: { id: "Kata Sandi", en: "Password", ar: "كلمة المرور" },
  fullName: { id: "Nama Lengkap", en: "Full Name", ar: "الاسم الكامل" },
  className: { id: "Kelas", en: "Class", ar: "الفصل" },
  schoolId: { id: "NIS / NIP", en: "Student/Teacher ID", ar: "رقم الطالب/المعلم" },
  subject: { id: "Mata Pelajaran", en: "Subject", ar: "المادة" },
  role: { id: "Peran", en: "Role", ar: "الدور" },
  guru: { id: "Guru", en: "Teacher", ar: "معلم" },
  siswa: { id: "Siswi", en: "Student", ar: "طالبة" },
  logout: { id: "Keluar", en: "Sign out", ar: "تسجيل الخروج" },
  dashboard: { id: "Dashboard", en: "Dashboard", ar: "لوحة التحكم" },
  welcome: { id: "Selamat datang kembali", en: "Welcome back", ar: "مرحبًا بعودتك" },
  level: { id: "Level", en: "Level", ar: "المستوى" },
  xp: { id: "XP", en: "XP", ar: "نقاط الخبرة" },
  coins: { id: "Koin", en: "Coins", ar: "العملات" },
  seedDemo: { id: "Buat 2 akun demo (guru & siswi)", en: "Create 2 demo accounts (teacher & student)", ar: "إنشاء حسابين تجريبيين (معلم وطالبة)" },
  seedDone: { id: "Akun demo siap! Gunakan kredensial di bawah.", en: "Demo accounts ready! Use the credentials below.", ar: "الحسابات التجريبية جاهزة! استخدم بيانات الدخول أدناه." },
  demoCreds: { id: "Akun Demo", en: "Demo Accounts", ar: "حسابات تجريبية" },
  loadingPortal: { id: "Membuka Gerbang Akademi EduQuest…", en: "Opening the EduQuest Academy Gate…", ar: "يتم فتح بوابة أكاديمية إديوكويست…" },
  myQuests: { id: "Misi Saya", en: "My Quests", ar: "مهامي" },
  classRoster: { id: "Daftar Siswi", en: "Class Roster", ar: "قائمة الطالبات" },
  assignments: { id: "Tugas", en: "Assignments", ar: "الواجبات" },
  submissions: { id: "Pengumpulan", en: "Submissions", ar: "التسليمات" },
  leaderboard: { id: "Papan Peringkat", en: "Leaderboard", ar: "لوحة المتصدرين" },
  stats: { id: "Statistik", en: "Stats", ar: "الإحصائيات" },
  noData: { id: "Belum ada data", en: "No data yet", ar: "لا توجد بيانات بعد" },

  // Nav
  navDashboard: { id: "Dashboard", en: "Dashboard", ar: "لوحة التحكم" },
  navClasses: { id: "Kelas", en: "Classes", ar: "الفصول" },
  navStudents: { id: "Siswa", en: "Students", ar: "الطلاب" },
  navAssignments: { id: "Tugas", en: "Assignments", ar: "الواجبات" },
  navAttendance: { id: "Presensi", en: "Attendance", ar: "الحضور" },
  navJournal: { id: "Jurnal", en: "Journal", ar: "اليوميات" },
  navEvents: { id: "Kegiatan", en: "Events", ar: "الفعاليات" },
  navQuestionBank: { id: "Bank Soal", en: "Question Bank", ar: "بنك الأسئلة" },
  navGamification: { id: "Gamifikasi", en: "Gamification", ar: "التحفيز" },
  navMyQuests: { id: "Misi Saya", en: "My Quests", ar: "مهامي" },
  navGrades: { id: "Nilai Saya", en: "My Grades", ar: "درجاتي" },
  navBadges: { id: "Badge", en: "Badges", ar: "الشارات" },
  navProfile: { id: "Profil", en: "Profile", ar: "الملف الشخصي" },

  // CRUD/forms
  create: { id: "Buat", en: "Create", ar: "إنشاء" },
  edit: { id: "Ubah", en: "Edit", ar: "تعديل" },
  delete: { id: "Hapus", en: "Delete", ar: "حذف" },
  save: { id: "Simpan", en: "Save", ar: "حفظ" },
  cancel: { id: "Batal", en: "Cancel", ar: "إلغاء" },
  confirm: { id: "Konfirmasi", en: "Confirm", ar: "تأكيد" },
  submit: { id: "Kirim", en: "Submit", ar: "إرسال" },
  search: { id: "Cari…", en: "Search…", ar: "بحث…" },
  back: { id: "Kembali", en: "Back", ar: "رجوع" },
  detail: { id: "Detail", en: "Details", ar: "التفاصيل" },
  empty: { id: "Belum ada data di sini.", en: "Nothing here yet.", ar: "لا يوجد شيء هنا بعد." },
  required: { id: "Wajib diisi", en: "Required", ar: "مطلوب" },
  yes: { id: "Ya", en: "Yes", ar: "نعم" },
  no: { id: "Tidak", en: "No", ar: "لا" },

  // Classes
  className2: { id: "Nama Kelas", en: "Class Name", ar: "اسم الفصل" },
  classCode: { id: "Kode Kelas", en: "Class Code", ar: "رمز الفصل" },
  joinClass: { id: "Gabung Kelas", en: "Join Class", ar: "الانضمام للفصل" },
  enterCode: { id: "Masukkan kode kelas", en: "Enter class code", ar: "أدخل رمز الفصل" },
  academicYear: { id: "Tahun Ajaran", en: "Academic Year", ar: "العام الدراسي" },
  newClass: { id: "Kelas Baru", en: "New Class", ar: "فصل جديد" },
  members: { id: "Anggota", en: "Members", ar: "الأعضاء" },
  copyCode: { id: "Salin kode", en: "Copy code", ar: "نسخ الرمز" },
  codeCopied: { id: "Kode disalin", en: "Code copied", ar: "تم نسخ الرمز" },

  // Assignment
  title: { id: "Judul", en: "Title", ar: "العنوان" },
  description: { id: "Deskripsi", en: "Description", ar: "الوصف" },
  deadline: { id: "Deadline", en: "Deadline", ar: "الموعد النهائي" },
  maxScore: { id: "Nilai Maks", en: "Max Score", ar: "الدرجة القصوى" },
  xpReward: { id: "Hadiah XP", en: "XP Reward", ar: "مكافأة الخبرة" },
  coinReward: { id: "Hadiah Koin", en: "Coin Reward", ar: "مكافأة العملات" },
  newAssignment: { id: "Tugas Baru", en: "New Assignment", ar: "واجب جديد" },
  yourAnswer: { id: "Jawaban kamu", en: "Your answer", ar: "إجابتك" },
  fileUrl: { id: "Link file (opsional)", en: "File URL (optional)", ar: "رابط الملف (اختياري)" },
  submitted: { id: "Terkirim", en: "Submitted", ar: "تم الإرسال" },
  graded: { id: "Sudah dinilai", en: "Graded", ar: "تم التقييم" },
  notSubmitted: { id: "Belum dikumpul", en: "Not submitted", ar: "لم يُسلَّم" },
  giveGrade: { id: "Beri Nilai", en: "Grade", ar: "ضع درجة" },
  score: { id: "Nilai", en: "Score", ar: "الدرجة" },
  feedback: { id: "Umpan Balik", en: "Feedback", ar: "التغذية الراجعة" },

  // Attendance
  date: { id: "Tanggal", en: "Date", ar: "التاريخ" },
  status: { id: "Status", en: "Status", ar: "الحالة" },
  hadir: { id: "Hadir", en: "Present", ar: "حاضر" },
  izin: { id: "Izin", en: "Excused", ar: "مأذون" },
  sakit: { id: "Sakit", en: "Sick", ar: "مريض" },
  alpa: { id: "Alpa", en: "Absent", ar: "غائب" },
  recordAttendance: { id: "Catat Presensi", en: "Record Attendance", ar: "تسجيل الحضور" },
  selectClass: { id: "Pilih kelas", en: "Select a class", ar: "اختر الفصل" },

  // Journal & events
  topic: { id: "Topik / Materi", en: "Topic / Material", ar: "الموضوع / المادة" },
  notes: { id: "Catatan", en: "Notes", ar: "ملاحظات" },
  newJournal: { id: "Jurnal Baru", en: "New Journal", ar: "يومية جديدة" },
  newEvent: { id: "Kegiatan Baru", en: "New Event", ar: "فعالية جديدة" },
  location: { id: "Lokasi", en: "Location", ar: "المكان" },
  startAt: { id: "Mulai", en: "Starts", ar: "يبدأ" },
  endAt: { id: "Selesai", en: "Ends", ar: "ينتهي" },

  // Question bank
  question: { id: "Pertanyaan", en: "Question", ar: "السؤال" },
  options: { id: "Pilihan (pisah baris)", en: "Options (one per line)", ar: "الخيارات (سطر لكل واحد)" },
  answer: { id: "Jawaban", en: "Answer", ar: "الإجابة" },
  qType: { id: "Jenis", en: "Type", ar: "النوع" },
  difficulty: { id: "Kesulitan", en: "Difficulty", ar: "المستوى" },
  easy: { id: "Mudah", en: "Easy", ar: "سهل" },
  medium: { id: "Sedang", en: "Medium", ar: "متوسط" },
  hard: { id: "Sulit", en: "Hard", ar: "صعب" },
  multipleChoice: { id: "Pilihan Ganda", en: "Multiple Choice", ar: "اختيار من متعدد" },
  essay: { id: "Esai", en: "Essay", ar: "مقالي" },
  trueFalse: { id: "Benar/Salah", en: "True/False", ar: "صح/خطأ" },
  newQuestion: { id: "Soal Baru", en: "New Question", ar: "سؤال جديد" },

  // Gamification
  badgeCatalog: { id: "Katalog Badge", en: "Badge Catalog", ar: "كتالوج الشارات" },
  earnedBadges: { id: "Badge Diraih", en: "Earned Badges", ar: "الشارات المكتسبة" },
  locked: { id: "Terkunci", en: "Locked", ar: "مقفل" },
  earned: { id: "Diraih", en: "Earned", ar: "مكتسب" },
  xpHistory: { id: "Riwayat XP", en: "XP History", ar: "سجل الخبرة" },
  progress: { id: "Progres", en: "Progress", ar: "التقدم" },

  // Student-facing labels
  questAvailable: { id: "Misi tersedia", en: "Available quests", ar: "المهام المتاحة" },
  rewardSummary: { id: "Hadiah", en: "Reward", ar: "المكافأة" },
  due: { id: "Tenggat", en: "Due", ar: "موعد التسليم" },
  myClasses: { id: "Kelas Saya", en: "My Classes", ar: "فصولي" },
} as const;

export type Key = keyof typeof translations;

export const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}>({ lang: "id", setLang: () => {}, t: (k) => translations[k].id });

export const useLang = () => useContext(LangContext);
