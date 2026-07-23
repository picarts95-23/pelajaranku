import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2, KeyRound, Wand2, Copy, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  getAppSettings, updateTeacherSignupSettings, createTeacherAccount,
  type TeacherSignupMode,
} from "@/lib/app-settings.functions";

const MODE_LABEL: Record<TeacherSignupMode, string> = {
  auto: "Otomatis (kode akses)",
  invite: "Undangan saja",
  closed: "Tertutup (admin manual)",
};

const MODE_HINT: Record<TeacherSignupMode, string> = {
  auto: "Siapa pun yang tahu kode akses guru bisa mendaftar sendiri sebagai guru.",
  invite: "Guru hanya bisa aktif lewat tautan undangan sekali pakai dari admin.",
  closed: "Pendaftaran mandiri ditutup. Admin membuat akun guru satu per satu.",
};

export function TeacherSignupSettings() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateTeacherSignupSettings);
  const createFn = useServerFn(createTeacherAccount);

  const settingsQ = useQuery({ queryKey: ["app-settings"], queryFn: () => getFn() });

  const [mode, setMode] = useState<TeacherSignupMode>("invite");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (settingsQ.data) {
      setMode(settingsQ.data.teacher_signup_mode);
      setCode(settingsQ.data.teacher_access_code ?? "");
    }
  }, [settingsQ.data]);

  const updateMut = useMutation({
    mutationFn: (vars: { mode?: TeacherSignupMode; code?: string | null }) => updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Pengaturan tersimpan");
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal menyimpan"),
  });

  const genCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[arr[i] % chars.length];
    setCode(out);
    setShowCode(true);
  };

  // Manual create teacher form
  const [openCreate, setOpenCreate] = useState(false);
  const [tEmail, setTEmail] = useState("");
  const [tPass, setTPass] = useState("");
  const [tName, setTName] = useState("");
  const [tSubject, setTSubject] = useState("");
  const [tSchool, setTSchool] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {
      email: tEmail, password: tPass, fullName: tName,
      subject: tSubject || undefined, schoolIdNumber: tSchool || undefined,
    } }),
    onSuccess: () => {
      toast.success(`Akun guru untuk ${tEmail} berhasil dibuat`);
      setOpenCreate(false);
      setTEmail(""); setTPass(""); setTName(""); setTSubject(""); setTSchool("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal membuat akun"),
  });

  const genPass = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[arr[i] % chars.length];
    setTPass(out);
  };

  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5 shadow-card-rpg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-magic shadow-magic">
          <Settings className="size-6 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">Pengaturan Pendaftaran Guru</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih bagaimana guru bisa aktif di sekolah Anda. Bisa otomatis dengan kode akses,
            hanya lewat undangan, atau dibuatkan manual oleh admin.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="size-4" /> Buat Akun Guru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat akun guru manual</DialogTitle>
              <DialogDescription>
                Admin membuatkan akun guru langsung — cocok saat mode pendaftaran ditutup.
                Email otomatis diverifikasi, guru bisa langsung login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-sm">Nama lengkap</Label>
                <Input value={tName} onChange={(e) => setTName(e.target.value)} className="h-10 rounded-xl border-2" />
              </div>
              <div>
                <Label className="mb-1 block text-sm">Email</Label>
                <Input type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} className="h-10 rounded-xl border-2" />
              </div>
              <div>
                <Label className="mb-1 block text-sm">Password awal</Label>
                <div className="flex gap-2">
                  <Input value={tPass} onChange={(e) => setTPass(e.target.value)} placeholder="Min. 6 karakter" className="h-10 rounded-xl border-2" />
                  <Button type="button" variant="outline" size="sm" onClick={genPass}><Wand2 className="size-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-sm">Mata pelajaran</Label>
                  <Input value={tSubject} onChange={(e) => setTSubject(e.target.value)} placeholder="Opsional" className="h-10 rounded-xl border-2" />
                </div>
                <div>
                  <Label className="mb-1 block text-sm">NIP</Label>
                  <Input value={tSchool} onChange={(e) => setTSchool(e.target.value)} placeholder="Opsional" className="h-10 rounded-xl border-2" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenCreate(false)}>Batal</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Buat akun
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {settingsQ.isLoading ? (
        <div className="mt-5 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat pengaturan…
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <Label className="mb-2 block text-sm">Mode pendaftaran</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["auto", "invite", "closed"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    mode === m ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-background hover:border-foreground/30"
                  }`}>
                  <div className="text-sm font-display font-bold">{MODE_LABEL[m]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{MODE_HINT[m]}</div>
                </button>
              ))}
            </div>
          </div>

          {mode === "auto" && (
            <div>
              <Label className="mb-1 block text-sm">Kode akses guru</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="mis. GURU2026"
                    className="h-10 rounded-xl border-2 pl-9 pr-11 font-mono"
                  />
                  <button type="button" onClick={() => setShowCode((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={genCode}>
                  <Wand2 className="size-4" /> Acak
                </Button>
                {code && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => { navigator.clipboard?.writeText(code); toast.success("Kode disalin"); }}>
                    <Copy className="size-4" />
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Bagikan kode ini hanya ke calon guru terpercaya. Ganti kapan saja jika bocor.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Aktif sekarang: {MODE_LABEL[(settingsQ.data?.teacher_signup_mode ?? "invite") as TeacherSignupMode]}
            </Badge>
            <div className="ml-auto flex gap-2">
              <Button variant="outline"
                onClick={() => {
                  if (settingsQ.data) {
                    setMode(settingsQ.data.teacher_signup_mode);
                    setCode(settingsQ.data.teacher_access_code ?? "");
                  }
                }}>
                Batal
              </Button>
              <Button
                onClick={() => updateMut.mutate({ mode, code: mode === "auto" ? code : null })}
                disabled={updateMut.isPending || (mode === "auto" && code.trim().length < 4)}>
                {updateMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Simpan pengaturan
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
