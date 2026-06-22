import { createHmac, timingSafeEqual } from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export function callbackPath() {
  return "/api/public/google/calendar/callback";
}

/** HMAC-sign a state payload (the teacher's user id) to prevent tampering. */
export function signState(userId: string): string {
  const secret = process.env.GCAL_STATE_SECRET!;
  const ts = Date.now().toString();
  const body = `${userId}.${ts}`;
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifyState(state: string): string | null {
  try {
    const secret = process.env.GCAL_STATE_SECRET!;
    const parts = state.split(".");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = createHmac("sha256", secret).update(`${userId}.${ts}`).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    // 15 minute validity
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

/** Returns a valid access token for the user, refreshing if expired. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  const expired = !data.token_expiry || new Date(data.token_expiry).getTime() < Date.now() + 60_000;
  if (!expired) return data.access_token;
  if (!data.refresh_token) return data.access_token;

  const refreshed = await refreshAccessToken(data.refresh_token);
  const expiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, token_expiry: expiry })
    .eq("user_id", userId);
  return refreshed.access_token;
}

export async function upsertConnection(opts: {
  userId: string;
  email: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiry = new Date(Date.now() + opts.expiresIn * 1000).toISOString();
  const row: Record<string, unknown> = {
    user_id: opts.userId,
    google_email: opts.email,
    access_token: opts.accessToken,
    token_expiry: expiry,
  };
  if (opts.refreshToken) row.refresh_token = opts.refreshToken;
  await supabaseAdmin.from("google_calendar_connections").upsert(row, { onConflict: "user_id" });
}

/** Insert (or update) an event on the user's primary Google Calendar. */
export async function pushCalendarEvent(opts: {
  accessToken: string;
  googleEventId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end?: string | null;
}): Promise<string> {
  const startDate = new Date(opts.start);
  const endDate = opts.end ? new Date(opts.end) : new Date(startDate.getTime() + 60 * 60 * 1000);
  const body = {
    summary: opts.title,
    description: opts.description ?? undefined,
    location: opts.location ?? undefined,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
  };
  const url = opts.googleEventId ? `${CALENDAR_EVENTS_URL}/${opts.googleEventId}` : CALENDAR_EVENTS_URL;
  const method = opts.googleEventId ? "PATCH" : "POST";
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${opts.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar event failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}
