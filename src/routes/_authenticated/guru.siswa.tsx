import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Trophy, Coins, Star } from "lucide-react";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/siswa")({
  head: () => ({ meta: [{ title: "Siswa · EduQuest Madrasah" }] }),
  component: GuruSiswaPage,
});

function GuruSiswaPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [filterClass, setFilterClass] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && role && role !== "guru") navigate({ to: "/dashboard/siswa" });
  }, [role, loading, navigate]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.id, filterClass],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("class_enrollments").select("student_id, class_id, classes(name)");
      if (filterClass !== "all") query = query.eq("class_id", filterClass);
      const { data: enrolls } = await query;
      const ids = Array.from(new Set((enrolls ?? []).map((e) => e.student_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      return (profiles ?? []).map((p) => ({
        ...p,
        classes: (enrolls ?? []).filter((e) => e.student_id === p.id).map((e: any) => e.classes?.name).filter(Boolean),
      }));
    },
  });

  const filtered = students.filter((s: any) => !q || s.full_name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <DashboardShell accent="guru">
      <PageHeader title={t("navStudents")} subtitle={lang === "id" ? "Daftar semua siswa di kelas Anda" : "All students across your classes"} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-9" />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "id" ? "Semua kelas" : "All classes"}</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card-rpg">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("fullName")}</th>
                <th className="px-4 py-3 hidden sm:table-cell">{t("schoolId")}</th>
                <th className="px-4 py-3 hidden md:table-cell">{t("navClasses")}</th>
                <th className="px-4 py-3 text-right">{t("level")}</th>
                <th className="px-4 py-3 text-right">{t("xp")}</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">{t("coins")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-display font-semibold">
                    <div className="flex items-center gap-3">
                      <div className="grid size-8 place-items-center rounded-lg bg-siswa text-xs font-bold text-white">
                        {(s.full_name ?? "?").charAt(0)}
                      </div>
                      {s.full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{s.school_id_number ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s.classes?.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-display text-xs font-bold text-primary">
                      <Star className="size-3" /> {s.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-display text-xs font-bold text-xp">
                      <Trophy className="size-3" /> {s.xp}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-coin font-display font-bold"><Coins className="size-3" /> {s.coins}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
