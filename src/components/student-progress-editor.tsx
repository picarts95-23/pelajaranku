import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buildDevelopmentSummary, cleanObjectiveScores, type DevelopmentAttempt, type ProgressRecord } from "@/lib/student-progress";
import type { Objective, TpRow } from "@/lib/tp-recap";

export function StudentProgressEditor({ classId, subject, row, objectives, record, attempts, open, onOpenChange, onSaved }: {
  classId: string;
  subject: string;
  row: TpRow;
  objectives: Objective[];
  record?: ProgressRecord;
  attempts: DevelopmentAttempt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [scores, setScores] = useState<Record<string, number | "">>(() => Object.fromEntries(objectives.map((objective) => [objective.id, record?.objective_scores?.[objective.id] ?? ""])));
  const [notes, setNotes] = useState(record?.development_notes ?? buildDevelopmentSummary(row, attempts));
  const [description, setDescription] = useState(record?.report_description ?? row.description);
  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Silakan masuk kembali.");
      const { error } = await supabase.from("student_progress_records").upsert({
        teacher_id: user.id,
        student_id: row.student_id,
        class_id: classId,
        subject,
        objective_scores: cleanObjectiveScores(scores),
        development_notes: notes.trim() || null,
        report_description: description.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "teacher_id,student_id,class_id,subject" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nilai TP dan catatan siswa disimpan");
      onOpenChange(false);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Edit Rekap · {row.name}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Nilai manual mengganti nilai TP pada rekap tanpa mengubah nilai tugas aslinya. Kosongkan untuk kembali memakai nilai otomatis.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {objectives.map((objective) => <div key={objective.id}>
          <Label>{objective.code} · {objective.description}</Label>
          <Input className="mt-1" type="number" min={0} max={100} step={0.1} value={scores[objective.id] ?? ""} placeholder={`Otomatis: ${row.perTp[objective.id] ?? "—"}`} onChange={(event) => setScores({ ...scores, [objective.id]: event.target.value === "" ? "" : Number(event.target.value) })} />
        </div>)}
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="development-notes">Catatan perkembangan siswa</Label>{attempts.length > 0 && <span className="text-xs text-muted-foreground">Termasuk {attempts.length} ulasan Latihan AI</span>}</div>
        <Textarea id="development-notes" className="mt-1 min-h-40" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catat perkembangan dari nilai, formatif, dan Latihan AI." />
      </div>
      <div><Label htmlFor="report-description">Deskripsi rapor</Label><Textarea id="report-description" className="mt-1" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
      <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button variant="guru" disabled={save.isPending} onClick={() => save.mutate()}><Save className="size-4" />{save.isPending ? "Menyimpan..." : "Simpan Rekap"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
