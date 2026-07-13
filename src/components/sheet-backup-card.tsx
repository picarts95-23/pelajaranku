import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, ExternalLink, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { syncDatabaseToSheet, getSheetSyncStatus } from "@/lib/google-sheets.functions";

export function SheetBackupCard() {
  const { lang } = useLang();
  const [syncing, setSyncing] = useState(false);
  const statusFn = useServerFn(getSheetSyncStatus);
  const syncFn = useServerFn(syncDatabaseToSheet);

  const { data: status, refetch } = useQuery({
    queryKey: ["sheet-sync-status"],
    queryFn: () => statusFn(),
  });

  async function runSync() {
    setSyncing(true);
    const tid = toast.loading(lang === "id" ? "Menyalin database ke Spreadsheet…" : "Backing up database to Sheets…");
    try {
      const res = await syncFn();
      toast.success(lang === "id" ? "Backup berhasil!" : "Backup complete!", {
        id: tid,
        action: { label: lang === "id" ? "Buka" : "Open", onClick: () => window.open(res.url, "_blank") },
      });
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? (lang === "id" ? "Backup gagal." : "Backup failed."), { id: tid });
    } finally {
      setSyncing(false);
    }
  }

  const ok = status?.lastStatus === "ok";
  const failed = status?.lastStatus && status.lastStatus.startsWith("error");

  return (
    <section className="mt-6 rounded-3xl border-2 border-emerald-500/40 bg-emerald-500/5 p-5 shadow-card-rpg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-600 text-white shadow-soft">
            <Cloud className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">
              {lang === "id" ? "Backup Database ke Google Spreadsheet" : "Database Backup to Google Sheets"}
            </h2>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              {lang === "id"
                ? "Salinan otomatis data Anda (kelas, siswa, presensi + nilai kehadiran, tugas, nilai, Mutaba'ah, materi) ke spreadsheet pribadi Anda — setiap guru punya file sendiri sesuai email, diperbarui otomatis setiap hari."
                : "Automatic copy of your data (classes, students, attendance + scores, tasks, grades, Mutaba'ah, materials) into your own spreadsheet — each teacher has a separate file tied to their email, refreshed daily."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {status?.lastSyncedAt ? (
                <span className={`inline-flex items-center gap-1 font-display font-semibold ${failed ? "text-destructive" : "text-emerald-700"}`}>
                  {ok && <CheckCircle2 className="size-3.5" />}
                  {lang === "id" ? "Terakhir disinkronkan" : "Last synced"}: {format(new Date(status.lastSyncedAt), "dd MMM yyyy HH:mm")}
                </span>
              ) : (
                <span className="text-muted-foreground">{lang === "id" ? "Belum pernah disinkronkan." : "Not synced yet."}</span>
              )}
              {failed && <span className="text-destructive">· {status?.lastStatus}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.url && (
            <a href={status.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="size-4" /> {lang === "id" ? "Buka Spreadsheet" : "Open Sheet"}
              </Button>
            </a>
          )}
          <Button size="sm" disabled={syncing} onClick={runSync} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {lang === "id" ? "Sinkron sekarang" : "Sync now"}
          </Button>
        </div>
      </div>
    </section>
  );
}
