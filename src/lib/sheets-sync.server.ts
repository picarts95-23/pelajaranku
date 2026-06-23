// Server-only helper that mirrors the app database into ONE persistent Google
// Spreadsheet (the "automatic backup"). It is invoked by the public cron route
// and by the teacher-triggered server function. Never import this from client
// code — it uses the service-role admin client and connector gateway secrets.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

/** Tables copied into the backup spreadsheet, one tab each. */
const TABLES: { table: string; tab: string; columns: string[]; order?: string }[] = [
  { table: "classes", tab: "Kelas", columns: ["id", "name", "code", "subject", "academic_year", "created_at"], order: "created_at" },
  { table: "profiles", tab: "Siswa", columns: ["id", "full_name", "username", "class_name", "subject", "xp", "level", "coins", "created_at"], order: "full_name" },
  { table: "assignments", tab: "Tugas", columns: ["id", "class_id", "title", "subject", "exam_type", "max_score", "due_at", "created_at"], order: "created_at" },
  { table: "submissions", tab: "Pengumpulan", columns: ["id", "assignment_id", "student_id", "status", "score", "feedback", "submitted_at", "graded_at"], order: "created_at" },
  { table: "attendance", tab: "Presensi", columns: ["id", "class_id", "student_id", "date", "status", "note", "created_at"], order: "date" },
  { table: "adab_scores", tab: "Nilai Adab", columns: ["id", "class_id", "student_id", "subject", "score", "updated_at"], order: "updated_at" },
  { table: "materials", tab: "Materi", columns: ["id", "class_id", "subject", "title", "description", "created_at"], order: "created_at" },
  { table: "material_reads", tab: "Materi Dibaca", columns: ["id", "material_id", "user_id", "note", "updated_at"], order: "updated_at" },
];

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Spreadsheet belum terhubung. Hubungkan akun Google terlebih dahulu.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function fetchTableRows(table: string, columns: string[], order?: string): Promise<string[][]> {
  let q = supabaseAdmin.from(table).select(columns.join(",")).limit(5000);
  if (order) q = q.order(order, { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  return [columns, ...rows.map((r) => columns.map((c) => cell(r[c])))];
}

/** Create a fresh spreadsheet containing one empty tab per table. */
async function createSpreadsheet(headers: Record<string, string>) {
  const title = `Backup Database EduQuest · ${new Date().toLocaleDateString("id-ID")}`;
  const res = await fetch(`${GATEWAY_URL}/spreadsheets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: { title },
      sheets: TABLES.map((t) => ({ properties: { title: t.tab } })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal membuat spreadsheet (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as { spreadsheetId: string; spreadsheetUrl: string };
}

/** Return existing tab titles, or null if the spreadsheet is gone (404). */
async function getExistingTabs(spreadsheetId: string, headers: Record<string, string>): Promise<string[] | null> {
  const res = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal membaca spreadsheet (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (json.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

async function addMissingTabs(spreadsheetId: string, existing: string[], headers: Record<string, string>) {
  const missing = TABLES.filter((t) => !existing.includes(t.tab));
  if (missing.length === 0) return;
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requests: missing.map((t) => ({ addSheet: { properties: { title: t.tab } } })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal menambah tab (${res.status}): ${body.slice(0, 200)}`);
  }
}

async function writeTab(spreadsheetId: string, tab: string, values: string[][], headers: Record<string, string>) {
  // Clear the whole tab first so removed rows don't linger, then write fresh.
  const clearRes = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${tab}!A:ZZ:clear`,
    { method: "POST", headers, body: "{}" },
  );
  if (!clearRes.ok) {
    const body = await clearRes.text();
    throw new Error(`Gagal mengosongkan tab ${tab} (${clearRes.status}): ${body.slice(0, 200)}`);
  }
  const writeRes = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=RAW`,
    { method: "PUT", headers, body: JSON.stringify({ values }) },
  );
  if (!writeRes.ok) {
    const body = await writeRes.text();
    throw new Error(`Gagal menulis tab ${tab} (${writeRes.status}): ${body.slice(0, 200)}`);
  }
}

export type SyncResult = { url: string; spreadsheetId: string; tables: number; syncedAt: string };

/**
 * Mirror every configured table into the single persistent backup spreadsheet,
 * creating it on first run. Returns the spreadsheet URL.
 */
export async function runSheetSync(): Promise<SyncResult> {
  const headers = gatewayHeaders();

  // 1. Resolve (or create) the persistent spreadsheet.
  const { data: state } = await supabaseAdmin
    .from("sheet_sync_state").select("spreadsheet_id, spreadsheet_url").eq("id", 1).maybeSingle();

  let spreadsheetId = (state as { spreadsheet_id?: string } | null)?.spreadsheet_id ?? null;
  let spreadsheetUrl = (state as { spreadsheet_url?: string } | null)?.spreadsheet_url ?? null;

  if (spreadsheetId) {
    const tabs = await getExistingTabs(spreadsheetId, headers);
    if (tabs === null) {
      spreadsheetId = null; // spreadsheet was deleted — recreate below
      spreadsheetUrl = null;
    } else {
      await addMissingTabs(spreadsheetId, tabs, headers);
    }
  }

  if (!spreadsheetId) {
    const created = await createSpreadsheet(headers);
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
  }

  // 2. Write each table into its tab.
  for (const t of TABLES) {
    const values = await fetchTableRows(t.table, t.columns, t.order);
    await writeTab(spreadsheetId, t.tab, values, headers);
  }

  const syncedAt = new Date().toISOString();

  // 3. Persist sync state.
  await supabaseAdmin.from("sheet_sync_state").upsert({
    id: 1,
    spreadsheet_id: spreadsheetId,
    spreadsheet_url: spreadsheetUrl,
    last_synced_at: syncedAt,
    last_status: "ok",
  });

  return { url: spreadsheetUrl ?? "", spreadsheetId, tables: TABLES.length, syncedAt };
}
