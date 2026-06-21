import muslimah01 from "@/assets/muslimah-01.png";
import muslimah02 from "@/assets/muslimah-02.png";
import muslimah03 from "@/assets/muslimah-03.png";
import muslimah04 from "@/assets/muslimah-04.png";
import muslimah05 from "@/assets/muslimah-05.png";
import muslimah06 from "@/assets/muslimah-06.png";
import muslimah07 from "@/assets/muslimah-07.png";
import muslimah08 from "@/assets/muslimah-08.png";
import muslimah09 from "@/assets/muslimah-09.png";
import muslimah10 from "@/assets/muslimah-10.png";
import muslimah11 from "@/assets/muslimah-11.png";
import muslimah12 from "@/assets/muslimah-12.png";
import muslimah13 from "@/assets/muslimah-13.png";
import muslimah14 from "@/assets/muslimah-14.png";
import muslimah15 from "@/assets/muslimah-15.png";
import muslimah16 from "@/assets/muslimah-16.png";
import muslimah17 from "@/assets/muslimah-17.png";
import muslimah18 from "@/assets/muslimah-18.png";
import muslimah19 from "@/assets/muslimah-19.png";
import muslimah20 from "@/assets/muslimah-20.png";
import guruMale from "@/assets/avatar-guru-male.png";
import guruFemale from "@/assets/avatar-guru-female.png";

const SISWA_AVATARS = [
  muslimah01,
  muslimah02,
  muslimah03,
  muslimah04,
  muslimah05,
  muslimah06,
  muslimah07,
  muslimah08,
  muslimah09,
  muslimah10,
  muslimah11,
  muslimah12,
  muslimah13,
  muslimah14,
  muslimah15,
  muslimah16,
  muslimah17,
  muslimah18,
  muslimah19,
  muslimah20,
];

const GURU_AVATARS = [guruMale, guruFemale];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function getIslamicAvatar(seed: string | null | undefined, role: "guru" | "siswa" | null | undefined): string {
  const pool = role === "guru" ? GURU_AVATARS : SISWA_AVATARS;
  const idx = hashSeed(seed ?? "anon") % pool.length;
  return pool[idx];
}

export {
  muslimah01,
  muslimah02,
  muslimah03,
  muslimah04,
  muslimah05,
  muslimah06,
  muslimah07,
  muslimah08,
  muslimah09,
  muslimah10,
  muslimah11,
  muslimah12,
  muslimah13,
  muslimah14,
  muslimah15,
  muslimah16,
  muslimah17,
  muslimah18,
  muslimah19,
  muslimah20,
  guruMale,
  guruFemale,
};
