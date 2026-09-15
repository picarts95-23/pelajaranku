import { Progress } from "@/components/ui/progress";

export type ScoreBreakdownItem = {
  indicator: string;
  correct: number;
  total: number;
  earned_points: number;
  max_points: number;
  manual_pending?: number;
};

export function questionPoints(question: any, fallback = 1): number {
  const points = Number(question?.points);
  return Number.isFinite(points) && points > 0 ? points : fallback;
}

export function questionSeconds(question: any, fallback = 30): number {
  const seconds = Number(question?.time_limit_seconds);
  return Number.isFinite(seconds) && seconds >= 10 ? Math.min(600, seconds) : fallback;
}

export function ScoreBreakdown({ items, lang }: { items: ScoreBreakdownItem[]; lang: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2 text-left">
      <h4 className="font-display text-sm font-bold">{lang === "id" ? "Performa per indikator" : "Performance by indicator"}</h4>
      {items.map((item) => {
        const percent = item.max_points > 0 ? Math.round((item.earned_points / item.max_points) * 100) : 0;
        return (
          <div key={item.indicator} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 font-semibold">{item.indicator || (lang === "id" ? "Umum" : "General")}</span>
              <span className="shrink-0 font-display font-bold">{item.earned_points}/{item.max_points} · {percent}%</span>
            </div>
            <Progress value={percent} className="mt-2 h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.correct}/{item.total} {lang === "id" ? "jawaban benar" : "correct"}
              {(item.manual_pending ?? 0) > 0 ? ` · ${item.manual_pending} ${lang === "id" ? "menunggu penilaian" : "awaiting review"}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}