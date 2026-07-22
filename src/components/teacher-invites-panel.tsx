import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, Loader2, MailPlus, ShieldOff, CheckCircle2, Clock, XCircle, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createTeacherInvite, listTeacherInvites, revokeTeacherInvite,
  type TeacherInviteRow,
} from "@/lib/invites.functions";

function inviteUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/undangan?code=${encodeURIComponent(code)}`;
}

function statusOf(inv: TeacherInviteRow): { label: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (inv.revoked_at) return { label: "Dicabut", tone: "bad" };
  if (inv.used_at) return { label: "Sudah dipakai", tone: "muted" };
  if (new Date(inv.expires_at).getTime() < Date.now()) return { label: "Kedaluwarsa", tone: "warn" };
  return { label: "Aktif", tone: "ok" };
}

export function TeacherInvitesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeacherInvites);
  const createFn = useServerFn(createTeacherInvite);
  const revokeFn = useServerFn(revokeTeacherInvite);

  const [note, setNote] = useState("");
  const [days, setDays] = useState(30);

  const invitesQ = useQuery({ queryKey: ["teacher-invites"], queryFn: () => listFn() });
  const createMut = useMutation({
    mutationFn: (vars: { note?: string; expiresInDays?: number }) => createFn({ data: vars }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["teacher-invites"] });
      setNote("");
      const url = inviteUrl(row.code);
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Undangan dibuat & tautan disalin");
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal membuat undangan"),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-invites"] });
      toast.success("Undangan dicabut");
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal mencabut"),
  });

  const rows = invitesQ.data ?? [];
  const active = useMemo(() => rows.filter((r) => statusOf(r).tone === "ok").length, [rows]);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${label} disalin`)).catch(() => {});
  };

  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
          <MailPlus className="size-6 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">Undangan Guru (Kode Sekali Pakai)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat kode undangan, kirim tautannya ke calon guru. Mereka cukup daftar/masuk,
            akun otomatis aktif sebagai guru — tanpa perlu tahu istilah teknis atau kode akses global.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">Aktif: {active}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <div>
          <Label className="mb-1.5 block text-xs">Catatan (opsional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="mis. Bu Aisyah — Matematika" className="h-10 rounded-xl border-2" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Berlaku (hari)</Label>
          <Input type="number" min={1} max={365} value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)} className="h-10 rounded-xl border-2" />
        </div>
        <div className="flex items-end">
          <Button className="h-10 w-full sm:w-auto"
            onClick={() => createMut.mutate({ note, expiresInDays: days })}
            disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
            Buat undangan
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {invitesQ.isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat undangan…
          </div>
        )}
        {!invitesQ.isLoading && rows.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
            Belum ada undangan. Buat undangan pertama Anda di atas.
          </div>
        )}
        {rows.map((inv) => {
          const s = statusOf(inv);
          const url = inviteUrl(inv.code);
          const canRevoke = !inv.used_at && !inv.revoked_at;
          return (
            <div key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-background p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-muted px-2 py-0.5 font-mono text-sm font-semibold">{inv.code}</code>
                  <Badge
                    variant={s.tone === "ok" ? "default" : "outline"}
                    className={
                      s.tone === "ok" ? "bg-primary text-primary-foreground"
                      : s.tone === "bad" ? "border-destructive/40 text-destructive"
                      : s.tone === "warn" ? "border-yellow-500/40 text-yellow-700 dark:text-yellow-400"
                      : ""
                    }>
                    {s.tone === "ok" && <CheckCircle2 className="mr-1 size-3" />}
                    {s.tone === "warn" && <Clock className="mr-1 size-3" />}
                    {s.tone === "bad" && <XCircle className="mr-1 size-3" />}
                    {s.label}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {inv.note ? `${inv.note} · ` : ""}
                  Kedaluwarsa {new Date(inv.expires_at).toLocaleDateString("id-ID")}
                  {inv.used_by_email ? ` · dipakai oleh ${inv.used_by_email}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(inv.code, "Kode")}>
                  <Copy className="size-4" /> Kode
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy(url, "Tautan undangan")}>
                  <Link2 className="size-4" /> Tautan
                </Button>
                {canRevoke && (
                  <Button size="sm" variant="destructive" disabled={revokeMut.isPending}
                    onClick={() => revokeMut.mutate(inv.id)}>
                    <ShieldOff className="size-4" /> Cabut
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Tips: bagikan tautan lewat WhatsApp/email. Kode hanya bisa dipakai satu kali dan bisa Anda cabut sebelum digunakan.
      </p>
    </section>
  );
}
