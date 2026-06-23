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
