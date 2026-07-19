import { createFileRoute } from "@tanstack/react-router";

function fmt(dt: string) {
  return new Date(dt).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string | null | undefined) {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export const Route = createFileRoute("/api/public/calendar/$token/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token = params.token.replace(/\.ics$/, "");
        const { data: feed } = await supabaseAdmin
          .from("teacher_calendar_feeds")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!feed) return new Response("Not found", { status: 404 });

        const { data: events } = await supabaseAdmin
          .from("events")
          .select("id, title, description, location, start_at, end_at")
          .eq("teacher_id", feed.user_id)
          .order("start_at", { ascending: true });

        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Pelajaranku//Kegiatan//ID",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "X-WR-CALNAME:Pelajaranku - Kegiatan Kelas",
          "X-WR-TIMEZONE:Asia/Jakarta",
        ];
        for (const e of events ?? []) {
          const end = e.end_at ?? new Date(new Date(e.start_at).getTime() + 3600_000).toISOString();
          lines.push(
            "BEGIN:VEVENT",
            `UID:${e.id}@eduquest`,
            `DTSTAMP:${fmt(new Date().toISOString())}`,
            `DTSTART:${fmt(e.start_at)}`,
            `DTEND:${fmt(end)}`,
            `SUMMARY:${esc(e.title)}`,
            `DESCRIPTION:${esc(e.description)}`,
            `LOCATION:${esc(e.location)}`,
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          status: 200,
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
