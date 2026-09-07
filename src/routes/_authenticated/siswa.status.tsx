import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { NotebookPen, Send, Trash2, MessageCircle, Smile } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatar } from "@/lib/character-roster";

export const Route = createFileRoute("/_authenticated/siswa/status")({
  head: () => ({ meta: [{ title: "Status & Komentar · Pelajaranku" }] }),
  component: SiswaStatusPage,
});

const REACTIONS = ["❤️", "👍", "🎉", "🔥", "😊", "😮", "👏", "🌟"];
const MOODS = ["😄", "📚", "💪", "😴", "🤔", "🥳", "🤲", "😅"];

type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null; character_key: string | null };

function SiswaStatusPage() {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: role === "admin" ? "/admin" : "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: feed = [] } = useQuery({
    queryKey: ["status-feed"], enabled: !!user,
    queryFn: async () => {
      const { data: statuses } = await supabase.from("statuses").select("*").order("created_at", { ascending: false }).limit(50);
      const list = statuses ?? [];
      if (list.length === 0) return [];
      const ids = list.map((s) => s.id);
      const authorIds = Array.from(new Set(list.map((s) => s.author_id)));
      const [{ data: comments }, { data: reactions }, { data: profs }] = await Promise.all([
        supabase.from("status_comments").select("*").in("status_id", ids).order("created_at", { ascending: true }),
        supabase.from("status_reactions").select("*").in("status_id", ids),
        supabase.from("profiles").select("id, full_name, avatar_url, character_key").in("id", authorIds),
      ]);
      const commentAuthorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
      const missing = commentAuthorIds.filter((id) => !authorIds.includes(id));
      let allProfs = (profs ?? []) as ProfileLite[];
      if (missing.length > 0) {
        const { data: extra } = await supabase.from("profiles").select("id, full_name, avatar_url, character_key").in("id", missing);
        allProfs = [...allProfs, ...((extra ?? []) as ProfileLite[])];
      }
      const profMap = new Map(allProfs.map((p) => [p.id, p]));
      return list.map((s) => ({
        ...s,
        author: profMap.get(s.author_id) ?? null,
        comments: (comments ?? []).filter((c) => c.status_id === s.id).map((c) => ({ ...c, author: profMap.get(c.author_id) ?? null })),
        reactions: (reactions ?? []).filter((r) => r.status_id === s.id),
      }));
    },
  });

  const postMut = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) throw new Error(lang === "id" ? "Tulis sesuatu dulu" : "Write something first");
      const { error } = await supabase.from("statuses").insert({ author_id: user.id, content: content.trim(), mood });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Status diposting! ✨" : "Status posted! ✨");
      setContent(""); setMood(null);
      qc.invalidateQueries({ queryKey: ["status-feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={lang === "id" ? "Status & Komentar" : "Status & Comments"} subtitle={lang === "id" ? "Bagikan momen belajarmu dan beri reaksi ke teman" : "Share your learning moments and react to friends"} />

      <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
        <div className="flex gap-3">
          <img src={resolveAvatar(profile as any, "siswa")} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full border-2 border-border object-cover" />
          <div className="flex-1 space-y-3">
            <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} maxLength={500}
              placeholder={lang === "id" ? "Apa yang sedang kamu pelajari hari ini?" : "What are you learning today?"} />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">{lang === "id" ? "Suasana:" : "Mood:"}</span>
              {MOODS.map((m) => (
                <button key={m} type="button" onClick={() => setMood(mood === m ? null : m)}
                  className={`rounded-full border-2 px-2 py-0.5 text-lg transition-all hover:scale-110 ${mood === m ? "border-accent bg-accent/15" : "border-transparent bg-muted/40"}`}>{m}</button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{content.length}/500</span>
              <Button variant="siswa" disabled={postMut.isPending || !content.trim()} onClick={() => postMut.mutate()}>
                <NotebookPen className="size-4" /> {lang === "id" ? "Posting" : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {feed.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada status. Jadilah yang pertama berbagi!" : "No status yet. Be the first to share!"} /> : (
          feed.map((s: any, i: number) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <StatusCard status={s} />
            </motion.div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}

function StatusCard({ status }: { status: any }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["status-feed"] });

  const reactMut = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user) return;
      const mine = status.reactions.find((r: any) => r.user_id === user.id && r.emoji === emoji);
      if (mine) {
        const { error } = await supabase.from("status_reactions").delete().eq("id", mine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("status_reactions").insert({ status_id: status.id, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!user || !comment.trim()) return;
      const { error } = await supabase.from("status_comments").insert({ status_id: status.id, author_id: user.id, content: comment.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setComment(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStatusMut = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("statuses").delete().eq("id", status.id); if (error) throw error; },
    onSuccess: () => { toast.success(lang === "id" ? "Status dihapus" : "Status deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCommentMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("status_comments").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
  });

  const grouped: Record<string, number> = {};
  for (const r of status.reactions) grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
  const myEmojis = new Set(status.reactions.filter((r: any) => r.user_id === user?.id).map((r: any) => r.emoji));

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex items-start gap-3">
        <img src={resolveAvatar(status.author ?? { id: status.author_id }, "siswa")} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full border-2 border-border object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-display font-bold">{status.author?.full_name ?? (lang === "id" ? "Siswa" : "Student")}</span>
              <span className="ml-2 text-xs text-muted-foreground">{formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}</span>
            </div>
            {status.author_id === user?.id && (
              <Button size="icon" variant="ghost" onClick={() => { if (confirm(lang === "id" ? "Hapus status ini?" : "Delete this status?")) deleteStatusMut.mutate(); }}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{status.mood && <span className="mr-1 text-lg">{status.mood}</span>}{status.content}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {REACTIONS.map((emoji) => {
              const count = grouped[emoji] ?? 0;
              const active = myEmojis.has(emoji);
              return (
                <button key={emoji} type="button" disabled={reactMut.isPending} onClick={() => reactMut.mutate(emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-sm transition-all hover:scale-105 ${active ? "border-accent bg-accent/15 font-bold" : "border-border bg-muted/30"} ${count === 0 ? "opacity-60" : ""}`}>
                  <span className="text-base">{emoji}</span>{count > 0 && <span className="font-display text-xs">{count}</span>}
                </button>
              );
            })}
          </div>

          <button type="button" onClick={() => setShowComments((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-display font-semibold text-muted-foreground hover:text-accent">
            <MessageCircle className="size-4" /> {status.comments.length} {lang === "id" ? "Komentar" : "Comments"}
          </button>

          {showComments && (
            <div className="mt-3 space-y-3 border-t-2 border-dashed border-border pt-3">
              {status.comments.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2">
                  <img src={resolveAvatar(c.author ?? { id: c.author_id }, "siswa")} alt="" width={32} height={32} className="size-8 shrink-0 rounded-full border-2 border-border object-cover" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold">{c.author?.full_name ?? (lang === "id" ? "Siswa" : "Student")}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="break-words text-sm text-foreground/90">{c.content}</p>
                  </div>
                  {c.author_id === user?.id && (
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => deleteCommentMut.mutate(c.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Smile className="size-4 shrink-0 text-muted-foreground" />
                <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300}
                  onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMut.mutate(); }}
                  placeholder={lang === "id" ? "Tulis komentar…" : "Write a comment…"} />
                <Button size="icon" variant="siswa" disabled={!comment.trim() || commentMut.isPending} onClick={() => commentMut.mutate()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
