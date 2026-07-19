/** Hari libur nasional & hari raya Indonesia (statik, kurasi manual).
 * Digunakan untuk menampilkan penanda di kalender fitur Kegiatan.
 * Tambahkan tahun berikutnya bila diperlukan.
 */
export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
  kind: "national" | "religious";
};

export const ID_HOLIDAYS: Holiday[] = [
  // 2025
  { date: "2025-01-01", name: "Tahun Baru Masehi", kind: "national" },
  { date: "2025-01-27", name: "Isra Mi'raj Nabi Muhammad SAW", kind: "religious" },
  { date: "2025-01-29", name: "Tahun Baru Imlek", kind: "religious" },
  { date: "2025-03-29", name: "Hari Suci Nyepi", kind: "religious" },
  { date: "2025-03-31", name: "Idul Fitri 1446 H", kind: "religious" },
  { date: "2025-04-01", name: "Idul Fitri 1446 H (Hari ke-2)", kind: "religious" },
  { date: "2025-04-18", name: "Wafat Isa Almasih", kind: "religious" },
  { date: "2025-04-20", name: "Paskah", kind: "religious" },
  { date: "2025-05-01", name: "Hari Buruh Internasional", kind: "national" },
  { date: "2025-05-12", name: "Hari Raya Waisak", kind: "religious" },
  { date: "2025-05-29", name: "Kenaikan Isa Almasih", kind: "religious" },
  { date: "2025-06-01", name: "Hari Lahir Pancasila", kind: "national" },
  { date: "2025-06-07", name: "Idul Adha 1446 H", kind: "religious" },
  { date: "2025-06-27", name: "Tahun Baru Islam 1447 H", kind: "religious" },
  { date: "2025-08-17", name: "Hari Kemerdekaan RI", kind: "national" },
  { date: "2025-09-05", name: "Maulid Nabi Muhammad SAW", kind: "religious" },
  { date: "2025-12-25", name: "Hari Raya Natal", kind: "religious" },

  // 2026
  { date: "2026-01-01", name: "Tahun Baru Masehi", kind: "national" },
  { date: "2026-01-16", name: "Isra Mi'raj Nabi Muhammad SAW", kind: "religious" },
  { date: "2026-02-17", name: "Tahun Baru Imlek", kind: "religious" },
  { date: "2026-03-19", name: "Hari Suci Nyepi", kind: "religious" },
  { date: "2026-03-20", name: "Idul Fitri 1447 H", kind: "religious" },
  { date: "2026-03-21", name: "Idul Fitri 1447 H (Hari ke-2)", kind: "religious" },
  { date: "2026-04-03", name: "Wafat Isa Almasih", kind: "religious" },
  { date: "2026-04-05", name: "Paskah", kind: "religious" },
  { date: "2026-05-01", name: "Hari Buruh Internasional", kind: "national" },
  { date: "2026-05-14", name: "Kenaikan Isa Almasih", kind: "religious" },
  { date: "2026-05-27", name: "Idul Adha 1447 H", kind: "religious" },
  { date: "2026-05-31", name: "Hari Raya Waisak", kind: "religious" },
  { date: "2026-06-01", name: "Hari Lahir Pancasila", kind: "national" },
  { date: "2026-06-16", name: "Tahun Baru Islam 1448 H", kind: "religious" },
  { date: "2026-08-17", name: "Hari Kemerdekaan RI", kind: "national" },
  { date: "2026-08-25", name: "Maulid Nabi Muhammad SAW", kind: "religious" },
  { date: "2026-12-25", name: "Hari Raya Natal", kind: "religious" },

  // 2027
  { date: "2027-01-01", name: "Tahun Baru Masehi", kind: "national" },
  { date: "2027-01-06", name: "Isra Mi'raj Nabi Muhammad SAW", kind: "religious" },
  { date: "2027-02-06", name: "Tahun Baru Imlek", kind: "religious" },
  { date: "2027-03-09", name: "Idul Fitri 1448 H", kind: "religious" },
  { date: "2027-03-10", name: "Idul Fitri 1448 H (Hari ke-2)", kind: "religious" },
  { date: "2027-03-26", name: "Wafat Isa Almasih", kind: "religious" },
  { date: "2027-03-28", name: "Paskah", kind: "religious" },
  { date: "2027-04-08", name: "Hari Suci Nyepi", kind: "religious" },
  { date: "2027-05-01", name: "Hari Buruh Internasional", kind: "national" },
  { date: "2027-05-06", name: "Kenaikan Isa Almasih", kind: "religious" },
  { date: "2027-05-16", name: "Idul Adha 1448 H", kind: "religious" },
  { date: "2027-05-20", name: "Hari Raya Waisak", kind: "religious" },
  { date: "2027-06-01", name: "Hari Lahir Pancasila", kind: "national" },
  { date: "2027-06-06", name: "Tahun Baru Islam 1449 H", kind: "religious" },
  { date: "2027-08-14", name: "Maulid Nabi Muhammad SAW", kind: "religious" },
  { date: "2027-08-17", name: "Hari Kemerdekaan RI", kind: "national" },
  { date: "2027-12-25", name: "Hari Raya Natal", kind: "religious" },
];

export function holidaysOn(dateISO: string): Holiday[] {
  return ID_HOLIDAYS.filter((h) => h.date === dateISO);
}
