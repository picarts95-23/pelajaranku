import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Trophy, Crown, Star, Coins, Plus, Pencil, Trash2, Gift, X, Sparkles, Users, Check, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { BADGE_EMOJIS } from "@/lib/badge-emojis";
import { BADGE_CATALOG, CATALOG_TOTAL, type CatalogBadge } from "@/lib/badge-catalog";

export const Route = createFileRoute("/_authenticated/guru/gamifikasi")({
  head: () => ({ meta: [{ title: "Gamifikasi · Pelajaranku" }] }),
  component: GuruGamifikasiPage,
});

type BadgeForm = { id?: string; name: string; description: string; icon: string; xp_requirement: number };
const EMPTY_FORM: BadgeForm = { name: "", description: "", icon: "🏅", xp_requirement: 0 };

function slugCode(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "badge";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function GuruGamifikasiPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BadgeForm>(EMPTY_FORM);
  const [awardStudent, setAwardStudent] = useState("");
  const [awardBadge, setAwardBadge] = useState("");
  const [awardClass, setAwardClass] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogGroup, setCatalogGroup] = useState<string>(BADGE_CATALOG[0].key);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => { if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" }); }, [role, loading, navigate]);

  const { data: badges = [] } = useQuery({
    queryKey: ["badges"], queryFn: async () => (await supabase.from("badges").select("*").order("xp_requirement")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["gami-students", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: enrolls } = await supabase
        .from("class_enrollments")
        .select("student_id, classes!inner(teacher_id)")
        .eq("classes.teacher_id", user!.id);
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, xp").in("id", ids);
      return (profs ?? []).sort((a: any, b: any) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "", "id", { sensitivity: "base" }));
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["gami-classes", user?.id], enabled: !!user,
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").eq("teacher_id", user!.id).order("name")).data ?? [],
  });

  const studentIds = students.map((s: any) => s.id);


  const { data: awards = [] } = useQuery({
    queryKey: ["badge-awards", studentIds.join(",")], enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("id, user_id, badge_id, earned_at")
        .in("user_id", studentIds)
        .order("earned_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard-all", studentIds.join(",")], enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", studentIds).order("xp", { ascending: false }).limit(20);
      return profs ?? [];
    },
  });

  const studentName = (id: string) => students.find((s: any) => s.id === id)?.full_name ?? "—";
  const badgeById = (id: string) => badges.find((b: any) => b.id === id);

  const saveBadge = useMutation({
    mutationFn: async (f: BadgeForm) => {
      const payload = {
        name: f.name.trim(),
        description: f.description.trim() || null,
        icon: f.icon.trim() || "🏅",
        xp_requirement: Math.max(0, Math.round(f.xp_requirement) || 0),
      };
      if (f.id) {
        const { error } = await supabase.from("badges").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("badges").insert({ ...payload, code: slugCode(f.name) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("badgeSaved"));
      qc.invalidateQueries({ queryKey: ["badges"] });
      setOpen(false); setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("badgeDeleted")); qc.invalidateQueries({ queryKey: ["badges"] }); qc.invalidateQueries({ queryKey: ["badge-awards"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const award = useMutation({
    mutationFn: async () => {
      if (!awardStudent || !awardBadge) throw new Error(lang === "id" ? "Pilih siswa dan badge" : "Select student and badge");
      const exists = (awards as any[]).some((a) => a.user_id === awardStudent && a.badge_id === awardBadge);
      if (exists) throw new Error(t("alreadyHasBadge"));
      const { error } = await supabase.from("user_badges").insert({ user_id: awardStudent, badge_id: awardBadge });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("badgeAwarded"));
      qc.invalidateQueries({ queryKey: ["badge-awards"] });
      setAwardBadge("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("badgeRevoked")); qc.invalidateQueries({ queryKey: ["badge-awards"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const existingNames = new Set((badges as any[]).map((b) => (b.name ?? "").toLowerCase().trim()));

  const importCatalog = useMutation({
    mutationFn: async (items: CatalogBadge[]) => {
      const rows = items
        .filter((it) => !existingNames.has(it.name.toLowerCase().trim()))
        .map((it) => ({
          code: slugCode(it.name),
          name: it.name,
          description: it.description,
          icon: it.icon,
          xp_requirement: it.xp_requirement ?? 0,
        }));
      if (rows.length === 0) throw new Error(lang === "id" ? "Semua badge terpilih sudah ada." : "All selected badges already exist.");
      const { error } = await supabase.from("badges").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(lang === "id" ? `${n} badge ditambahkan dari katalog` : `${n} badges added from catalog`);
      qc.invalidateQueries({ queryKey: ["badges"] });
      setPicked([]); setCatalogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const awardToClass = useMutation({
    mutationFn: async () => {
      if (!awardClass || !awardBadge) throw new Error(lang === "id" ? "Pilih kelas dan badge" : "Select class and badge");
      const { data: enrolls, error: eErr } = await supabase
        .from("class_enrollments").select("student_id").eq("class_id", awardClass);
      if (eErr) throw eErr;
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.student_id)));
      if (ids.length === 0) throw new Error(lang === "id" ? "Kelas ini belum ada siswa." : "No students in this class.");
      const { data: have } = await supabase
        .from("user_badges").select("user_id").eq("badge_id", awardBadge).in("user_id", ids);
      const already = new Set((have ?? []).map((r: any) => r.user_id));
      const rows = ids.filter((id) => !already.has(id)).map((id) => ({ user_id: id, badge_id: awardBadge }));
      if (rows.length === 0) throw new Error(t("alreadyHasBadge"));
      const { error } = await supabase.from("user_badges").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(lang === "id" ? `Badge diberikan ke ${n} siswa` : `Badge awarded to ${n} students`);
      qc.invalidateQueries({ queryKey: ["badge-awards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function togglePick(name: string) {
    setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }
  const activeGroup = BADGE_CATALOG.find((g) => g.key === catalogGroup) ?? BADGE_CATALOG[0];
  const pickedItems = BADGE_CATALOG.flatMap((g) => g.badges).filter((b) => picked.includes(b.name));


  function openNew() { setForm(EMPTY_FORM); setOpen(true); }
  function openEdit(b: any) {
    setForm({ id: b.id, name: b.name, description: b.description ?? "", icon: b.icon ?? "🏅", xp_requirement: b.xp_requirement ?? 0 });
    setOpen(true);
  }

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navGamification")} subtitle={lang === "id" ? "Kelola badge dan pantau leaderboard murid" : "Manage badges and watch the student leaderboard"} />

      {/* Badge management */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold flex items-center gap-2"><Award className="size-5 text-coin" /> {t("manageBadges")}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
              <LibraryBig className="size-4" /> {lang === "id" ? `Katalog Badge (${CATALOG_TOTAL})` : `Badge Catalog (${CATALOG_TOTAL})`}
            </Button>
            <Button variant="guru" size="sm" onClick={openNew}><Plus className="size-4" /> {t("newBadge")}</Button>
          </div>
        </div>
        {badges.length === 0 ? <EmptyState message={t("empty")} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((b: any) => (
              <div key={b.id} className="group rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-magic text-white text-xl">{b.icon ?? "🏅"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{b.description}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {b.xp_requirement > 0
                    ? <span className="text-xs text-muted-foreground">≥ {b.xp_requirement} XP</span>
                    : <span className="text-xs text-muted-foreground">{lang === "id" ? "Manual" : "Manual"}</span>}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(b)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive"
                      onClick={() => { if (confirm(t("deleteBadgeConfirm"))) deleteBadge.mutate(b.id); }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Award badge */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Gift className="size-5 text-quest" /> {t("awardBadgeTo")}</h2>
        <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
          <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
            <Select value={awardStudent} onValueChange={setAwardStudent}>
              <SelectTrigger><SelectValue placeholder={t("selectStudent")} /></SelectTrigger>
              <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={awardBadge} onValueChange={setAwardBadge}>
              <SelectTrigger><SelectValue placeholder={t("selectBadge")} /></SelectTrigger>
              <SelectContent>{badges.map((b: any) => <SelectItem key={b.id} value={b.id}>{(b.icon ?? "🏅") + " " + b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="guru" disabled={!awardStudent || !awardBadge || award.isPending} onClick={() => award.mutate()}>
              <Award className="size-4" /> {t("awardBadge")}
            </Button>
          </div>

          <div className="mt-3 grid gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-3 sm:grid-cols-[1fr,auto] sm:items-center">
            <div className="grid gap-2 sm:grid-cols-[auto,1fr] sm:items-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="size-4" /> {lang === "id" ? "Beri ke satu kelas" : "Award to a class"}
              </span>
              <Select value={awardClass} onValueChange={setAwardClass}>
                <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih kelas" : "Select class"} /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" disabled={!awardClass || !awardBadge || awardToClass.isPending} onClick={() => awardToClass.mutate()}>
              <Sparkles className="size-4" /> {lang === "id" ? "Beri ke Semua Siswa Kelas" : "Award Whole Class"}
            </Button>
          </div>


          <div className="mt-4">
            <h3 className="mb-2 text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">{t("recentAwards")}</h3>
            {awards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAwardsYet")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {(awards as any[]).map((a) => {
                  const b = badgeById(a.badge_id);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-gradient-magic text-white text-sm">{b?.icon ?? "🏅"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-display font-semibold truncate">{studentName(a.user_id)}</div>
                        <div className="text-xs text-muted-foreground truncate">{b?.name ?? "—"} · {new Date(a.earned_at).toLocaleDateString(lang === "id" ? "id-ID" : "en-US")}</div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke.mutate(a.id)}>
                        <X className="size-3.5" /> {t("revoke")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Trophy className="size-5 text-quest" /> {t("leaderboard")}</h2>
        {leaderboard.length === 0 ? <EmptyState message={t("empty")} /> : (
          <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card shadow-card-rpg">
            <table className="w-full min-w-[540px] text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">{t("fullName")}</th><th className="px-4 py-3 text-right">{t("level")}</th><th className="px-4 py-3 text-right">{t("xp")}</th><th className="px-4 py-3 text-right">{t("coins")}</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((p: any, i: number) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-display font-bold">{i === 0 ? <Crown className="size-4 text-coin" /> : i + 1}</td>
                    <td className="px-4 py-3 font-display font-semibold">{p.full_name}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-primary"><Star className="size-3" /> {p.level}</span></td>
                    <td className="px-4 py-3 text-right font-display font-bold text-xp">{p.xp}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-coin"><Coins className="size-3" /> {p.coins}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Badge form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? t("editBadge") : t("newBadge")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("badgeName")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("badgeName")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("badgeDescription")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("badgeIcon")}</Label>
              <div className="flex items-center gap-3">
                <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-magic text-3xl text-white shadow-card-rpg">{form.icon || "🏅"}</div>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} placeholder="🏅" className="text-center text-xl" />
              </div>
              <div className="mt-1 max-h-44 space-y-2 overflow-y-auto rounded-xl border-2 border-border bg-muted/30 p-2">
                {BADGE_EMOJIS.map((group) => (
                  <div key={group.label}>
                    <div className="mb-1 px-1 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                    <div className="grid grid-cols-10 gap-1">
                      {group.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setForm({ ...form, icon: em })}
                          className={`grid aspect-square place-items-center rounded-lg text-xl transition-colors hover:bg-quest/20 ${form.icon === em ? "bg-quest/25 ring-2 ring-quest" : "bg-card"}`}
                          aria-label={em}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("xpRequirement")}</Label>
              <Input type="number" min={0} value={form.xp_requirement}
                onChange={(e) => setForm({ ...form, xp_requirement: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button variant="guru" disabled={!form.name.trim() || saveBadge.isPending} onClick={() => saveBadge.mutate(form)}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
