import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { SISWA_CHARACTERS, GURU_CHARACTERS, getCharacterByKey } from "@/lib/character-roster";
import { getIslamicAvatar } from "@/lib/islamic-avatar";

export const Route = createFileRoute("/_authenticated/siswa/profil_/edit")({
  head: () => ({ meta: [{ title: "Atur Profil & Karakter · EduQuest" }] }),
  component: EditProfil,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Minimal 2 karakter").max(80),
  username: z.string().trim().min(3, "Minimal 3 karakter").max(24).regex(/^[a-zA-Z0-9_.]+$/, "Hanya huruf, angka, titik, underscore").optional().or(z.literal("")),
  class_name: z.string().trim().max(40).optional().or(z.literal("")),
  school_id_number: z.string().trim().max(30).optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
  hobby: z.string().trim().max(120).optional().or(z.literal("")),
  motto: z.string().trim().max(140).optional().or(z.literal("")),
  bio: z.string().trim().max(400).optional().or(z.literal("")),
  character_key: z.string().optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

function EditProfil() {
  const { user, profile, role, refresh } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roster = role === "guru" ? GURU_CHARACTERS : SISWA_CHARACTERS;

  const [form, setForm] = useState<FormState>({
    full_name: "", username: "", class_name: "", school_id_number: "",
    gender: "", birthdate: "", hobby: "", motto: "", bio: "", character_key: "",
  });

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setForm({
      full_name: p.full_name ?? "",
      username: p.username ?? "",
      class_name: p.class_name ?? "",
      school_id_number: p.school_id_number ?? "",
      gender: p.gender ?? "",
      birthdate: p.birthdate ?? "",
      hobby: p.hobby ?? "",
      motto: p.motto ?? "",
      bio: p.bio ?? "",
      character_key: p.character_key ?? "",
    });
  }, [profile]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const selectedChar = getCharacterByKey(form.character_key) ?? null;
  const previewSrc = selectedChar?.src ?? getIslamicAvatar(user?.id ?? form.full_name, role === "guru" ? "guru" : "siswa");

  const saveMut = useMutation({
    mutationFn: async (values: FormState) => {
      if (!user) throw new Error("No user");
      const parsed = schema.parse(values);
      const chosen = getCharacterByKey(parsed.character_key || null);
      // The profile row already exists (created by the signup trigger). Use
      // UPDATE rather than upsert: authenticated users only hold column-level
      // UPDATE grants (excluding id/xp/coins/level), and an upsert would try to
      // write the `id` column on conflict, which fails with permission denied.
      const payload: Record<string, unknown> = {
        full_name: parsed.full_name,
        username: parsed.username || null,
        class_name: parsed.class_name || null,
        motto: parsed.motto || null,
        bio: parsed.bio || null,
        character_key: parsed.character_key || null,
        avatar_url: chosen?.src ?? (profile?.avatar_url ?? null),
      };
      const { error } = await supabase.from("profiles").update(payload as any).eq("id", user.id);
      if (error) throw error;
      const { error: privError } = await supabase.from("profile_private").upsert({
        id: user.id,
        school_id_number: parsed.school_id_number || null,
        gender: parsed.gender || null,
        birthdate: parsed.birthdate || null,
        hobby: parsed.hobby || null,
      } as any, { onConflict: "id" });
      if (privError) throw privError;
    },
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ["siswa-profil-stats"] });
      toast.success(lang === "id" ? "Profil tersimpan" : "Profile saved");
      navigate({ to: "/siswa/profil" });
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("profiles_username_unique") ? "Nama akun sudah dipakai" : e?.message ?? "Gagal menyimpan";
      toast.error(msg);
    },
  });

  return (
    <DashboardShell accent="siswa">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/siswa/profil" })}>
          <ArrowLeft className="mr-1 size-4" /> {lang === "id" ? "Kembali" : "Back"}
        </Button>
        <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="bg-gradient-magic">
          {saveMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {lang === "id" ? "Simpan" : "Save"}
        </Button>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border-2 border-border bg-gradient-hero p-6 text-primary-foreground shadow-magic sm:p-8"
      >
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <img src={previewSrc} alt="Preview karakter" width={176} height={176}
               className="size-40 sm:size-44 rounded-3xl object-contain bg-white/20 ring-4 ring-white/40" />
          <div>
            <div className="text-sm font-display uppercase tracking-wider opacity-80">{lang === "id" ? "Pratinjau" : "Preview"}</div>
            <h1 className="mt-1 font-display text-3xl font-bold">{form.full_name || (lang === "id" ? "Nama lengkap" : "Full name")}</h1>
            {form.username && <div className="text-sm opacity-90">@{form.username}</div>}
            {selectedChar && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm">
                <Sparkles className="size-3.5" /> {selectedChar.name} · {selectedChar.archetype}
              </div>
            )}
            {form.motto && <p className="mt-3 max-w-md text-sm italic opacity-90">"{form.motto}"</p>}
          </div>
        </div>
      </motion.section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-4 font-display text-xl font-bold">{lang === "id" ? "Biodata" : "Biodata"}</h2>
          <div className="grid gap-4">
            <Field label={lang === "id" ? "Nama lengkap" : "Full name"} required>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={80} />
            </Field>
            <Field label={lang === "id" ? "Nama akun" : "Username"} hint={lang === "id" ? "Huruf, angka, titik, underscore" : "Letters, numbers, dot, underscore"}>
              <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="aisyah.az" maxLength={24} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={lang === "id" ? "Kelas" : "Class"}>
                <Input value={form.class_name} onChange={(e) => set("class_name", e.target.value)} placeholder="8A" maxLength={40} />
              </Field>
              <Field label="NIS / NIM">
                <Input value={form.school_id_number} onChange={(e) => set("school_id_number", e.target.value)} maxLength={30} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={lang === "id" ? "Jenis kelamin" : "Gender"}>
                <Select value={form.gender || undefined} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder={lang === "id" ? "Pilih" : "Select"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perempuan">{lang === "id" ? "Perempuan" : "Female"}</SelectItem>
                    <SelectItem value="laki-laki">{lang === "id" ? "Laki-laki" : "Male"}</SelectItem>
                    <SelectItem value="lainnya">{lang === "id" ? "Lainnya" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={lang === "id" ? "Tanggal lahir" : "Birthdate"}>
                <Input type="date" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
              </Field>
            </div>
            <Field label={lang === "id" ? "Hobi" : "Hobby"}>
              <Input value={form.hobby} onChange={(e) => set("hobby", e.target.value)} placeholder={lang === "id" ? "Membaca, kaligrafi…" : "Reading, calligraphy…"} maxLength={120} />
            </Field>
            <Field label="Motto">
              <Input value={form.motto} onChange={(e) => set("motto", e.target.value)} maxLength={140} />
            </Field>
            <Field label={lang === "id" ? "Tentang saya" : "About me"}>
              <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={400} />
              <div className="mt-1 text-right text-xs text-muted-foreground">{(form.bio ?? "").length}/400</div>
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border-2 border-border bg-card p-6 shadow-card-rpg">
          <h2 className="mb-1 font-display text-xl font-bold">{lang === "id" ? "Pilih Karakter RPG" : "Choose RPG Character"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{lang === "id" ? "Karakter akan menjadi avatar profil dan kartu sosialmu." : "Your character becomes your profile avatar."}</p>
          <div className="grid max-h-[640px] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
            {roster.map((c) => {
              const active = form.character_key === c.key;
              return (
                <button key={c.key} type="button" onClick={() => set("character_key", c.key)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border-2 bg-muted/30 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-card-rpg",
                    active ? "border-primary ring-2 ring-primary" : "border-border",
                  )}
                >
                  <img src={c.src} alt={c.name} className="mx-auto h-24 w-24 object-contain" loading="lazy" />
                  <div className="mt-1 truncate text-center text-xs font-display font-semibold">{c.name}</div>
                  <div className="truncate text-center text-[10px] text-muted-foreground">{c.archetype}</div>
                  {active && (
                    <div className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} size="lg" className="bg-gradient-magic">
          {saveMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {lang === "id" ? "Simpan Profil" : "Save Profile"}
        </Button>
      </div>
    </DashboardShell>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-display">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
