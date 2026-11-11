import { describe, expect, it } from "bun:test";
import { BACKUP_TAB_TITLES, buildSheetValueBatch, quoteSheetTab } from "./sheet-backup-tabs";

describe("backup Google Sheets lengkap", () => {
  it("mencakup data inti dari kelas sampai aktivitas dan kalender", () => {
    expect(BACKUP_TAB_TITLES).toEqual(expect.arrayContaining([
      "Kelas", "Siswa", "Presensi", "Rekap Nilai", "Latihan AI", "Tugas",
      "Soal Tugas", "Pengumpulan", "Revisi Nilai", "Tujuan Pembelajaran",
      "Mutaba'ah", "Materi", "Pembacaan Materi", "Jurnal", "Pengumuman",
      "Komentar Pengumuman", "Reaksi Pengumuman", "Bank Soal", "Transaksi XP",
      "Aktivitas Kelas", "Status Siswa", "Reaksi Teman", "Kalender Google",
    ]));
    expect(new Set(BACKUP_TAB_TITLES).size).toBe(BACKUP_TAB_TITLES.length);
  });

  it("menulis setiap tab tepat sekali dalam satu batch", () => {
    const batch = buildSheetValueBatch({ Kelas: [["Nama"], ["XII IPA"]] });
    expect(batch.data).toHaveLength(BACKUP_TAB_TITLES.length);
    expect(batch.clearRanges).toHaveLength(BACKUP_TAB_TITLES.length);
    expect(batch.data.find((tab) => tab.range === "'Kelas'!A1")?.values).toEqual([["Nama"], ["XII IPA"]]);
    expect(batch.data.find((tab) => tab.range === "'Siswa'!A1")?.values).toEqual([[""]]);
  });

  it("menangani apostrof pada nama tab Mutaba'ah", () => {
    expect(quoteSheetTab("Mutaba'ah")).toBe("'Mutaba''ah'");
  });
});
