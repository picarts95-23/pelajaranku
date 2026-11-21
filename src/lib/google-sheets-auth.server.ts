// Server-only Google auth for the Spreadsheet backup/export. Talks to Google
// directly (no Lovable connector gateway). Two ways to authenticate; the first
// one configured wins:
//
//  1. Service account (recommended; tokens never expire):
//       GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
//     Optional GOOGLE_SHEETS_OWNER_EMAIL: new spreadsheets created by the
//     service account are shared (writer) with this Google account so a human
//     can open them.
//  2. OAuth refresh token of your own Google account:
//       GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SHEETS_REFRESH_TOKEN
//     NOTE: if the OAuth consent screen is still in "Testing" mode, Google
//     expires refresh tokens after 7 days. Publish the app ("In production").

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const SHEETS_API = "https://sheets.googleapis.com/v4";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export const SHEETS_NOT_CONFIGURED =
  "Google Spreadsheet belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (atau GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SHEETS_REFRESH_TOKEN).";

let cached: { token: string; expiresAt: number } | null = null;

function b64url(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Google token [${res.status}]: ${text}`);
    throw new Error(`Gagal masuk ke Google (${res.status}). Periksa kredensial Google Spreadsheet.`);
  }
  return res.json();
}

async function serviceAccountToken(email: string, privateKey: string) {
  // Env vars often store the PEM with literal "\n" sequences.
  const pem = privateKey.replace(/\\n/g, "\n");
  const base64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, scope: SCOPES, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)),
  );
  return tokenRequest({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claim}.${b64url(signature)}`,
  });
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const refresh = process.env.GOOGLE_SHEETS_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  let result: { access_token: string; expires_in: number };
  if (saEmail && saKey) {
    result = await serviceAccountToken(saEmail, saKey);
  } else if (refresh && clientId && clientSecret) {
    result = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret,
    });
  } else {
    throw new Error(SHEETS_NOT_CONFIGURED);
  }
  cached = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  return result.access_token;
}

/** Authorization headers for Google Sheets API requests. */
export async function getSheetsHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/**
 * Best-effort: share a spreadsheet created by the service account with the
 * human owner so it is visible in their Google Drive. No-op for OAuth mode
 * (the file already lives in that account) or when no owner email is set.
 */
export async function shareWithOwner(spreadsheetId: string, headers: Record<string, string>): Promise<void> {
  const owner = process.env.GOOGLE_SHEETS_OWNER_EMAIL;
  if (!owner || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return;
  try {
    const res = await fetch(`${DRIVE_FILES_URL}/${spreadsheetId}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: owner }),
    });
    if (!res.ok) console.error(`Google Drive share [${res.status}]: ${await res.text()}`);
  } catch (e) {
    console.error("Google Drive share failed", e);
  }
}
