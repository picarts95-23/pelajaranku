<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the shared service-worker context check for registration and offline status so preview and unsupported contexts never promise offline readiness.
- Restore interactive quiz progress only when the dialog opens, and pause its timer while closed, so background refetches cannot restart or submit an attempt.
- Admin roster reads paginate every source and fail on query errors; archive/delete protections run server-side so UI controls are not the security boundary.
- Student active-work summaries exclude expired and submitted work before display slicing, and submission mutations invalidate the summary cache.
- Sign-out cancels and clears the shared query cache before clearing the session to avoid exposing another account's cached data.
- Both student ranking views use the authenticated shared-class leaderboard RPC because enrollment RLS intentionally hides peer enrollment rows.
- Active-work filtering lives in a tested browser-safe helper; student descriptions never render serialized teacher group-assessment records.
- Teacher backup covers the full feature inventory in sheet-backup-tabs, resolves teacher_sheet_sync under caller RLS for account-scoped destinations, and writes all tabs in batched Sheets requests; never export access tokens or other credentials.
- Teacher Adab recap and save payloads use the shared adabRowsFromDraft helper to distinguish unentered scores from explicit zero.
- Keep phone-width grid constraints and viewport-safe dialogs in the shared shell/UI styles so new feature pages cannot grow beyond their visible screen.
- Request conversion reuses the teacher assignment form via validated search parameters; create_assignment_from_request atomically creates and links the assignment under caller RLS to prevent duplicate tasks and partial conversions.
- AI practice generation runs only in the authenticated generatePractice server function via Gemini (own GOOGLE_API_KEY; no gateway fallback) with a strict JSON schema; scoring/validation helpers stay in browser-safe src/lib/ai-practice.ts with tests.
