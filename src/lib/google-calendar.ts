/** Helpers for Google Calendar integration. */

function fmt(d: Date): string {
  // Google Calendar template expects UTC basic format: YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build a Google Calendar "Add event" template URL.
 * Opens Google Calendar with details pre-filled — works without any login/API.
 */
export function gcalTemplateUrl(opts: {
  title: string;
  start: string | Date;
  end?: string | Date | null;
  details?: string | null;
  location?: string | null;
}): string {
  const start = new Date(opts.start);
  const end = opts.end ? new Date(opts.end) : new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (opts.details) params.set("details", opts.details);
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
