import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/siswa/pengumuman")({
  head: () => ({ meta: [{ title: "Papan Pengumuman · Pelajaranku" }] }),
  component: SiswaPengumumanPage,
});

const REACTIONS = ["👍", "❤️", "🎉", "🔥", "🤲", "👏"];

function SiswaPengumumanPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["siswa-announcements", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*, classes(name), announcement_reactions(id, emoji, user_id), announcement_comments(id, body, user_id, created_at)")
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

  const reactMut = useMutation({
    mutationFn: async ({ a, emoji }: { a: any; emoji: string }) => {
      const mine = (a.announcement_reactions ?? []).find((r: any) => r.user_id === user!.id);
      if (mine && mine.emoji === emoji) {
        const { error } = await supabase.from("announcement_reactions").delete().eq("id", mine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcement_reactions")
          .upsert({ announcement_id: a.id, user_id: user!.id, emoji }, { onConflict: "announcement_id,user_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["siswa-announcements"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const commentMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from("announcement_comments").insert({ announcement_id: id, user_id: user!.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "id" ? "Masukan terkirim" : "Feedback sent"); qc.invalidateQueries({ queryKey: ["siswa-announcements"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCommentMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("announcement_comments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["siswa-announcements"] }),
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("navAnnouncements")} subtitle={lang === "id" ? "Pengumuman dari gurumu — beri reaksi & sampaikan masukan" : "Announcements from your teacher — react & give feedback"} />
      {items.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada pengumuman." : "No announcements yet."} /> : (
        <div className="space-y-4">
          {items.map((a: any) => (
            <StudentAnnouncementCard
              key={a.id}
              a={a}
              userId={user!.id}
              lang={lang}
              onReact={(emoji) => reactMut.mutate({ a, emoji })}
              onComment={(body) => commentMut.mutate({ id: a.id, body })}
              onDeleteComment={(id) => deleteCommentMut.mutate(id)}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function StudentAnnouncementCard({ a, userId, lang, onReact, onComment, onDeleteComment }: {
  a: any; userId: string; lang: string;
  onReact: (emoji: string) => void; onComment: (body: string) => void; onDeleteComment: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const myReaction = (a.announcement_reactions ?? []).find((r: any) => r.user_id === userId)?.emoji ?? null;
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of a.announcement_reactions ?? []) map[r.emoji] = (map[r.emoji] ?? 0) + 1;
    return map;
  }, [a.announcement_reactions]);

  const submit = () => { if (draft.trim()) { onComment(draft); setDraft(""); } };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-sunset text-white"><Megaphone className="size-4" /></div>
        <div>
          <div className="flex items-center gap-2 font-display font-bold">{a.pinned && <Pin className="size-3.5 text-accent" />}{a.title}</div>
          <div className="text-xs text-muted-foreground">{a.classes?.name} · {format(new Date(a.created_at), "dd MMM yyyy HH:mm")}</div>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {REACTIONS.map((emoji) => {
          const active = myReaction === emoji;
          const count = counts[emoji] ?? 0;
          return (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-sm transition-all hover:scale-105 ${active ? "border-accent bg-accent/15" : "border-border bg-muted/30"}`}
            >
              <span className="text-base">{emoji}</span>
              {count > 0 && <span className="font-display text-xs font-bold">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-display font-semibold text-muted-foreground">
          <MessageCircle className="size-3.5" /> {lang === "id" ? "Masukan & Diskusi" : "Feedback & Discussion"} ({a.comments.length})
        </div>
        {a.comments.length > 0 && (
          <ul className="mb-2 space-y-2">
            {a.comments.map((c: any) => (
              <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg bg-card p-2 text-sm shadow-soft">
                <div className="min-w-0">
                  <div className="font-display font-semibold text-primary">{c.name}{c.user_id === userId && (lang === "id" ? " (Kamu)" : " (You)")}</div>
                  <div className="text-foreground/80">{c.body}</div>
                </div>
                {c.user_id === userId && (
                  <button onClick={() => onDeleteComment(c.id)} aria-label="delete"><Trash2 className="size-3.5 text-destructive" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={lang === "id" ? "Tulis masukan / feedback…" : "Write feedback…"}
          />
          <Button size="icon" variant="siswa" onClick={submit} disabled={!draft.trim()}><Send className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
