import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonthCalendar } from "@/components/month-calendar";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LinkBadges } from "@/components/link-fields";
import { gcalTemplateUrl } from "@/lib/google-calendar";

export const Route = createFileRoute("/_authenticated/siswa/event")({
  head: () => ({ meta: [{ title: "Kegiatan · Pelajaranku" }] }),
  component: SiswaEventPage,
});

function SiswaEventPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();

  useEffect(() => {
    if (!loading && role && role !== "siswa") navigate({ to: "/dashboard/guru" });
  }, [role, loading, navigate]);

  const { data: events = [] } = useQuery({
    queryKey: ["siswa-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // RLS ("Class members view events") already limits to classes the
      // student is enrolled in, so a plain SELECT is enough.
      const { data } = await supabase
        .from("events")
        .select("*, classes(name)")
        .order("start_at", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <DashboardShell accent="siswa">
      <PageHeader
        title={lang === "id" ? "Kegiatan" : "Events"}
        subtitle={lang === "id" ? "Agenda kelas dari guru — pantau jadwal & acara" : "Class agenda from teachers"}
      />

      <Tabs defaultValue="calendar">
        <TabsList className="mb-3">
          <TabsTrigger value="calendar">{lang === "id" ? "Kalender" : "Calendar"}</TabsTrigger>
          <TabsTrigger value="list">{lang === "id" ? "Daftar" : "List"}</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0">
          <MonthCalendar
            lang={lang}
            events={events.map((e: any) => ({
              id: e.id, title: e.title, start_at: e.start_at, end_at: e.end_at, className: e.classes?.name ?? null,
            }))}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {events.length === 0 ? <EmptyState message={lang === "id" ? "Belum ada kegiatan" : "No events yet"} /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map((e: any) => (
                <div key={e.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-card-rpg">
                  <div className="flex items-start gap-3">
                    <div className="grid size-12 place-items-center rounded-xl bg-gradient-quest text-quest-foreground">
                      <CalendarDays className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.classes?.name} · {format(new Date(e.start_at), "dd MMM yyyy HH:mm")}
                      </div>
                      {e.location && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />{e.location}
                        </div>
                      )}
                    </div>
                  </div>
                  {e.description && <p className="mt-3 text-sm text-foreground/80">{e.description}</p>}
                  <LinkBadges quizLink={e.quiz_link} gameLink={e.game_link} />
                  <div className="mt-3">
                    <a
                      href={gcalTemplateUrl({ title: e.title, start: e.start_at, end: e.end_at, details: e.description, location: e.location })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-quest/10 px-3 py-1 text-xs font-display font-bold text-quest hover:bg-quest/20"
                    >
                      <CalendarDays className="size-3.5" /> {lang === "id" ? "Tambah ke Kalender" : "Add to Calendar"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
