import { createFileRoute, redirect } from "@tanstack/react-router";

// Old bookmarks now open the single, correlated Rekap Nilai & TP workspace.
export const Route = createFileRoute("/_authenticated/guru/rekap-tp")({
  beforeLoad: () => { throw redirect({ to: "/guru/rekap", replace: true }); },
});
