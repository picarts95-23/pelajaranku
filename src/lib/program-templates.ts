/**
 * Auto templates for Program Tahunan (Prota) & Program Semester (Prosem),
 * plus a small hand-off store so a program row can prefill RPP / Kegiatan.
 */

export type TemplateItem = {
  material: string;
  hours: string;
  semester?: string;
  month?: string;
  weeks?: string;
  note?: string;
};

export const PROGRAM_MONTHS = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
];

/** Months belonging to each semester (academic year starts in Juli). */
export const SEMESTER_MONTHS: Record<1 | 2, string[]> = {
  1: ["Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  2: ["Januari", "Februari", "Maret", "April", "Mei", "Juni"],
};

type SubjectPreset = { match: RegExp; sem1: string[]; sem2: string[] };

const GENERIC_SEM1 = [
  "Orientasi & kontrak belajar",
  "Materi pokok 1 — konsep dasar",
  "Materi pokok 2 — penerapan",
  "Penilaian Harian 1",
  "Materi pokok 3 — pendalaman",
  "Penilaian Tengah Semester (PTS)",
  "Materi pokok 4 — proyek/praktik",
  "Penilaian Akhir Semester (PAS)",
];

const GENERIC_SEM2 = [
  "Review semester 1 & pemetaan capaian",
  "Materi pokok 5 — konsep lanjutan",
  "Materi pokok 6 — penerapan lanjutan",
  "Penilaian Harian 2",
  "Materi pokok 7 — pendalaman",
  "Penilaian Tengah Semester (PTS)",
  "Materi pokok 8 — proyek akhir",
  "Penilaian Akhir Tahun (PAT)",
];

const PRESETS: SubjectPreset[] = [
  {
    match: /(tahfidz|qur|quran|halaqoh|iqro)/i,
    sem1: [
      "Pembukaan halaqoh & tes penempatan bacaan",
      "Ziyadah — target hafalan pekanan",
      "Murojaah — pengulangan hafalan lama",
      "Tilawah & perbaikan tajwid dasar",
      "Ujian hafalan tahap 1",
      "Ziyadah lanjutan + adab tilawah",
      "Murojaah gabungan (juz berjalan)",
      "Ujian akhir semester hafalan",
    ],
    sem2: [
      "Pemetaan hafalan awal semester",
      "Ziyadah — target hafalan baru",
      "Murojaah terstruktur harian",
      "Tahsin tajwid: makhraj & sifat huruf",
      "Ujian hafalan tahap 2",
      "Murojaah menyeluruh",
      "Simulasi ujian tasmi'",
      "Ujian akhir tahun (tasmi')",
    ],
  },
  {
    match: /(matematika|math)/i,
    sem1: [
      "Bilangan & operasi hitung",
      "Bentuk aljabar",
      "Persamaan & pertidaksamaan linear",
      "Penilaian Harian 1",
      "Perbandingan & skala",
      "Penilaian Tengah Semester (PTS)",
      "Aritmetika sosial",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Garis & sudut",
      "Bangun datar: segiempat & segitiga",
      "Penyajian data",
      "Penilaian Harian 2",
      "Peluang sederhana",
      "Penilaian Tengah Semester (PTS)",
      "Proyek matematika terapan",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
  {
    match: /(bahasa indonesia|indonesia)/i,
    sem1: [
      "Teks deskripsi",
      "Teks narasi (cerita fantasi)",
      "Teks prosedur",
      "Penilaian Harian 1",
      "Teks laporan hasil observasi",
      "Penilaian Tengah Semester (PTS)",
      "Literasi & presentasi lisan",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Puisi rakyat",
      "Cerita fabel & legenda",
      "Surat pribadi & surat dinas",
      "Penilaian Harian 2",
      "Teks berita",
      "Penilaian Tengah Semester (PTS)",
      "Proyek literasi (buku bacaan)",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
  {
    match: /(arab)/i,
    sem1: [
      "Huruf hijaiyah & pelafalan",
      "Mufradat: at-ta'aruf (perkenalan)",
      "Mufradat: al-usrah (keluarga)",
      "Ulangan mufradat 1",
      "Tarkib: isim & dhamir",
      "Penilaian Tengah Semester (PTS)",
      "Hiwar sederhana",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Mufradat: al-madrasah (sekolah)",
      "Mufradat: al-'unwan (alamat)",
      "Tarkib: fi'il madhi & mudhari'",
      "Ulangan mufradat 2",
      "Qira'ah teks pendek",
      "Penilaian Tengah Semester (PTS)",
      "Kitabah: menulis paragraf pendek",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
  {
    match: /(inggris|english)/i,
    sem1: [
      "Greetings & introductions",
      "Descriptive text: people & things",
      "Simple present tense",
      "Daily test 1",
      "Procedure text",
      "Mid-semester test (PTS)",
      "Speaking project: short presentation",
      "End-of-semester test (PAS)",
    ],
    sem2: [
      "Past tense & recount text",
      "Narrative text",
      "Announcement & notice",
      "Daily test 2",
      "Report text",
      "Mid-semester test (PTS)",
      "Project: simple English portfolio",
      "End-of-year test (PAT)",
    ],
  },
  {
    match: /(pai|agama|fiqih|akidah|akhlak|sirah|hadis)/i,
    sem1: [
      "Adab menuntut ilmu",
      "Thaharah & tata cara wudhu",
      "Shalat fardhu & sunnah",
      "Penilaian Harian 1",
      "Akhlak kepada orang tua & guru",
      "Penilaian Tengah Semester (PTS)",
      "Sirah Nabi: periode Makkah",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Iman kepada Allah & sifat-sifat-Nya",
      "Puasa & keutamaannya",
      "Zakat & kepedulian sosial",
      "Penilaian Harian 2",
      "Akhlak dalam pergaulan",
      "Penilaian Tengah Semester (PTS)",
      "Sirah Nabi: periode Madinah",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
  {
    match: /(ipa|sains|biolog|fisika|kimia)/i,
    sem1: [
      "Objek IPA & pengukuran",
      "Klasifikasi makhluk hidup",
      "Zat & perubahannya",
      "Penilaian Harian 1",
      "Suhu & kalor",
      "Penilaian Tengah Semester (PTS)",
      "Praktikum sederhana & laporan",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Energi & perubahannya",
      "Sistem organisasi kehidupan",
      "Ekosistem & lingkungan",
      "Penilaian Harian 2",
      "Pencemaran & pelestarian",
      "Penilaian Tengah Semester (PTS)",
      "Proyek IPA terapan",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
  {
    match: /(ips|sosial|sejarah|geograf|ekonomi|pkn|pancasila|kewarganegaraan)/i,
    sem1: [
      "Manusia, tempat, & lingkungan",
      "Interaksi sosial",
      "Norma & aturan dalam masyarakat",
      "Penilaian Harian 1",
      "Kegiatan ekonomi masyarakat",
      "Penilaian Tengah Semester (PTS)",
      "Studi kasus lingkungan sekitar",
      "Penilaian Akhir Semester (PAS)",
    ],
    sem2: [
      "Keberagaman budaya Indonesia",
      "Sejarah lokal & nasional",
      "Peran warga negara",
      "Penilaian Harian 2",
      "Globalisasi & dampaknya",
      "Penilaian Tengah Semester (PTS)",
      "Proyek sosial sederhana",
      "Penilaian Akhir Tahun (PAT)",
    ],
  },
];

function topicsFor(subject: string): { sem1: string[]; sem2: string[] } {
  const s = subject ?? "";
  const found = PRESETS.find((p) => p.match.test(s));
  return found ? { sem1: found.sem1, sem2: found.sem2 } : { sem1: GENERIC_SEM1, sem2: GENERIC_SEM2 };
}

/** True when the subject has a tailored preset (not the generic fallback). */
export function hasSubjectPreset(subject: string): boolean {
  return PRESETS.some((p) => p.match.test(subject ?? ""));
}

/** Program Tahunan: all topics for both semesters with an hour allocation. */
export function buildAnnualTemplate(opts: { subject: string; hoursPerTopic?: number }): TemplateItem[] {
  const { sem1, sem2 } = topicsFor(opts.subject);
  const hours = String(opts.hoursPerTopic ?? 4);
  return [
    ...sem1.map((material) => ({ semester: "1", material, hours, note: "" })),
    ...sem2.map((material) => ({ semester: "2", material, hours, note: "" })),
  ];
}

/** Program Semester: topics spread across the semester's months & weeks. */
export function buildSemesterTemplate(opts: {
  subject: string;
  semester: 1 | 2;
  hoursPerTopic?: number;
}): TemplateItem[] {
  const { sem1, sem2 } = topicsFor(opts.subject);
  const topics = opts.semester === 2 ? sem2 : sem1;
  const months = SEMESTER_MONTHS[opts.semester];
  const hours = String(opts.hoursPerTopic ?? 4);
  return topics.map((material, i) => {
    const month = months[Math.min(months.length - 1, Math.floor(i / 2))];
    const weeks = i % 2 === 0 ? "1,2" : "3,4";
    return { material, hours, month, weeks, note: "" };
  });
}

/** Split "2026/2027" → { first: 2026, second: 2027 }. */
function yearParts(academicYear?: string | null) {
  const now = new Date().getFullYear();
  const m = /(\d{4})\D+(\d{4})/.exec(academicYear ?? "");
  if (m) return { first: Number(m[1]), second: Number(m[2]) };
  return { first: now, second: now + 1 };
}

/**
 * Convert a Prosem row (month + weeks) into a concrete calendar date (YYYY-MM-DD).
 * Falls back to today when the month is unknown.
 */
export function programItemDate(opts: {
  month?: string | null;
  weeks?: string | null;
  academic_year?: string | null;
}): string {
  const idx = PROGRAM_MONTHS.indexOf((opts.month ?? "").trim());
  if (idx < 0) return new Date().toISOString().slice(0, 10);
  const { first, second } = yearParts(opts.academic_year);
  const year = idx <= 5 ? first : second;
  const monthIndex = idx <= 5 ? idx + 6 : idx - 6; // Juli = 6 … Juni = 5
  const week = Number(String(opts.weeks ?? "").split(/[^\d]+/).filter(Boolean)[0] ?? 1) || 1;
  const day = Math.min(28, (week - 1) * 7 + 1);
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/* ---------- hand-off store (Prota/Prosem → RPP / Kegiatan) ---------- */

export type ProgramPrefill = {
  class_id?: string | null;
  subject?: string | null;
  material: string;
  hours?: string | null;
  note?: string | null;
  month?: string | null;
  weeks?: string | null;
  academic_year?: string | null;
  sourceTitle?: string | null;
};

const KEY = (target: "rpp" | "event") => `pelajaranku:prefill:${target}`;

export function stashProgramPrefill(target: "rpp" | "event", data: ProgramPrefill) {
  try {
    sessionStorage.setItem(KEY(target), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Read once and clear. */
export function takeProgramPrefill(target: "rpp" | "event"): ProgramPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY(target));
    if (!raw) return null;
    sessionStorage.removeItem(KEY(target));
    return JSON.parse(raw) as ProgramPrefill;
  } catch {
    return null;
  }
}
