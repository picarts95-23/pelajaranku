// Browser-safe Boss Battle rules shared by quiz and AI practice.
export const BOSS_MAX_HP = 100;
export const HERO_MAX_HP = 100;
/** Score percentage needed to defeat the boss in a graded quiz. */
export const QUIZ_VICTORY_PERCENT = 70;

export type Boss = { name: string; emoji: string };
const BOSSES: Boss[] = [
  { name: "Naga Lupa", emoji: "🐉" },
  { name: "Raksasa Malas", emoji: "👹" },
  { name: "Penyihir Bingung", emoji: "🧙‍♂️" },
  { name: "Golem Galat", emoji: "🗿" },
  { name: "Hantu Ragu", emoji: "👻" },
];

export function pickBoss(seed: string): Boss {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BOSSES[h % BOSSES.length];
}

/** Damage one correct answer deals so that all-correct exactly defeats the boss. Hints weaken the hit. */
export function hitDamage(totalQuestions: number, hintsUsed = 0): number {
  if (totalQuestions <= 0) return 0;
  const base = BOSS_MAX_HP / totalQuestions;
  const factor = Math.max(0.5, 1 - hintsUsed * 0.15);
  return base * factor;
}

/** Damage the hero takes on a wrong answer; the hero never drops below 1 HP. */
export function heroDamage(totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.min(35, Math.max(10, HERO_MAX_HP / totalQuestions));
}

/** Boss HP left after a graded quiz, proportional to the score. */
export function bossHpAfterQuiz(score: number, maxScore: number): number {
  if (maxScore <= 0) return BOSS_MAX_HP;
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  if (pct >= QUIZ_VICTORY_PERCENT) return 0;
  return Math.round(BOSS_MAX_HP * (1 - pct / QUIZ_VICTORY_PERCENT));
}

/** EXP for an AI practice battle: 10 per correct answer, +20 bonus for defeating the boss. */
export function practiceExp(correct: number, victory: boolean): number {
  return correct * 10 + (victory ? 20 : 0);
}
