/** Complete teacher-backup coverage, in spreadsheet display order. */
export const BACKUP_TAB_TITLES = [
  "Ringkasan Backup",
  "Kelas",
  "Pendaftaran Kelas",
  "Siswa",
  "Presensi",
  "Nilai Kehadiran",
  "Pengaturan Nilai",
  "Mapel Guru",
  "Rekap Nilai",
  "Latihan AI",
  "Tugas",
  "Soal Tugas",
  "Kunci Jawaban",
  "Pengumpulan",
  "Revisi Nilai",
  "Tidak Mengerjakan",
  "Nilai Adab",
  "Tujuan Pembelajaran",
  "Perkembangan & Rapor",
  "Mutaba'ah",
  "Materi",
  "Pembacaan Materi",
  "Program Tahunan",
  "Program Semester",
  "Jurnal",
  "RPP Pekanan",
  "Pengumuman",
  "Komentar Pengumuman",
  "Reaksi Pengumuman",
  "Event Kelas",
  "Bank Soal",
  "Daftar Badge",
  "Badge Siswa",
  "Transaksi XP",
  "Permintaan Tugas",
  "Aktivitas Kelas",
  "Status Siswa",
  "Komentar Status",
  "Reaksi Status",
  "Reaksi Teman",
  "Kalender Google",
] as const;

export type BackupTabs = Record<string, string[][]>;

export function quoteSheetTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** One batched clear/write request per sync avoids per-tab quota consumption. */
export function buildSheetValueBatch(tabs: BackupTabs) {
  return {
    clearRanges: BACKUP_TAB_TITLES.map((title) => `${quoteSheetTab(title)}!A:ZZ`),
    data: BACKUP_TAB_TITLES.map((title) => ({
      range: `${quoteSheetTab(title)}!A1`,
      majorDimension: "ROWS",
      values: tabs[title]?.length ? tabs[title] : [[""]],
    })),
  };
}
