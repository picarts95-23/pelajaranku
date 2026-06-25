// Shared scoring helpers for the Mutaba'ah Tahfidz (Halaqoh Tahfidz) feature.

// Tolerance limits straight from the assessment rubric.
export const TAJWID_TOLERANCE = 5; // max minor errors (do not change meaning)
export const HELP_TOLERANCE = 3; // max teacher prompts/hints

// Total = average of the three components (Tajwid, Kelancaran, Fashohah & Adab).
export function computeTotal(tajwid: number, kelancaran: number, fashohah: number): number {
  return Math.round((tajwid + kelancaran + fashohah) / 3);
}

export function predikatOf(total: number, lang: "id" | "en" | string): string {
  if (total >= 90) return lang === "id" ? "Mumtaz (Istimewa)" : "Mumtaz (Excellent)";
  if (total >= 80) return lang === "id" ? "Jayyid Jiddan (Sangat Baik)" : "Jayyid Jiddan (Very Good)";
  if (total >= 70) return lang === "id" ? "Jayyid (Baik)" : "Jayyid (Good)";
  if (total >= 60) return lang === "id" ? "Maqbul (Cukup)" : "Maqbul (Fair)";
  return lang === "id" ? "Mengulang (Belum Lulus)" : "Repeat (Not Passed)";
}

// --- Halaqoh Qur'an daily-grade accumulation -----------------------------
// The daily Halaqoh grade is the weighted accumulation of the three session
// types. These weights are mirrored in the SQL function halaqoh_daily_scores.
export const HALAQOH_WEIGHTS = { ziyadah: 0.3, murojaah: 0.4, tilawah: 0.3 } as const;

// The three Halaqoh session types used by Mutaba'ah and Halaqoh tasks.
export const SETORAN_TYPES = [
  { value: "ziyadah", id: "Ziyadah (Hafalan Baru)", en: "Ziyadah (New)" },
  { value: "murojaah", id: "Muroja'ah (Mengulang)", en: "Muroja'ah (Review)" },
  { value: "tilawah", id: "Tilawah Harian (min. 1 halaman)", en: "Daily Tilawah" },
] as const;

export function setoranLabel(value: string | null | undefined, lang: "id" | "en" | string): string {
  const v = (value ?? "").toLowerCase();
  if (v.startsWith("ziyadah")) return "Ziyadah";
  if (v.startsWith("muroj") || v.startsWith("muraj")) return "Muroja'ah";
  if (v.startsWith("tilawah")) return lang === "id" ? "Tilawah Harian" : "Daily Tilawah";
  return value ?? "—";
}

// Detect a Halaqoh Qur'an subject so the recap can source its daily grade
// from the Mutaba'ah accumulation instead of regular tagged tasks.
export function isHalaqohSubject(subject?: string | null): boolean {
  return !!subject && /halaqoh/i.test(subject);
}

export type HalaqohDaily = { student_id: string; ziyadah: number; murojaah: number; tilawah: number; daily: number };
