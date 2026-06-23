import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/guru/rekap")({
  head: () => ({ meta: [{ title: "Rekap Nilai · EduQuest Academy" }] }),
  component: GuruRekapPage,
});

function GuruRekapPage() {
  return (
    <DashboardShell accent="guru"><div>HELLO-REKAP</div></DashboardShell>
  );
}
