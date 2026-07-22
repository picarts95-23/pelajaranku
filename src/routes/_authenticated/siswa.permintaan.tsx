import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Plus, Trash2, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/permintaan")({
  head: () => ({ meta: [{ title: "Minta Tugas · Pelajaranku" }] }),
  component: SiswaPermintaanPage,
});

type Req = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  class_id: string | null;
  teacher_id: string | null;
  desired_due_at: string | null;
  status: "pending" | "accepted" | "declined" | "converted" | "cancelled";
  teacher_note: string | null;
  created_at: string;
  responded_at: string | null;
  classes?: { name: string } | null;
};

function SiswaPermintaanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", subject: "", class_id: "", desired_due_at: "" });

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-task-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_requests")
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      return (data ?? []) as Req[];
    },
  });

  const { data: myClasses = [] } = useQuery({
    queryKey: ["my-enrolled-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("class_id, classes(id, name, teacher_id, subject)")
        .eq("student_id", user!.id);
      return ((data ?? []) as any[]).map((r) => r.classes).filter(Boolean);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error(lang === "id" ? "Judul wajib diisi." : "Title is required.");
      const cls = myClasses.find((c: any) => c.id === form.class_id);
      const payload: any = {
        student_id: user!.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject: form.subject.trim() || null,
        class_id: form.class_id || null,
        teacher_id: cls?.teacher_id ?? null,
        desired_due_at: form.desired_due_at ? new Date(form.desired_due_at).toISOString() : null,
      };
      const { error } = await supabase.from("task_requests").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Permintaan terkirim ke guru ✨" : "Request sent to teacher ✨");
      setOpen(false);
      setForm({ title: "", description: "", subject: "", class_id: "", desired_due_at: "" });
      qc.invalidateQueries({ queryKey: ["my-task-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Permintaan dibatalkan" : "Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-task-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader
        title={lang === "id" ? "Minta Tugas ke Guru" : "Request Tasks from Teacher"}
        subtitle={lang === "id" ? "Butuh latihan tambahan? Ajukan permintaan tugas personal ke gurumu." : "Need extra practice? Ask your teacher for a personal task."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="siswa"><Plus className="size-4" /> {lang === "id" ? "Buat Permintaan" : "New Request"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{lang === "id" ? "Permintaan Tugas Baru" : "New Task Request"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{lang === "id" ? "Judul singkat" : "Short title"} *</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={lang === "id" ? "Contoh: Latihan soal pecahan" : "e.g. Fractions practice"} />
                </div>
                <div>
                  <Label>{lang === "id" ? "Pilih kelas (opsional)" : "Class (optional)"}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm((f) => ({ ...f, class_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih kelas" : "Select class"} /></SelectTrigger>
                    <SelectContent>
                      {myClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "id" ? "Mata pelajaran (opsional)" : "Subject (optional)"}</Label>
                  <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                </div>
                <div>
                  <Label>{lang === "id" ? "Ceritakan kebutuhanmu" : "Tell your teacher what you need"}</Label>
                  <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={lang === "id" ? "Contoh: Aku ingin latihan tambahan tentang perkalian bersusun." : "e.g. I'd like extra practice on long multiplication."} />
                </div>
                <div>
                  <Label>{lang === "id" ? "Tenggat yang diharapkan (opsional)" : "Desired deadline (optional)"}</Label>
                  <Input type="datetime-local" value={form.desired_due_at} onChange={(e) => setForm((f) => ({ ...f, desired_due_at: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
                <Button variant="siswa" disabled={create.isPending} onClick={() => create.mutate()}>
                  {create.isPending ? (lang === "id" ? "Mengirim…" : "Sending…") : (lang === "id" ? "Kirim Permintaan" : "Send Request")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 rounded-2xl border-2 border-dashed border-siswa/40 bg-siswa/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-siswa" />
          <p className="text-muted-foreground">
            {lang === "id"
              ? "Tips: Tulis judul singkat dan jelas, sertakan materi/topik, dan tenggat yang kamu harapkan. Guru akan menerima, menolak, atau mengubahnya menjadi tugas resmi."
              : "Tip: Keep the title clear, include the topic, and a desired deadline. Your teacher will accept, decline, or convert it into an official task."}
          </p>
        </div>
      </div>

      {myRequests.length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada permintaan. Buat yang pertama!" : "No requests yet. Create your first!"} />
      ) : (
        <div className="grid gap-3">
          {myRequests.map((r) => <RequestCard key={r.id} r={r} onCancel={() => cancel.mutate(r.id)} />)}
        </div>
      )}
    </DashboardShell>
  );
}

function RequestCard({ r, onCancel }: { r: Req; onCancel: () => void }) {
  const { lang } = useLang();
  const badge = {
    pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-700", label: lang === "id" ? "Menunggu" : "Pending" },
    accepted: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700", label: lang === "id" ? "Diterima" : "Accepted" },
    declined: { icon: XCircle, cls: "bg-destructive/15 text-destructive", label: lang === "id" ? "Ditolak" : "Declined" },
    converted: { icon: Sparkles, cls: "bg-primary/15 text-primary", label: lang === "id" ? "Jadi Tugas ✨" : "Converted to Task ✨" },
    cancelled: { icon: XCircle, cls: "bg-muted text-muted-foreground", label: lang === "id" ? "Dibatalkan" : "Cancelled" },
  }[r.status];
  const Icon = badge.icon;
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-bold">{r.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {r.classes?.name && <span>📚 {r.classes.name} · </span>}
            {r.subject && <span>{r.subject} · </span>}
            {format(new Date(r.created_at), "dd MMM yyyy HH:mm")}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-display font-bold ${badge.cls}`}>
          <Icon className="size-3.5" /> {badge.label}
        </span>
      </div>
      {r.description && <p className="mt-2 text-sm text-foreground/80">{r.description}</p>}
      {r.desired_due_at && (
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "id" ? "Tenggat harapan" : "Desired due"}: {format(new Date(r.desired_due_at), "dd MMM yyyy HH:mm")}
        </p>
      )}
      {r.teacher_note && (
        <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs italic text-foreground/80">
          💬 {r.teacher_note}
        </div>
      )}
      {r.status === "pending" && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancel}>
            <Trash2 className="size-4" /> {lang === "id" ? "Batalkan" : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
}
