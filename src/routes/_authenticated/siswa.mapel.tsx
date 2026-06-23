import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink, GraduationCap, Library } from "lucide-react";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MediaViewer } from "@/components/media-input";
import { useMarkSeen } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/siswa/mapel")({
  head: () => ({ meta: [{ title: "Mata Pelajaran · EduQuest Academy" }] }),
  component: SiswaMapelPage,
});

function SiswaMapelPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [active, setActive] = useState<string>("__all");

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

  // Mark materials as seen when the student opens this page (clears the "new" badge).
  const markSeen = useMarkSeen(user?.id, "materials");
  useEffect(() => { if (materials.length) markSeen(); }, [materials.length, markSeen]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    (materials as any[]).forEach((m) => { if (m.subject) set.add(m.subject); });
    return Array.from(set).sort();
  }, [materials]);

  const filtered = active === "__all" ? materials : (materials as any[]).filter((m) => m.subject === active);

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={t("navSubjects")} subtitle={lang === "id" ? "Materi pembelajaran yang dibagikan gurumu" : "Learning materials shared by your teachers"} />

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
            {(filtered as any[]).map((m) => (
              <div key={m.id} className="rounded-2xl border-2 border-border bg-card p-5 shadow-card-rpg">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-gradient-magic text-white shrink-0"><BookOpen className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.subject && <span className="rounded-full bg-siswa/15 px-2 py-0.5 text-xs font-display font-bold text-siswa">{m.subject}</span>}
                      {m.classes?.name && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-display">{m.classes.name}</span>}
                      <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy")}</span>
                    </div>
                    <div className="mt-1.5 font-display text-lg font-bold">{m.title}</div>
                    {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                    {m.content && <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>}
                    {m.link && (
                      <a href={m.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-siswa/10 px-3 py-1.5 text-xs font-display font-bold text-siswa hover:bg-siswa/20">
                        <ExternalLink className="size-3.5" /> {t("openLink")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
