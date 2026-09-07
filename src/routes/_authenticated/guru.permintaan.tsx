import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, CheckCircle2, XCircle, Clock, Sparkles, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/permintaan")({
  head: () => ({ meta: [{ title: "Permintaan Tugas · Pelajaranku" }] }),
  component: GuruPermintaanPage,
});

type Req = {
  id: string;
  student_id: string;
  class_id: string | null;
  subject: string | null;
  title: string;
  description: string | null;
  desired_due_at: string | null;
  status: "pending" | "accepted" | "declined" | "converted" | "cancelled";
  teacher_note: string | null;
  created_at: string;
  responded_at: string | null;
  assignment_id: string | null;
  classes?: { name: string } | null;
  profiles?: { full_name: string; class_name: string | null } | null;
};

function GuruPermintaanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [respondFor, setRespondFor] = useState<Req | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: role === "admin" ? "/admin" : "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: requests = [] } = useQuery({
    queryKey: ["teacher-task-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_requests")
        .select("*, classes(name)")
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.student_id).filter(Boolean)));
      let profMap: Record<string, { full_name: string; class_name: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, class_name").in("id", ids);
        (profs ?? []).forEach((p: any) => { profMap[p.id] = { full_name: p.full_name, class_name: p.class_name }; });
      }
      return rows.map((r) => ({ ...r, profiles: profMap[r.student_id] ?? null })) as Req[];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status, teacher_note }: { id: string; status: "accepted" | "declined"; teacher_note: string }) => {
      const { error } = await supabase
        .from("task_requests")
        .update({ status, teacher_note: teacher_note || null, responded_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Permintaan diperbarui" : "Request updated");
      setRespondFor(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["teacher-task-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const answered = requests.filter((r) => r.status !== "pending");

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={lang === "id" ? "Permintaan Tugas dari Siswa" : "Task Requests from Students"}
        subtitle={lang === "id" ? "Terima, tolak, atau ubah menjadi tugas resmi lewat menu Tugas." : "Accept, decline, or convert into an official task via the Tugas menu."}
      />

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            <Clock className="mr-1.5 size-4" /> {lang === "id" ? "Menunggu" : "Pending"}
            {pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="done">
            <CheckCircle2 className="mr-1.5 size-4" /> {lang === "id" ? "Riwayat" : "History"}
            {answered.length > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{answered.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
            <EmptyState message={lang === "id" ? "Tidak ada permintaan yang menunggu." : "No pending requests."} />
          ) : (
            <div className="grid gap-3">
              {pending.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  onAccept={() => { setRespondFor({ ...r, status: "accepted" as any }); setNote(""); }}
                  onDecline={() => { setRespondFor({ ...r, status: "declined" as any }); setNote(""); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="done">
          {answered.length === 0 ? (
            <EmptyState message={lang === "id" ? "Belum ada riwayat." : "No history yet."} />
          ) : (
            <div className="grid gap-3">
              {answered.map((r) => <RequestCard key={r.id} r={r} readonly />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!respondFor} onOpenChange={(o) => !o && setRespondFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondFor?.status === "accepted"
                ? (lang === "id" ? "Terima Permintaan" : "Accept Request")
                : (lang === "id" ? "Tolak Permintaan" : "Decline Request")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <div className="font-display font-bold">{respondFor?.title}</div>
              {respondFor?.description && <div className="text-xs text-muted-foreground">{respondFor.description}</div>}
            </div>
            <Textarea rows={3} placeholder={lang === "id" ? "Catatan untuk siswa (opsional)" : "Note for student (optional)"}
              value={note} onChange={(e) => setNote(e.target.value)} />
            {respondFor?.status === "accepted" && (
              <p className="text-xs text-muted-foreground">
                💡 {lang === "id"
                  ? "Setelah menerima, buka menu Tugas untuk membuat tugas resmi berdasarkan permintaan ini."
                  : "After accepting, open Tugas to create the official task based on this request."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRespondFor(null)}>{lang === "id" ? "Batal" : "Cancel"}</Button>
            <Button
              variant={respondFor?.status === "accepted" ? "guru" : "destructive"}
              disabled={respond.isPending || !respondFor}
              onClick={() => respondFor && respond.mutate({ id: respondFor.id, status: respondFor.status as any, teacher_note: note })}
            >
              {respond.isPending ? "…" : respondFor?.status === "accepted" ? (lang === "id" ? "Terima" : "Accept") : (lang === "id" ? "Tolak" : "Decline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function RequestCard({ r, onAccept, onDecline, readonly }: { r: Req; onAccept?: () => void; onDecline?: () => void; readonly?: boolean }) {
  const { lang } = useLang();
  const badge = {
    pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-700", label: lang === "id" ? "Menunggu" : "Pending" },
    accepted: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700", label: lang === "id" ? "Diterima" : "Accepted" },
    declined: { icon: XCircle, cls: "bg-destructive/15 text-destructive", label: lang === "id" ? "Ditolak" : "Declined" },
    converted: { icon: Sparkles, cls: "bg-primary/15 text-primary", label: lang === "id" ? "Jadi Tugas ✨" : "Task ✨" },
    cancelled: { icon: XCircle, cls: "bg-muted text-muted-foreground", label: lang === "id" ? "Dibatalkan" : "Cancelled" },
  }[r.status];
  const Icon = badge.icon;
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-bold">{r.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{r.profiles?.full_name ?? "—"}</span>
            {r.profiles?.class_name && <span> · {r.profiles.class_name}</span>}
            {r.classes?.name && <span> · 📚 {r.classes.name}</span>}
            {r.subject && <span> · {r.subject}</span>}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {format(new Date(r.created_at), "dd MMM yyyy HH:mm")}
            {r.desired_due_at && <> · {lang === "id" ? "harap" : "wants"}: {format(new Date(r.desired_due_at), "dd MMM HH:mm")}</>}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-display font-bold ${badge.cls}`}>
          <Icon className="size-3.5" /> {badge.label}
        </span>
      </div>
      {r.description && <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">{r.description}</p>}
      {r.teacher_note && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs italic">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" /> {r.teacher_note}
        </div>
      )}
      {!readonly && r.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="guru" onClick={onAccept}><CheckCircle2 className="size-4" /> {lang === "id" ? "Terima" : "Accept"}</Button>
          <Button size="sm" variant="destructive" onClick={onDecline}><XCircle className="size-4" /> {lang === "id" ? "Tolak" : "Decline"}</Button>
          <Link to="/guru/tugas"><Button size="sm" variant="outline"><ExternalLink className="size-4" /> {lang === "id" ? "Buat Tugas" : "Create Task"}</Button></Link>
        </div>
      )}
    </div>
  );
}
