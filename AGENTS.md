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
