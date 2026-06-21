import siswa1 from "@/assets/avatar-siswa-1.png";
import siswa2 from "@/assets/avatar-siswa-2.png";
import siswi1 from "@/assets/avatar-siswi-1.png";
import siswi2 from "@/assets/avatar-siswi-2.png";
import guruMale from "@/assets/avatar-guru-male.png";
import guruFemale from "@/assets/avatar-guru-female.png";

const SISWA_AVATARS = [siswa1, siswi1, siswa2, siswi2];
const GURU_AVATARS = [guruMale, guruFemale];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Pilih avatar Islami (faceless) berdasarkan seed (user id / nama) dan role.
 * Deterministik: seed yang sama akan selalu menghasilkan avatar yang sama.
 */
export function getIslamicAvatar(seed: string | null | undefined, role: "guru" | "siswa" | null | undefined): string {
  const pool = role === "guru" ? GURU_AVATARS : SISWA_AVATARS;
  const idx = hashSeed(seed ?? "anon") % pool.length;
  return pool[idx];
}

export { siswa1, siswa2, siswi1, siswi2, guruMale, guruFemale };
