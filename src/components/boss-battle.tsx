import { useEffect, useState } from "react";
import { Swords, Sparkles } from "lucide-react";
import { BOSS_MAX_HP, HERO_MAX_HP, type Boss } from "@/lib/boss-battle";
import { cn } from "@/lib/utils";

export type BattleFx = { kind: "hit" | "miss"; key: number; amount: number } | null;

function HpBar({ value, max, tone }: { value: number; max: number; tone: "boss" | "hero" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-muted">
      <div
        className={cn("h-full transition-all duration-700 ease-out", tone === "boss" ? "bg-destructive" : "bg-quest")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function BossArena({ boss, bossHp, heroHp, heroName, fx }: { boss: Boss; bossHp: number; heroHp: number; heroName: string; fx: BattleFx }) {
  const [active, setActive] = useState<BattleFx>(null);
  useEffect(() => {
    if (!fx) return;
    setActive(fx);
    const t = window.setTimeout(() => setActive(null), 900);
    return () => window.clearTimeout(t);
  }, [fx?.key]);
  const defeated = bossHp <= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-b from-primary/10 to-quest/10 p-3 sm:p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="min-w-0 text-center">
          <div className={cn("text-5xl sm:text-6xl transition-transform", active?.kind === "hit" && "boss-lunge", active?.kind === "miss" && "boss-shake")} aria-hidden>🧑‍🎓</div>
          <p className="mt-1 truncate text-xs font-bold">{heroName}</p>
          <HpBar value={heroHp} max={HERO_MAX_HP} tone="hero" />
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">HP {Math.round(heroHp)}/{HERO_MAX_HP}</p>
        </div>
        <Swords className="mb-8 size-6 text-muted-foreground" aria-hidden />
        <div className="relative min-w-0 text-center">
          <div className={cn("text-5xl sm:text-6xl transition-all duration-700", active?.kind === "hit" && "boss-shake", defeated && "scale-50 opacity-30 grayscale")} aria-hidden>{boss.emoji}</div>
          {active && (
            <span key={active.key} className={cn("boss-float absolute left-1/2 top-0 -translate-x-1/2 font-display text-lg font-bold", active.kind === "hit" ? "text-destructive" : "text-muted-foreground")}>
              {active.kind === "hit" ? `-${Math.round(active.amount)}` : "Meleset!"}
            </span>
          )}
          <p className="mt-1 truncate text-xs font-bold">{boss.name}</p>
          <HpBar value={bossHp} max={BOSS_MAX_HP} tone="boss" />
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">HP {Math.max(0, Math.round(bossHp))}/{BOSS_MAX_HP}</p>
        </div>
      </div>
      {active?.kind === "hit" && <div className="pointer-events-none absolute inset-0 boss-flash bg-quest/30" />}
      {active?.kind === "miss" && <div className="pointer-events-none absolute inset-0 boss-flash bg-destructive/25" />}
    </div>
  );
}

export function BattleOutcome({ victory, boss, exp, expNote }: { victory: boolean; boss: Boss; exp: number; expNote?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-quest/50 bg-card p-5 text-center">
      {victory && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="boss-confetti absolute text-lg" style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.15}s` }}>{["✨", "⭐", "🎉"][i % 3]}</span>
          ))}
        </div>
      )}
      <div className="text-6xl">{victory ? "🏆" : boss.emoji}</div>
      <h3 className="mt-2 font-display text-2xl font-bold">{victory ? `${boss.name} dikalahkan!` : `${boss.name} masih bertahan`}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{victory ? "Kemenangan! Kamu pahlawan kelas hari ini." : "Latih lagi dan tantang bos sekali lagi!"}</p>
      <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-quest px-4 py-1.5 font-display font-bold text-quest-foreground">
        <Sparkles className="size-4" /> +{exp} EXP
      </div>
      {expNote && <p className="mt-2 text-xs text-muted-foreground">{expNote}</p>}
    </div>
  );
}
