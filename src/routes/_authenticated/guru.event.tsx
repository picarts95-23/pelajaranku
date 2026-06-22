import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, MapPin, RefreshCw, Link as LinkIcon, Unlink, Loader2 } from "lucide-react";
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
import { LinkFields, LinkBadges } from "@/components/link-fields";
import { gcalTemplateUrl } from "@/lib/google-calendar";
import { getGcalStatus, getGcalAuthUrl, disconnectGcal, syncEventToGcal } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/_authenticated/guru/event")({
  head: () => ({ meta: [{ title: "Kegiatan · EduQuest Academy" }] }),
  component: GuruEventPage,
});

function GuruEventPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", title: "", description: "", location: "", start_at: "", end_at: "", quiz_link: "", game_link: "" });

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("events").select("*, classes(name)").order("start_at", { ascending: true })).data ?? [],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user || !form.class_id || !form.title || !form.start_at) throw new Error(t("required"));
      const { error } = await supabase.from("events").insert({
        teacher_id: user.id, class_id: form.class_id, title: form.title,
        description: form.description || null, location: form.location || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        quiz_link: form.quiz_link.trim() || null, game_link: form.game_link.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Kegiatan dibuat" : "Event created");
      setOpen(false); setForm({ class_id: "", title: "", description: "", location: "", start_at: "", end_at: "", quiz_link: "", game_link: "" });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("events").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  // Google Calendar full account sync
  const statusFn = useServerFn(getGcalStatus);
  const authUrlFn = useServerFn(getGcalAuthUrl);
  const disconnectFn = useServerFn(disconnectGcal);
  const syncFn = useServerFn(syncEventToGcal);

  const gcalQ = useQuery({
    queryKey: ["gcal-status", user?.id],
    enabled: !!user,
    queryFn: () => statusFn(),
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get("gcal");
    if (g === "success") {
      toast.success(lang === "id" ? "Google Kalender terhubung" : "Google Calendar connected");
      qc.invalidateQueries({ queryKey: ["gcal-status"] });
    } else if (g === "error") {
      toast.error(lang === "id" ? "Gagal menghubungkan Google Kalender" : "Failed to connect Google Calendar");
    }
    if (g) window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectMut = useMutation({
    mutationFn: async () => { const { url } = await authUrlFn(); window.location.href = url; },
    onError: (e: Error) => toast.error(e.message),
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => { toast.success(lang === "id" ? "Terputus" : "Disconnected"); qc.invalidateQueries({ queryKey: ["gcal-status"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncMut = useMutation({
    mutationFn: (eventId: string) => syncFn({ data: { eventId } }),
    onSuccess: () => { toast.success(lang === "id" ? "Tersinkron ke Google Kalender" : "Synced to Google Calendar"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const connected = gcalQ.data?.connected;

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navEvents")} subtitle={lang === "id" ? "Agenda dan kegiatan kelas" : "Class agenda and events"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="guru"><Plus className="size-4" /> {t("newEvent")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newEvent")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("navClasses")}</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectClass")} /></SelectTrigger>
                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>{t("location")}</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("startAt")}</Label><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></div>
                  <div><Label>{t("endAt")}</Label><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></div>
                </div>
                <LinkFields quizLink={form.quiz_link} gameLink={form.game_link} onQuiz={(v) => setForm({ ...form, quiz_link: v })} onGame={(v) => setForm({ ...form, game_link: v })} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button variant="guru" disabled={createMut.isPending} onClick={() => createMut.mutate()}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      {events.length === 0 ? <EmptyState message={t("empty")} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e: any) => (
            <div key={e.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-gradient-quest text-quest-foreground"><CalendarDays className="size-5" /></div>
                  <div>
                    <div className="font-display font-bold">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.classes?.name} · {format(new Date(e.start_at), "dd MMM yyyy HH:mm")}</div>
                    {e.location && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{e.location}</div>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${t("delete")}?`)) deleteMut.mutate(e.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
              {e.description && <p className="mt-3 text-sm text-foreground/80">{e.description}</p>}
              <LinkBadges quizLink={e.quiz_link} gameLink={e.game_link} />
              <a
                href={gcalTemplateUrl({ title: e.title, start: e.start_at, end: e.end_at, details: e.description, location: e.location })}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-quest/10 px-3 py-1 text-xs font-display font-bold text-quest hover:bg-quest/20"
              >
                <CalendarDays className="size-3.5" /> {lang === "id" ? "Tambah ke Google Kalender" : "Add to Google Calendar"}
              </a>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
