import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

type SheetPayload = {
  title: string;
  /** First row = header, following rows = data. Every cell is already a string. */
  values: string[][];
};

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets belum terhubung. Hubungkan akun Google terlebih dahulu.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

/**
 * Creates a brand-new Google Spreadsheet in the connected Google account and
 * writes the supplied table into it. Returns the shareable spreadsheet URL.
 * Only teachers (guru) may trigger an export.
 */
export const exportToGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SheetPayload) => {
    if (!input || typeof input.title !== "string" || !Array.isArray(input.values)) {
      throw new Error("Data ekspor tidak valid.");
    }
    return {
      title: input.title.slice(0, 120) || "Rekap EduQuest",
      values: input.values.slice(0, 5000).map((row) => row.map((c) => String(c ?? ""))),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("Hanya guru yang dapat mengekspor ke Google Spreadsheet.");

    const headers = gatewayHeaders();

    // 1. Create the spreadsheet.
    const createRes = await fetch(`${GATEWAY_URL}/spreadsheets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: { title: data.title },
        sheets: [{ properties: { title: "Data" } }],
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Gagal membuat spreadsheet (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl: string };

    // 2. Write the table values.
    if (data.values.length > 0) {
      const range = "Data!A1";
      const writeRes = await fetch(
        `${GATEWAY_URL}/spreadsheets/${created.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
        { method: "PUT", headers, body: JSON.stringify({ values: data.values }) },
      );
      if (!writeRes.ok) {
        const body = await writeRes.text();
        throw new Error(`Gagal menulis data (${writeRes.status}): ${body.slice(0, 300)}`);
      }
    }

    return { url: created.spreadsheetUrl, spreadsheetId: created.spreadsheetId };
  });

/**
 * Teacher-triggered run of the automatic full-database backup into the single
 * persistent spreadsheet. The same routine runs on a schedule via the public
 * cron route; this lets a teacher force a sync immediately.
 */
export const syncDatabaseToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("Hanya guru yang dapat menyalin database ke Google Spreadsheet.");
    const { runSheetSync } = await import("@/lib/sheets-sync.server");
    return runSheetSync();
  });

/** Read the current backup status (spreadsheet link + last sync time). */
export const getSheetSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("Hanya guru yang dapat melihat status backup.");
    const { data } = await supabase
      .from("sheet_sync_state")
      .select("spreadsheet_url, last_synced_at, last_status")
      .eq("id", 1)
      .maybeSingle();
    return {
      url: (data as { spreadsheet_url?: string } | null)?.spreadsheet_url ?? null,
      lastSyncedAt: (data as { last_synced_at?: string } | null)?.last_synced_at ?? null,
      lastStatus: (data as { last_status?: string } | null)?.last_status ?? null,
    };
  });
