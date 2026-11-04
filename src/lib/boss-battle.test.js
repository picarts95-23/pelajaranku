import { expect, test } from "bun:test";
import { bossHpAfterQuiz, hitDamage, practiceExp } from "./boss-battle.ts";

test("all correct answers without hints defeat the boss exactly", () => {
  expect(hitDamage(5) * 5).toBe(100);
});

test("quiz score of 70% or more defeats the boss", () => {
  expect(bossHpAfterQuiz(70, 100)).toBe(0);
  expect(bossHpAfterQuiz(35, 100)).toBe(50);
  expect(bossHpAfterQuiz(0, 100)).toBe(100);
});

test("practice EXP is 10 per correct plus 20 victory bonus", () => {
  expect(practiceExp(4, true)).toBe(60);
  expect(practiceExp(2, false)).toBe(20);
});
