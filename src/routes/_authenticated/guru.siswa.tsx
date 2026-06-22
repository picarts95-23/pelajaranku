import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trophy, Coins, Star, Eye, BookOpen, UserPlus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getIslamicAvatar } from "@/lib/islamic-avatar";

export const Route = createFileRoute("/_authenticated/guru/siswa")({
  head: () => ({ meta: [{ title: "Siswa · EduQuest Academy" }] }),
  component: GuruSiswaPage,
});

type StudentRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  class_name: string | null;
  school_id_number: string | null;
  xp: number;
  level: number;
  coins: number;
  username: string | null;
  bio: string | null;
  gender: string | null;
  birthdate: string | null;
  hobby: string | null;
  motto: string | null;
  character_key: string | null;
  classes?: string[];
};

function GuruSiswaPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [filterClass, setFilterClass] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<StudentRow | null>(null);
  const [enrollClassId, setEnrollClassId] = useState("");

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
    queryKey: ["all-students", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // All registered student accounts (from sign-up), regardless of class enrollment.
      const { data: profiles, error } = await supabase.rpc("list_students");
      if (error) throw error;
      // Map enrolled class names for each student.
      const { data: enrolls } = await supabase
        .from("class_enrollments")
        .select("student_id, classes(name)");
      return (profiles ?? []).map((p: any) => ({
        ...p,
        classes: (enrolls ?? [])
          .filter((e: any) => e.student_id === p.id)
          .map((e: any) => e.classes?.name)
          .filter(Boolean),
      })) as StudentRow[];
    },
  });

  const filtered = students.filter((s) => {
    const matchesSearch =
      !q ||
      s.full_name?.toLowerCase().includes(q.toLowerCase()) ||
      s.school_id_number?.toLowerCase().includes(q.toLowerCase());
    const matchesClass =
      filterClass === "all" ||
      (s.classes ?? []).some((name) => classes.find((c: any) => c.id === filterClass)?.name === name);
    return matchesSearch && matchesClass;
  });

  return (
    <DashboardShell accent="guru">
      <PageHeader
        title={t("navStudents")}
        subtitle={lang === "id" ? "Semua siswa yang sudah mendaftar akun" : "All students who registered an account"}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-9" />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStudents")}</SelectItem>
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
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-display font-semibold">
                    <div className="flex items-center gap-3">
                      <img
                        src={getIslamicAvatar(s.id ?? s.full_name, "siswa")}
                        alt={s.full_name ?? "Siswa"}
                        width={32}
                        height={32}
                        className="size-8 rounded-lg object-cover bg-siswa/20"
                      />
                      {s.full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{s.school_id_number ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {(s.classes ?? []).length > 0 ? s.classes!.join(", ") : (
                      <span className="text-xs italic opacity-70">{t("notEnrolled")}</span>
                    )}
                  </td>
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
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(s)}>
                      <Eye className="size-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t("viewProfile")}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("studentProfile")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <img
                  src={getIslamicAvatar(selected.id ?? selected.full_name, "siswa")}
                  alt={selected.full_name ?? "Siswa"}
                  width={72}
                  height={72}
                  className="size-18 rounded-2xl object-cover bg-siswa/20 size-[72px]"
                />
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold truncate">{selected.full_name}</div>
                  {selected.username && <div className="text-sm text-muted-foreground">@{selected.username}</div>}
                  <div className="text-xs text-muted-foreground">{selected.school_id_number ?? "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatBox icon={<Star className="size-4 text-primary" />} label={t("level")} value={selected.level} />
                <StatBox icon={<Trophy className="size-4 text-xp" />} label={t("xp")} value={selected.xp} />
                <StatBox icon={<Coins className="size-4 text-coin" />} label={t("coins")} value={selected.coins} />
              </div>

              <dl className="grid gap-3 text-sm">
                <Field label={t("navClasses")} icon={<BookOpen className="size-4" />}>
                  {(selected.classes ?? []).length > 0 ? selected.classes!.join(", ") : t("notEnrolled")}
                </Field>
                <Field label={t("gender")}>{selected.gender ?? "—"}</Field>
                <Field label={t("birthdate")}>
                  {selected.birthdate ? format(new Date(selected.birthdate), "dd MMM yyyy") : "—"}
                </Field>
                <Field label={t("hobby")}>{selected.hobby ?? "—"}</Field>
                <Field label={t("motto")}>{selected.motto ?? "—"}</Field>
                <Field label={t("bio")}>{selected.bio ?? "—"}</Field>
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-border bg-muted/30 p-3 text-center">
      <div className="flex items-center justify-center gap-1">{icon}</div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <dt className="flex min-w-[110px] items-center gap-1.5 font-medium text-muted-foreground">{icon}{label}</dt>
      <dd className="min-w-0 flex-1 font-display">{children}</dd>
    </div>
  );
}
