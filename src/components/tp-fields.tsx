import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

/** Formatif/Sumatif + Tujuan Pembelajaran picker shared by create and edit task forms. */
export function TpFields({ subject, classId, kind, objectiveId, onKind, onObjective }: {
  subject: string; classId?: string | null; kind: string; objectiveId: string;
  onKind: (v: string) => void; onObjective: (v: string) => void;
}) {
  const { data: objectives = [] } = useQuery({
    queryKey: ["learning-objectives", subject], enabled: !!subject,
    queryFn: async () => (await supabase.from("learning_objectives").select("id, code, description, class_id").eq("subject", subject).order("sort_order")).data ?? [],
  });
  const list = objectives.filter((o) => !classId || !o.class_id || o.class_id === classId);
  return (
    <div className="grid gap-3 rounded-lg border-2 border-border bg-muted/30 p-3 sm:grid-cols-2">
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
        <Label>Tujuan Pembelajaran (TP)</Label>
        <Select value={objectiveId || "none"} onValueChange={(v) => onObjective(v === "none" ? "" : v)} disabled={!subject}>
          <SelectTrigger><SelectValue placeholder={subject ? "Pilih TP" : "Pilih mapel dulu"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Tanpa TP —</SelectItem>
            {list.map((o) => <SelectItem key={o.id} value={o.id}>{o.code} · {o.description.slice(0, 60)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Nilai sumatif direkap per TP di menu Rekap per TP. Formatif hanya ditampilkan sebagai umpan balik.</p>
    </div>
  );
}
