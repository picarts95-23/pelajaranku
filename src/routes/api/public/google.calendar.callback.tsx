import { createFileRoute } from "@tanstack/react-router";
import {
  callbackPath,
  exchangeCode,
  verifyState,
  getUserEmail,
  upsertConnection,
} from "@/lib/google-calendar.server";

function redirect(origin: string, status: "success" | "error") {
  return new Response(null, {
    status: 302,
    headers: { location: `${origin}/guru/event?gcal=${status}` },
  });
}

export const Route = createFileRoute("/api/public/google/calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) return redirect(origin, "error");

        const userId = verifyState(state);
        if (!userId) return redirect(origin, "error");

        try {
          const redirectUri = `${origin}${callbackPath()}`;
          const tokens = await exchangeCode(code, redirectUri);
          const email = await getUserEmail(tokens.access_token);
          await upsertConnection({
            userId,
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
          });
          return redirect(origin, "success");
        } catch (e) {
          console.error("Google Calendar callback error", e);
          return redirect(origin, "error");
        }
      },
    },
  },
});
