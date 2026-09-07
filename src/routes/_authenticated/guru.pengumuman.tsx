import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2, Pin, MessageCircle, Smile } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/pengumuman")({
  head: () => ({ meta: [{ title: "Papan Pengumuman · Pelajaranku" }] }),
  component: GuruPengumumanPage,
});

type AForm = { class_id: string; title: string; body: string; pinned: boolean };
const emptyForm = (): AForm => ({ class_id: "", title: "", body: "", pinned: false });

function GuruPengumumanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AForm>(emptyForm());

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: role === "admin" ? "/admin" : "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").eq("teacher_id", user!.id).order("name")).data ?? [],
  });

  const { data: items = [] } = useQuery({
    queryKey: ["guru-announcements", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*, classes(name), announcement_reactions(emoji, user_id), announcement_comments(id, body, user_id, created_at)")
        .eq("teacher_id", user!.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const commenterIds = Array.from(new Set(rows.flatMap((r: any) => (r.announcement_comments ?? []).map((c: any) => c.user_id))));
      const { data: profs } = commenterIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", commenterIds)
        : { data: [] as any[] };
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      return rows.map((r: any) => ({
        ...r,
        comments: (r.announcement_comments ?? [])
          .map((c: any) => ({ ...c, name: nameById.get(c.user_id) ?? "—" }))
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.class_id || !form.title.trim() || !form.body.trim()) throw new Error(t("required"));
      const { error } = await supabase.from("announcements").insert({
        teacher_id: user.id,
        class_id: form.class_id,
        title: form.title.trim(),
        body: form.body.trim(),
        pinned: form.pinned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Pengumuman dikirim" : "Announcement posted");
      setOpen(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["guru-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("announcements").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Pengumuman dihapus" : "Deleted"); qc.invalidateQueries({ queryKey: ["guru-announcements"] }); },
  });

  const togglePin = useMutation({
    mutationFn: async (a: any) => { const { error } = await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guru-announcements"] }),
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navAnnouncements")}
        subtitle={lang === "id" ? "Sampaikan informasi ke siswa & lihat reaksi serta masukan mereka" : "Share info with students & see their reactions and feedback"}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(emptyForm()); }}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {lang === "id" ? "Pengumuman Baru" : "New Announcement"}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{lang === "id" ? "Pengumuman Baru" : "New Announcement"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("navClasses")}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{lang === "id" ? "Judul" : "Title"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{lang === "id" ? "Isi Pengumuman" : "Message"}</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} />
                  <Label>{lang === "id" ? "Sematkan di atas" : "Pin to top"}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{lang === "id" ? "Kirim" : "Post"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {items.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada pengumuman." : "No announcements yet."} /> : (
        <div className="space-y-4">
          {items.map((a: any) => <AnnouncementCard key={a.id} a={a} onDelete={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(a.id); }} onPin={() => togglePin.mutate(a)} lang={lang} />)}
        </div>
      )}
    </DashboardShell>
  );
}

function AnnouncementCard({ a, onDelete, onPin, lang }: { a: any; onDelete: () => void; onPin: () => void; lang: string }) {
  const reactionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of a.announcement_reactions ?? []) map[r.emoji] = (map[r.emoji] ?? 0) + 1;
    return Object.entries(map).sort((x, y) => y[1] - x[1]);
  }, [a.announcement_reactions]);

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-magic text-white"><Megaphone className="size-4" /></div>
          <div>
            <div className="flex items-center gap-2 font-display font-bold">{a.pinned && <Pin className="size-3.5 text-guru" />}{a.title}</div>
            <div className="text-xs text-muted-foreground">{a.classes?.name} · {format(new Date(a.created_at), "dd MMM yyyy HH:mm")}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onPin} title={lang === "id" ? "Sematkan" : "Pin"}><Pin className={`size-4 ${a.pinned ? "text-guru" : "text-muted-foreground"}`} /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 text-muted-foreground"><Smile className="size-4" /></span>
        {reactionCounts.length === 0
          ? <span className="text-xs text-muted-foreground">{lang === "id" ? "Belum ada reaksi" : "No reactions yet"}</span>
          : reactionCounts.map(([emoji, count]) => (
              <span key={emoji} className="rounded-full border-2 border-border bg-muted/40 px-2 py-0.5 text-sm">{emoji} {count}</span>
            ))}
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-display font-semibold text-muted-foreground">
          <MessageCircle className="size-3.5" /> {lang === "id" ? "Masukan siswa" : "Student feedback"} ({a.comments.length})
        </div>
        {a.comments.length === 0 ? (
          <div className="text-xs text-muted-foreground">{lang === "id" ? "Belum ada masukan." : "No feedback yet."}</div>
        ) : (
          <ul className="space-y-2">
            {a.comments.map((c: any) => (
              <li key={c.id} className="rounded-lg bg-card p-2 text-sm shadow-soft">
                <div className="font-display font-semibold text-primary">{c.name}</div>
                <div className="text-foreground/80">{c.body}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
