import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, GraduationCap, Library, CheckCircle2, Circle, Maximize2, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MediaViewer } from "@/components/media-input";
import { useMarkSeen } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/siswa/mapel")({
  head: () => ({ meta: [{ title: "Mata Pelajaran · Pelajaranku" }] }),
  component: SiswaMapelPage,
});

type ReadRow = { material_id: string; note: string | null };

function SiswaMapelPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [active, setActive] = useState<string>("__all");
  const [openMaterial, setOpenMaterial] = useState<any | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: materials = [] } = useQuery({
    queryKey: ["materials-siswa", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials").select("*, classes(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Per-student read markers + personal notes.
  const { data: reads = [] } = useQuery({
    queryKey: ["material-reads", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("material_reads").select("material_id, note");
      return (data ?? []) as ReadRow[];
    },
  });
  const readMap = useMemo(() => {
    const m = new Map<string, ReadRow>();
    reads.forEach((r) => m.set(r.material_id, r));
    return m;
  }, [reads]);

  // Mark materials as seen when the student opens this page (clears the "new" badge).
  const markSeen = useMarkSeen(user?.id, "materials");
  useEffect(() => { if (materials.length) markSeen(); }, [materials.length, markSeen]);

  const saveRead = useMutation({
    mutationFn: async (vars: { materialId: string; note: string }) => {
      if (!user) return;
      const { error } = await supabase.from("material_reads").upsert(
        { user_id: user.id, material_id: vars.materialId, note: vars.note || null },
        { onConflict: "user_id,material_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "id" ? "Ditandai sudah dibaca & dicatat ✅" : "Marked as read & noted ✅");
      qc.invalidateQueries({ queryKey: ["material-reads", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subjects = useMemo(() => {
    const set = new Set<string>();
    (materials as any[]).forEach((m) => { if (m.subject) set.add(m.subject); });
    return Array.from(set).sort();
  }, [materials]);

  const filtered = active === "__all" ? materials : (materials as any[]).filter((m) => m.subject === active);
  const readCount = readMap.size;

  function openFull(m: any) {
    setOpenMaterial(m);
    setNoteDraft(readMap.get(m.id)?.note ?? "");
  }

  return (
    <DashboardShell accent="siswa">
      <PageHeader
        title={t("navSubjects")}
        subtitle={lang === "id"
          ? `Materi pembelajaran yang dibagikan gurumu · ${readCount}/${materials.length} sudah dibaca`
          : `Learning materials shared by your teachers · ${readCount}/${materials.length} read`}
      />

      {materials.length === 0 ? (
        <EmptyState message={t("noMaterials")} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => setActive("__all")}
              className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-display font-semibold transition",
                active === "__all" ? "border-siswa bg-siswa text-white" : "border-border bg-card hover:border-siswa/50")}
            >
              <Library className="size-3.5" /> {lang === "id" ? "Semua" : "All"}
            </button>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-display font-semibold transition",
                  active === s ? "border-siswa bg-siswa text-white" : "border-border bg-card hover:border-siswa/50")}
              >
                <GraduationCap className="size-3.5" /> {s}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(filtered as any[]).map((m) => {
              const isRead = readMap.has(m.id);
              return (
                <div key={m.id} className={cn("rounded-2xl border-2 bg-card p-5 shadow-card-rpg transition", isRead ? "border-emerald-400/60" : "border-border")}>
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-gradient-magic text-white shrink-0"><BookOpen className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.subject && <span className="rounded-full bg-siswa/15 px-2 py-0.5 text-xs font-display font-bold text-siswa">{m.subject}</span>}
                        {m.classes?.name && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{m.classes.name}</span>}
                        <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy")}</span>
                        {isRead && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-display font-bold text-emerald-600">
                            <CheckCircle2 className="size-3" /> {lang === "id" ? "Sudah dibaca" : "Read"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 font-display text-lg font-bold">{m.title}</div>
                      {m.description && <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
                      {m.content && <p className="mt-2 whitespace-pre-wrap text-sm line-clamp-3">{m.content}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="siswa" onClick={() => openFull(m)}>
                          <Maximize2 className="size-3.5" /> {lang === "id" ? "Buka Materi" : "Open Material"}
                        </Button>
                        {m.link && (
                          <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-siswa/10 px-3 py-1.5 text-xs font-display font-bold text-siswa hover:bg-siswa/20">
                            <ExternalLink className="size-3.5" /> {t("openLink")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={!!openMaterial} onOpenChange={(o) => { if (!o) setOpenMaterial(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {openMaterial && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-1.5">
                  {openMaterial.subject && <span className="rounded-full bg-siswa/15 px-2 py-0.5 text-xs font-display font-bold text-siswa">{openMaterial.subject}</span>}
                  {openMaterial.classes?.name && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{openMaterial.classes.name}</span>}
                  <span className="text-xs text-muted-foreground">{format(new Date(openMaterial.created_at), "dd MMM yyyy")}</span>
                </div>
                <DialogTitle className="text-2xl">{openMaterial.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                {openMaterial.description && <p className="text-sm text-muted-foreground">{openMaterial.description}</p>}
                {openMaterial.content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{openMaterial.content}</p>}
                <MediaViewer mediaType={openMaterial.media_type} mediaUrl={openMaterial.media_url} />
                {openMaterial.link && (
                  <a href={openMaterial.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-siswa/10 px-3 py-1.5 text-xs font-display font-bold text-siswa hover:bg-siswa/20">
                    <ExternalLink className="size-3.5" /> {t("openLink")}
                  </a>
                )}

                <div className="rounded-xl border-2 border-dashed border-border p-3">
                  <label className="text-sm font-display font-semibold">{lang === "id" ? "Catatan Saya" : "My Note"}</label>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={lang === "id" ? "Tulis catatan / ringkasan materi ini…" : "Write a note / summary of this material…"}
                    className="mt-1.5 min-h-24"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    {readMap.has(openMaterial.id)
                      ? <><CheckCircle2 className="size-4 text-emerald-600" /> {lang === "id" ? "Sudah ditandai dibaca" : "Marked as read"}</>
                      : <><Circle className="size-4" /> {lang === "id" ? "Belum dibaca" : "Not read yet"}</>}
                  </span>
                  <Button
                    variant="siswa"
                    disabled={saveRead.isPending}
                    onClick={() => saveRead.mutate({ materialId: openMaterial.id, note: noteDraft })}
                  >
                    {readMap.has(openMaterial.id)
                      ? <><Save className="size-4" /> {lang === "id" ? "Simpan Catatan" : "Save Note"}</>
                      : <><CheckCircle2 className="size-4" /> {lang === "id" ? "Tandai Sudah Dibaca" : "Mark as Read"}</>}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
