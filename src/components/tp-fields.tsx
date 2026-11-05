import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { validateTpWeights } from "@/lib/tp-recap";

/** Formatif/Sumatif + multi-TP picker with proportional shares, shared by create and edit task forms. */
export function TpFields({ subject, classId, kind, objectiveId, weights, onKind, onChange }: {
  subject: string; classId?: string | null; kind: string; objectiveId: string; weights: Record<string, number>;
  onKind: (v: string) => void; onChange: (primaryId: string, weights: Record<string, number>) => void;
}) {
  const { data: objectives = [] } = useQuery({
    queryKey: ["learning-objectives", subject], enabled: !!subject,
    queryFn: async () => (await supabase.from("learning_objectives").select("id, code, description, class_id").eq("subject", subject).order("sort_order")).data ?? [],
  });
  const list = objectives.filter((o) => !classId || !o.class_id || o.class_id === classId);
  const selected = Object.keys(weights).length ? Object.keys(weights) : objectiveId ? [objectiveId] : [];
  const current: Record<string, number> = Object.keys(weights).length ? weights : objectiveId ? { [objectiveId]: 100 } : {};

  const toggle = (id: string, on: boolean) => {
    const ids = on ? [...selected, id] : selected.filter((x) => x !== id);
    const even = ids.length ? Math.floor(100 / ids.length) : 0;
    const next = Object.fromEntries(ids.map((x, i) => [x, i === 0 ? 100 - even * (ids.length - 1) : even]));
    onChange(ids[0] ?? "", next);
  };
  const setShare = (id: string, v: number) => onChange(selected[0] ?? "", { ...current, [id]: v });
  const err = validateTpWeights(current);

  return (
    <div className="grid gap-3 rounded-lg border-2 border-border bg-muted/30 p-3">
      <div>
        <Label>Asesmen</Label>
        <Select value={kind} onValueChange={onKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sumatif">Sumatif (masuk nilai rapor)</SelectItem>
            <SelectItem value="formatif">Formatif (umpan balik saja)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Tujuan Pembelajaran (TP) — boleh lebih dari satu</Label>
        {!subject ? <p className="text-sm text-muted-foreground">Pilih mapel dulu.</p>
          : !list.length ? <p className="text-sm text-muted-foreground">Belum ada TP untuk mapel ini.</p>
          : (
            <div className="mt-1 grid max-h-64 gap-1 overflow-y-auto">
              {list.map((o) => {
                const on = selected.includes(o.id);
                return (
                  <div key={o.id} className="flex items-center gap-2 rounded-md bg-background p-2">
                    <Checkbox checked={on} onCheckedChange={(c) => toggle(o.id, !!c)} id={`tp-${o.id}`} />
                    <label htmlFor={`tp-${o.id}`} className="min-w-0 flex-1 text-sm"><b>{o.code}</b> · {o.description}</label>
                    {on && selected.length > 1 && (
                      <div className="flex items-center gap-1">
                        <Input type="number" min={1} max={100} className="w-20" aria-label={`Porsi ${o.code}`}
                          value={current[o.id] ?? 0} onChange={(e) => setShare(o.id, Number(e.target.value))} />
                        <span className="text-sm">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        {err && <p className="mt-1 text-sm font-medium text-destructive">{err}</p>}
      </div>
      <p className="text-xs text-muted-foreground">Untuk UTS/UAS yang mencakup beberapa TP, centang semua TP lalu atur porsinya (total 100%). Nilai dibagi ke tiap TP sesuai porsi itu. Formatif hanya umpan balik.</p>
    </div>
  );
}
