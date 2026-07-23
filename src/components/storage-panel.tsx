import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Loader2, RefreshCw, Trash, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getStorageUsage, cleanupMediaStorage, BUCKETS,
  type MediaBucket, type CleanupScope, type BucketUsage,
} from "@/lib/media-cleanup.functions";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const BUCKET_LABEL: Record<MediaBucket, string> = {
  "voice-answers": "Rekaman suara siswa",
  "answer-images": "Foto jawaban siswa",
  "lesson-media": "Lampiran materi & bank soal",
};

export function StoragePanel() {
  const qc = useQueryClient();
  const usageFn = useServerFn(getStorageUsage);
  const cleanupFn = useServerFn(cleanupMediaStorage);

  const [selected, setSelected] = useState<Record<MediaBucket, boolean>>({
    "voice-answers": true,
    "answer-images": true,
    "lesson-media": true,
  });
  const [scope, setScope] = useState<CleanupScope>("orphan");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingResult, setPendingResult] = useState<string | null>(null);

  const usageQ = useQuery({
    queryKey: ["storage-usage"],
    queryFn: () => usageFn(),
    staleTime: 60_000,
  });

  const dryMut = useMutation({
    mutationFn: (vars: { buckets: MediaBucket[]; scope: CleanupScope }) =>
      cleanupFn({ data: { ...vars, dryRun: true } }),
    onSuccess: (r) => {
      setPendingResult(
        `Simulasi: ${r.totals.matched} file (${formatBytes(r.buckets.reduce((s, b) =>
          s + (r.scope === "all" ? 0 : 0), 0))}) akan dihapus dari ${r.totals.scanned} yang dipindai.`,
      );
      toast.success(`Simulasi selesai: ${r.totals.matched} file akan dihapus`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Simulasi gagal"),
  });

  const runMut = useMutation({
    mutationFn: (vars: { buckets: MediaBucket[]; scope: CleanupScope }) =>
      cleanupFn({ data: { ...vars, dryRun: false } }),
    onSuccess: (r) => {
      toast.success(`${r.totals.deleted} file terhapus (${formatBytes(r.totals.bytesFreed)} dibebaskan).`);
      qc.invalidateQueries({ queryKey: ["storage-usage"] });
      setConfirmOpen(false);
      setPendingResult(null);
    },
    onError: (e: any) => { toast.error(e?.message ?? "Penghapusan gagal"); setConfirmOpen(false); },
  });

  const chosen = (Object.entries(selected).filter(([, v]) => v).map(([k]) => k)) as MediaBucket[];
  const usage = usageQ.data;

  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
          <HardDrive className="size-6 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">Pemakaian Storage & Pembersihan Manual</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pembersihan file lama otomatis <b>sudah dinonaktifkan</b>. Semua penghapusan hanya
            terjadi ketika admin menekan tombol di bawah — pilih jenis file dan cakupan yang ingin dibersihkan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => usageQ.refetch()} disabled={usageQ.isFetching}>
          {usageQ.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Muat ulang
        </Button>
      </div>

      {/* Usage cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {usageQ.isLoading && !usage && (
          <div className="col-span-full flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Menghitung pemakaian…
          </div>
        )}
        {usage?.buckets.map((b) => (
          <UsageCard key={b.bucket} usage={b} />
        ))}
      </div>
      {usage && (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Total: <b>{usage.totals.fileCount}</b> file · <b>{formatBytes(usage.totals.totalBytes)}</b> ·
          Yatim (aman dihapus): <b>{usage.totals.orphanCount}</b> file · <b>{formatBytes(usage.totals.orphanBytes)}</b>
        </div>
      )}

      {/* Controls */}
      <div className="mt-5 space-y-4 rounded-2xl border-2 border-border bg-background p-4">
        <div>
          <Label className="mb-2 block text-sm">Jenis file yang akan dibersihkan</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {BUCKETS.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-border p-2 hover:bg-muted/30">
                <Checkbox checked={selected[b]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [b]: !!v }))} />
                <span className="text-sm">{BUCKET_LABEL[b]}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-2 block text-sm">Cakupan</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${scope === "orphan" ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" checked={scope === "orphan"} onChange={() => setScope("orphan")} className="mt-1" />
              <div>
                <div className="text-sm font-display font-semibold">Hanya file yatim (aman)</div>
                <div className="text-xs text-muted-foreground">File yang tidak dirujuk database & sudah lebih dari 7 hari.</div>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${scope === "all" ? "border-destructive bg-destructive/5" : "border-border"}`}>
              <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} className="mt-1" />
              <div>
                <div className="text-sm font-display font-semibold flex items-center gap-1">
                  <AlertTriangle className="size-3.5 text-destructive" /> Semua file di bucket
                </div>
                <div className="text-xs text-muted-foreground">Hapus SEMUA file, termasuk yang masih dipakai. Gunakan hanya untuk reset total.</div>
              </div>
            </label>
          </div>
        </div>

        {pendingResult && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-sm">{pendingResult}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline"
            disabled={chosen.length === 0 || dryMut.isPending}
            onClick={() => dryMut.mutate({ buckets: chosen, scope })}>
            {dryMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Simulasi (hitung dulu)
          </Button>
          <Button variant="destructive"
            disabled={chosen.length === 0 || runMut.isPending}
            onClick={() => setConfirmOpen(true)}>
            <Trash className="size-4" /> Hapus sekarang
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi penghapusan file</AlertDialogTitle>
            <AlertDialogDescription>
              {scope === "all"
                ? "Semua file di bucket terpilih akan dihapus permanen — termasuk file yang masih dirujuk siswa/guru. Aksi ini tidak bisa dibatalkan."
                : "File yatim (tidak lagi dirujuk database, lebih dari 7 hari) di bucket terpilih akan dihapus permanen."}
              <br /><br />
              Bucket: <b>{chosen.map((b) => BUCKET_LABEL[b]).join(", ")}</b>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); runMut.mutate({ buckets: chosen, scope }); }}
              disabled={runMut.isPending}>
              {runMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function UsageCard({ usage }: { usage: BucketUsage }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{usage.label}</div>
      <div className="mt-1 font-display text-lg font-bold">{formatBytes(usage.totalBytes)}</div>
      <div className="text-xs text-muted-foreground">{usage.fileCount} file</div>
      {usage.orphanCount > 0 && (
        <Badge variant="outline" className="mt-2 border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
          {usage.orphanCount} yatim ({formatBytes(usage.orphanBytes)})
        </Badge>
      )}
    </div>
  );
}
