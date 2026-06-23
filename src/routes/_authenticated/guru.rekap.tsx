import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, GraduationCap, Trophy, Save, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru/rekap")({
  head: () => ({ meta: [{ title: "Rekap Nilai · EduQuest Academy" }] }),
  component: GuruRekapPage,
});

// Attendance status -> weight (%)
const ATT_WEIGHT: Record<string, number> = { hadir: 100, izin: 60, sakit: 60, alpa: 0 };

function predicate(score: number, lang: string) {
  if (score >= 90) return { label: "A", tone: "text-emerald-600" };
  if (score >= 80) return { label: "B", tone: "text-xp" };
  if (score >= 70) return { label: "C", tone: "text-coin" };
  return { label: lang === "id" ? "Perlu Perbaikan" : "Needs work", tone: "text-destructive" };
}

function GuruRekapPage() {
  return (
    <DashboardShell accent="guru"><div>HELLO-REKAP</div></DashboardShell>
  );
}
