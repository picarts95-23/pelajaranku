import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/guru")({
  head: () => ({ meta: [{ title: "Dashboard Guru · EduQuest RPG" }] }),
  component: GuruDashboard,
});

function GuruDashboard() {
  return <DashboardShell accent="guru"><div>HELLO-DASH</div></DashboardShell>;
}
