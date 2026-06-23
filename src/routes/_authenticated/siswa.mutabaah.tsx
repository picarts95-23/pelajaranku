import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Sparkles } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { RecordCard } from "./guru.mutabaah";

export const Route = createFileRoute("/_authenticated/siswa/mutabaah")({
  head: () => ({ meta: [{ title: "Mutaba'ah Tahfidz · EduQuest Academy" }] }),
  component: SiswaMutabaahPage,
});

function SiswaMutabaahPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();

  useEffect(() => { if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" }); }, [role, loading, navigate]);

  const { data: records = [] } = useQuery({
    queryKey: ["siswa-mutabaah", user?.id], enabled: !!user,
    queryFn: async () => (await (supabase as any).from("tahfidz_mutabaah").select("*, classes(name)").order("session_date", { ascending: false })).data ?? [],
  });

  const list = records as any[];
  const avg = list.length ? Math.round(list.reduce((s, r) => s + (r.total_score ?? 0), 0) / list.length) : null;

  return (
    <DashboardShell accent="siswa">
      <PageHeader title={lang === "id" ? "Mutaba'ah Tahfidz" : "Tahfidz Mutaba'ah"} subtitle={lang === "id" ? "Riwayat penilaian setoran hafalanmu di Halaqoh Tahfidz" : "Your Halaqoh Tahfidz assessment history"} />
      {list.length === 0 ? (
        <EmptyState message={lang === "id" ? "Belum ada penilaian Mutaba'ah dari gurumu." : "No Mutaba'ah records from your teacher yet."} />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-siswa/40 bg-siswa/5 p-4">
            <div className="grid size-12 place-items-center rounded-xl bg-gradient-magic text-white"><Sparkles className="size-6" /></div>
            <div>
              <div className="text-xs text-muted-foreground">{lang === "id" ? "Rata-rata nilai" : "Average score"}</div>
              <div className="font-display text-2xl font-bold text-primary">{avg ?? "—"} <span className="text-sm font-normal text-muted-foreground">· {list.length} {lang === "id" ? "setoran" : "sessions"}</span></div>
            </div>
            <BookOpenCheck className="ml-auto size-8 text-siswa/40" />
          </div>
          <div className="space-y-3">
            {list.map((r) => <RecordCard key={r.id} r={r} lang={lang} />)}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
