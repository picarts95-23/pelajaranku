import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShieldCheck, Search, Trash2, Archive, ArchiveRestore, Loader2, LogOut, Users,
  KeyRound, Eye, EyeOff, Wand2, Copy, Download, Database,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { LangToggle } from "@/components/lang-toggle";
import {
  listAllUsers, setUserArchived, deleteUserAccount, setUserPassword, type AdminUserRow,
} from "@/lib/admin.functions";
import { exportSchemaDump } from "@/lib/self-hosting.functions";
import { buildSetupPackageZip, triggerDownload } from "@/lib/setup-package";
import { Package, Trash } from "lucide-react";
import { AdminOnboarding } from "@/components/admin-onboarding";
import { TeacherInvitesPanel } from "@/components/teacher-invites-panel";
import { StoragePanel } from "@/components/storage-panel";
import { TeacherSignupSettings } from "@/components/teacher-signup-settings";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin · Pelajaranku" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const roleLabel: Record<string, string> = { admin: "Admin", guru: "Guru", siswa: "Siswi" };

function AdminPage() {
  const { role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "guru" | "siswa" | "archived">("all");
  const [pendingDelete, setPendingDelete] = useState<AdminUserRow | null>(null);
  const [pwUser, setPwUser] = useState<AdminUserRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(true);

  const listFn = useServerFn(listAllUsers);
  const archiveFn = useServerFn(setUserArchived);
  const deleteFn = useServerFn(deleteUserAccount);
  const passwordFn = useServerFn(setUserPassword);
  const exportSchemaFn = useServerFn(exportSchemaDump);
  const [exporting, setExporting] = useState(false);
  const [packing, setPacking] = useState(false);

  const downloadSchema = async () => {
    try {
      setExporting(true);
      const { sql } = await exportSchemaFn();
      const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `pelajaranku-supabase-schema-${stamp}.sql`);
      toast.success("Skema berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengunduh skema");
    } finally {
      setExporting(false);
    }
  };

  const downloadSetupPackage = async () => {
    try {
      setPacking(true);
      toast.info("Menyiapkan paket setup lengkap…");
      const { sql, generatedAt } = await exportSchemaFn();
      const blob = await buildSetupPackageZip({ sql, generatedAt });
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `pelajaranku-paket-setup-${stamp}.zip`);
      toast.success("Paket setup siap! Bagikan ke pembeli.");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat paket");
    } finally {
      setPacking(false);
    }
  };

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
    enabled: role === "admin",
  });

  const archiveMut = useMutation({
    mutationFn: (vars: { userId: string; archived: boolean }) => archiveFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Status arsip diperbarui");
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal"),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Pengguna dihapus permanen");
      setPendingDelete(null);
    },
    onError: (e: any) => { toast.error(e?.message ?? "Gagal menghapus"); setPendingDelete(null); },
  });

  const passwordMut = useMutation({
    mutationFn: (vars: { userId: string; password: string }) => passwordFn({ data: vars }),
    onSuccess: () => {
      toast.success("Password berhasil diganti");
      setPwUser(null);
      setNewPw("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal mengganti password"),
  });

  const genPw = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 10; i++) out += chars[arr[i] % chars.length];
    setNewPw(out);
    setShowPw(true);
  };

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) => {
      if (tab === "archived" && !u.archived_at) return false;
      if (tab === "guru" && u.role !== "guru") return false;
      if (tab === "siswa" && u.role !== "siswa") return false;
      if (tab === "all" && u.archived_at) return false;
      if (!term) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.class_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [users, q, tab]);

  const counts = useMemo(() => ({
    all: users.filter((u) => !u.archived_at).length,
    guru: users.filter((u) => u.role === "guru").length,
    siswa: users.filter((u) => u.role === "siswa").length,
    archived: users.filter((u) => u.archived_at).length,
  }), [users]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background" role="status"><Loader2 className="size-6 animate-spin text-primary" aria-label="Memuat akun…" /></div>;
  }

  if (role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6 text-center">
        <div className="max-w-md rounded-3xl border-2 border-border bg-card p-8 shadow-magic">
          <ShieldCheck className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-bold">Akses ditolak</h1>
          <p className="mt-2 text-sm text-muted-foreground">Halaman ini hanya untuk admin.</p>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: "/loading" })}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
              <ShieldCheck className="size-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-tight">Panel Admin</div>
              <div className="text-xs text-muted-foreground">Kelola akun pengguna</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button variant="outline" size="sm" onClick={() => signOut().then(() => navigate({ to: "/auth" }))}>
              <LogOut className="size-4" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
              <Database className="size-6 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold leading-tight">Paket setup untuk pembeli</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong>Unduh Paket Setup Lengkap</strong> untuk mendapatkan satu file ZIP berisi:
                panduan pembeli, panduan self-hosting, file SQL skema, template <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>,
                langkah aktivasi lisensi, dan ringkasan 6 langkah. Pembeli tinggal ekstrak dan ikuti — tanpa perlu bertanya.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ingin file mentah SQL saja? Gunakan tombol <em>Unduh skema (.sql)</em>.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={downloadSchema} disabled={exporting || packing}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Skema (.sql)
              </Button>
              <Button onClick={downloadSetupPackage} disabled={packing || exporting}>
                {packing ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
                Paket Setup Lengkap (.zip)
              </Button>
            </div>
          </div>
        </motion.section>


        <TeacherSignupSettings />

        <TeacherInvitesPanel />

        <StoragePanel />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", `Aktif (${counts.all})`],
              ["guru", `Guru (${counts.guru})`],
              ["siswa", `Siswi (${counts.siswa})`],
              ["archived", `Arsip (${counts.archived})`],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`rounded-full px-4 py-1.5 text-sm font-display font-semibold transition ${
                  tab === key ? "bg-gradient-magic text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>
                {label}
              </button>
            ))}
            <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email / kelas"
                className="h-10 rounded-xl border-2 pl-9" />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {usersQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" /> Memuat pengguna…
              </div>
            )}
            {usersQuery.isError && (
              <div className="py-10 text-center text-sm text-destructive">Gagal memuat daftar pengguna.</div>
            )}
            {!usersQuery.isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Users className="size-8" /> Tidak ada pengguna.
              </div>
            )}
            {filtered.map((u) => (
              <div key={u.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-background p-3">
                <img src={u.avatar_url ?? "/favicon.ico"} alt="" width={40} height={40}
                  className="size-10 shrink-0 rounded-xl border border-border object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display font-semibold">{u.full_name ?? "(tanpa nama)"}</span>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="shrink-0">
                      {roleLabel[u.role ?? ""] ?? "—"}
                    </Badge>
                    {u.archived_at && <Badge variant="outline" className="shrink-0">Arsip</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.email ?? "—"}{u.class_name ? ` · ${u.class_name}` : ""}{u.subject ? ` · ${u.subject}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm"
                    onClick={() => { setPwUser(u); setNewPw(""); setShowPw(true); }}>
                    <KeyRound className="size-4" /> Password
                  </Button>
                  <Button variant="outline" size="sm"
                    disabled={archiveMut.isPending || u.role === "admin"}
                    onClick={() => archiveMut.mutate({ userId: u.id, archived: !u.archived_at })}>
                    {u.archived_at ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    {u.archived_at ? "Pulihkan" : "Arsipkan"}
                  </Button>
                  <Button variant="destructive" size="sm"
                    disabled={u.role === "admin"}
                    onClick={() => setPendingDelete(u)}>
                    <Trash2 className="size-4" /> Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Arsipkan untuk menyembunyikan pengguna tanpa menghapus data. Hapus permanen akan menghilangkan akun beserta seluruh datanya.
          Password lama tidak dapat dilihat (tersimpan terenkripsi) — admin hanya dapat menetapkan password baru.
        </p>
        <div className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-4 text-center text-sm">
          Ingin memindahkan data ke Supabase Anda sendiri? Ikuti{" "}
          <a href="/setup" className="font-display font-semibold text-primary underline-offset-2 hover:underline">
            Wizard Setup Supabase
          </a>{" "}— 4 langkah dengan uji koneksi otomatis.
        </div>
      </main>

      <AdminOnboarding email={user?.email} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <b>{pendingDelete?.full_name ?? pendingDelete?.email}</b> dan seluruh datanya (nilai, tugas, kelas, dll.) akan dihapus permanen dan tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (pendingDelete) deleteMut.mutate(pendingDelete.id); }}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setNewPw(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti password pengguna</DialogTitle>
            <DialogDescription>
              Tetapkan password baru untuk <b>{pwUser?.full_name ?? pwUser?.email}</b>.
              Password asli tidak bisa ditampilkan karena tersimpan terenkripsi — sampaikan password baru ini ke pengguna.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block">Password baru</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="h-11 rounded-xl border-2 pr-11"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Sembunyikan" : "Tampilkan"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={genPw}>
                <Wand2 className="size-4" /> Buatkan acak
              </Button>
              {newPw && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => { navigator.clipboard?.writeText(newPw); toast.success("Password disalin"); }}>
                  <Copy className="size-4" /> Salin
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPwUser(null); setNewPw(""); }}>Batal</Button>
            <Button
              disabled={passwordMut.isPending || newPw.trim().length < 6}
              onClick={() => pwUser && passwordMut.mutate({ userId: pwUser.id, password: newPw.trim() })}>
              {passwordMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Simpan password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
