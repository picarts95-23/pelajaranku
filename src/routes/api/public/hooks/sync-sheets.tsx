// Scheduled (and externally-callable) endpoint that copies the whole app
// database into the single persistent Google Spreadsheet backup.
// Lives under /api/public/* so pg_cron can reach it without an auth session;
// callers must present the private sync token stored in the database vault.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Requires the private backup token kept in the database vault (not the
        // public publishable key), verified by a service-role-only function.
        const token = request.headers.get("x-sync-token") || "";
        let ok = false;
        if (token.length >= 32 && token.length <= 200) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.rpc("verify_sheet_sync_token", { _token: token });
          ok = data === true;
        }
        if (!ok) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runAllTeacherSheetSync } = await import("@/lib/sheets-sync.server");
          const result = await runAllTeacherSheetSync();
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Sync failed";
          console.error("[sync-sheets]", message);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
