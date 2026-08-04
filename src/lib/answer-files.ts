/**
 * Jawaban tugas bisa berisi lebih dari satu berkas (misal beberapa foto).
 * Beberapa path disimpan dalam satu kolom `submissions.file_url`, dipisah
 * baris baru, supaya kompatibel dengan data lama yang hanya berisi 1 path.
 */
export const MAX_ANSWER_PHOTOS = 6;

/** Ubah nilai file_url menjadi daftar path/URL (mendukung format lama 1 path). */
export function parseAnswerFiles(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Gabungkan beberapa path menjadi satu nilai untuk kolom file_url. */
export function joinAnswerFiles(paths: string[]): string | null {
  const clean = paths.map((p) => p.trim()).filter(Boolean);
  return clean.length ? clean.join("\n") : null;
}
