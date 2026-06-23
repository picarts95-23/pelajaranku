// Scheduled (and externally-callable) endpoint that copies the whole app
// database into the single persistent Google Spreadsheet backup.
// Lives under /api/public/* so pg_cron can reach it without an auth session;
// we still require the project anon key in the `apikey` header to stop random
// callers from triggering syncs.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runSheetSync } = await import("@/lib/sheets-sync.server");
          const result = await runSheetSync();
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Sync failed";
          console.error("[sync-sheets]", message);
          // Record the failure so teachers can see it in the UI.
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("sheet_sync_state").upsert({
              id: 1,
              last_synced_at: new Date().toISOString(),
              last_status: `error: ${message.slice(0, 200)}`,
            });
          } catch { /* ignore secondary failures */ }
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
