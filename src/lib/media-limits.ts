/**
 * Batas ukuran upload terpusat untuk seluruh aplikasi.
 * Menahan tagihan storage & bandwidth agar tidak melonjak.
 *
 * Angka dipilih supaya cukup untuk foto tugas dari HP (setelah kompresi otomatis
 * ~150–400 KB), rekaman suara pendek 1–3 menit, dan video pembelajaran singkat.
 * Sesuaikan di satu tempat — komponen upload memakai konstanta ini.
 */
export const MEDIA_LIMITS = {
  /** Foto jawaban siswa (setelah client-side compress). */
  answerImage: { maxBytes: 8 * 1024 * 1024, label: "8 MB" },
  /** Berkas jawaban siswa (PDF/Word/Excel/PPT/ZIP). */
  answerFile: { maxBytes: 20 * 1024 * 1024, label: "20 MB" },
  /** Rekaman suara jawaban siswa (~3–5 menit opus/webm). */
  voiceAnswer: { maxBytes: 12 * 1024 * 1024, label: "12 MB" },
  /** Lampiran media guru: gambar. */
  lessonImage: { maxBytes: 8 * 1024 * 1024, label: "8 MB" },
  /** Lampiran media guru: audio. */
  lessonAudio: { maxBytes: 20 * 1024 * 1024, label: "20 MB" },
  /** Lampiran media guru: video (short-form). */
  lessonVideo: { maxBytes: 50 * 1024 * 1024, label: "50 MB" },
} as const;

export type MediaLimitKey = keyof typeof MEDIA_LIMITS;

/**
 * Lempar Error yang ramah untuk siswa kalau file melebihi batas.
 * Panggil sebelum `.upload()` — hemat kuota jaringan HP.
 */
export function assertMediaSize(
  file: Blob,
  kind: MediaLimitKey,
  lang: "id" | "en" = "id",
) {
  const { maxBytes, label } = MEDIA_LIMITS[kind];
  if (file.size === 0) {
    throw new Error(lang === "id" ? "File kosong. Coba ulang." : "Empty file. Try again.");
  }
  if (file.size > maxBytes) {
    const actual = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      lang === "id"
        ? `Ukuran file ${actual} MB melebihi batas ${label}. Kecilkan/pendekkan lalu coba lagi.`
        : `File size ${actual} MB exceeds the ${label} limit. Please shrink/shorten it and retry.`,
    );
  }
}

/** MIME allowlist ringkas — tolak file eksotik yang tidak dipakai UI. */
export function assertMediaMime(file: File, allowed: string[], lang: "id" | "en" = "id") {
  const t = (file.type || "").toLowerCase();
  const ok = allowed.some((a) => t === a || (a.endsWith("/*") && t.startsWith(a.slice(0, -1))));
  if (!ok) {
    throw new Error(
      lang === "id"
        ? `Format ${file.type || "tidak dikenal"} belum didukung.`
        : `Format ${file.type || "unknown"} is not supported.`,
    );
  }
}
