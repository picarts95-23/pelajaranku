import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAuthUrl,
  signState,
  callbackPath,
  getValidAccessToken,
  pushCalendarEvent,
} from "./google-calendar.server";

function originFromRequest(): string {
  const url = new URL(getRequestUrl());
  return url.origin;
}

/** Current Google Calendar connection status for the signed-in teacher. */
export const getGcalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("google_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, email: data?.google_email ?? null };
  });

/** Build the Google consent URL to start the OAuth flow. */
export const getGcalAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GCAL_STATE_SECRET) {
      throw new Error("Google Calendar belum dikonfigurasi.");
    }
    const redirectUri = `${originFromRequest()}${callbackPath()}`;
    const state = signState(context.userId);
    return { url: buildAuthUrl(state, redirectUri) };
  });

/** Disconnect the teacher's Google Calendar. */
export const disconnectGcal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Push one of the teacher's events to their Google Calendar. */
export const syncEventToGcal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .eq("teacher_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!event) throw new Error("Kegiatan tidak ditemukan.");

    const accessToken = await getValidAccessToken(context.userId);
    if (!accessToken) throw new Error("Hubungkan Google Kalender terlebih dahulu.");

    const googleEventId = await pushCalendarEvent({
      accessToken,
      googleEventId: event.google_event_id,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.start_at,
      end: event.end_at,
    });

    await supabaseAdmin
      .from("events")
      .update({ google_event_id: googleEventId })
      .eq("id", event.id);

    return { ok: true, googleEventId };
  });
