import {
  muslimah01, muslimah02, muslimah03, muslimah04, muslimah05,
  muslimah06, muslimah07, muslimah08, muslimah09, muslimah10,
  muslimah11, muslimah12, muslimah13, muslimah14, muslimah15,
  muslimah16, muslimah17, muslimah18, muslimah19, muslimah20,
  guruMale, guruFemale,
} from "@/lib/islamic-avatar";

export interface CharacterOption {
  key: string;
  name: string;
  src: string;
  role: "siswa" | "guru";
  archetype: string;
}

export const SISWA_CHARACTERS: CharacterOption[] = [
  { key: "muslimah-01", name: "Aisyah", src: muslimah01, role: "siswa", archetype: "Scholar" },
  { key: "muslimah-02", name: "Fatimah", src: muslimah02, role: "siswa", archetype: "Healer" },
  { key: "muslimah-03", name: "Khadijah", src: muslimah03, role: "siswa", archetype: "Strategist" },
  { key: "muslimah-04", name: "Maryam", src: muslimah04, role: "siswa", archetype: "Sage" },
  { key: "muslimah-05", name: "Zainab", src: muslimah05, role: "siswa", archetype: "Mage" },
  { key: "muslimah-06", name: "Hafsah", src: muslimah06, role: "siswa", archetype: "Archer" },
  { key: "muslimah-07", name: "Ruqayyah", src: muslimah07, role: "siswa", archetype: "Cleric" },
  { key: "muslimah-08", name: "Sumayyah", src: muslimah08, role: "siswa", archetype: "Guardian" },
  { key: "muslimah-09", name: "Asma", src: muslimah09, role: "siswa", archetype: "Ranger" },
  { key: "muslimah-10", name: "Ummu Salamah", src: muslimah10, role: "siswa", archetype: "Bard" },
  { key: "muslimah-11", name: "Safiyyah", src: muslimah11, role: "siswa", archetype: "Tactician" },
  { key: "muslimah-12", name: "Juwairiyah", src: muslimah12, role: "siswa", archetype: "Alchemist" },
  { key: "muslimah-13", name: "Halimah", src: muslimah13, role: "siswa", archetype: "Mentor" },
  { key: "muslimah-14", name: "Rumaisha", src: muslimah14, role: "siswa", archetype: "Explorer" },
  { key: "muslimah-15", name: "Salma", src: muslimah15, role: "siswa", archetype: "Diplomat" },
  { key: "muslimah-16", name: "Nusaybah", src: muslimah16, role: "siswa", archetype: "Knight" },
  { key: "muslimah-17", name: "Lubaba", src: muslimah17, role: "siswa", archetype: "Scout" },
  { key: "muslimah-18", name: "Ramlah", src: muslimah18, role: "siswa", archetype: "Scribe" },
  { key: "muslimah-19", name: "Atikah", src: muslimah19, role: "siswa", archetype: "Inventor" },
  { key: "muslimah-20", name: "Barakah", src: muslimah20, role: "siswa", archetype: "Champion" },
];

export const GURU_CHARACTERS: CharacterOption[] = [
  { key: "guru-male", name: "Ustadz", src: guruMale, role: "guru", archetype: "Mentor" },
  { key: "guru-female", name: "Ustadzah", src: guruFemale, role: "guru", archetype: "Mentor" },
];

export function getCharacterByKey(key: string | null | undefined): CharacterOption | null {
  if (!key) return null;
  return [...SISWA_CHARACTERS, ...GURU_CHARACTERS].find((c) => c.key === key) ?? null;
}
