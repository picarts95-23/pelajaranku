import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStoredSpreadsheet } from "./sheet-backup-data";

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
 * Writes an export tab in the teacher's existing backup spreadsheet.
 * Only teachers (guru) may trigger an export.
 */
export const exportToGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SheetPayload) => {
     if (!input || typeof input.title !== "string" || !Array.isArray(input.values) || !input.values.every(Array.isArray)) {
      throw new Error("Data ekspor tidak valid.");
    }
    return {
      title: input.title.slice(0, 120) || "Rekap Pelajaranku",
      values: input.values.slice(0, 5000).map((row) => row.map((c) => String(c ?? ""))),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("Hanya guru yang dapat mengekspor ke Google Spreadsheet.");

    const headers = gatewayHeaders();

    const { data: state, error } = await supabase.from("teacher_sheet_sync")
      .select("spreadsheet_id, spreadsheet_url").eq("teacher_id", userId).maybeSingle();
    if (error) throw error;
    const stored = requireStoredSpreadsheet(state);
    const tab = `Ekspor · ${data.title}`.replace(/[\[\]:*?/\\]/g, " ").slice(0, 100);
    const base = `${GATEWAY_URL}/spreadsheets/${stored.spreadsheetId}`;
    async function request(url: string, init?: RequestInit) {
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Google Sheets [${res.status}]: ${body}`);
        throw new Error(`Google Sheets (${res.status}): ${body}`);
      }
      return res;
    }
    const meta = await (await request(`${base}?fields=sheets.properties.title`)).json() as { sheets?: { properties?: { title?: string } }[] };
    if (!meta.sheets?.some((s) => s.properties?.title === tab)) {
      await request(`${base}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
    }
    const quoted = `'${tab.replace(/'/g, "''")}'`;
    await request(`${base}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: [`${quoted}!A:ZZ`] }) });
    if (data.values.length > 0) {
      await request(`${base}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: [{ range: `${quoted}!A1`, values: data.values }] }) });
    }
    return stored;
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
    const { runSheetSyncForTeacher } = await import("@/lib/sheets-sync.server");
    return runSheetSyncForTeacher(userId);
  });

/** Read the current backup status (spreadsheet link + last sync time). */
export const getSheetSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("Hanya guru yang dapat melihat status backup.");
    const { data } = await (supabase as any)
      .from("teacher_sheet_sync")
      .select("spreadsheet_url, last_synced_at, last_status")
      .eq("teacher_id", userId)
      .maybeSingle();
    return {
      url: (data as { spreadsheet_url?: string } | null)?.spreadsheet_url ?? null,
      lastSyncedAt: (data as { last_synced_at?: string } | null)?.last_synced_at ?? null,
      lastStatus: (data as { last_status?: string } | null)?.last_status ?? null,
    };
  });
