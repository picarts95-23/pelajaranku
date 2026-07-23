import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pengaturan aplikasi tingkat instansi (satu baris). Berisi mode pendaftaran
 * guru dan kode akses cadangan. Hanya admin yang dapat membaca/mengubah.
 */

export type TeacherSignupMode = "auto" | "invite" | "closed";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Hanya admin yang dapat melakukan tindakan ini.");
}

export interface AppSettings {
  teacher_signup_mode: TeacherSignupMode;
  teacher_access_code: string | null;
  updated_at: string;
}

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppSettings> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("teacher_signup_mode, teacher_access_code, updated_at")
      .eq("id", "singleton")
      .maybeSingle();
    if (error) throw error;
    return (
      (data as AppSettings | null) ?? {
        teacher_signup_mode: "invite",
        teacher_access_code: null,
        updated_at: new Date().toISOString(),
      }
    );
  });

export const updateTeacherSignupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode?: TeacherSignupMode; code?: string | null }) => {
    const mode = input?.mode;
    if (mode && !["auto", "invite", "closed"].includes(mode)) {
      throw new Error("Mode tidak valid.");
    }
    let code: string | null | undefined = input?.code;
    if (code !== undefined && code !== null) {
      code = String(code).trim();
      if (code.length > 0 && code.length < 4) throw new Error("Kode minimal 4 karakter.");
      if (code.length > 64) throw new Error("Kode maksimal 64 karakter.");
      if (code.length === 0) code = null;
    }
    return { mode, code };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (data.mode) patch.teacher_signup_mode = data.mode;
    if (data.code !== undefined) patch.teacher_access_code = data.code;
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update(patch)
      .eq("id", "singleton");
    if (error) throw error;
    return { ok: true };
  });

/**
 * Admin membuat akun guru secara manual (email + password + nama). Akun langsung
 * terverifikasi dan diberi peran guru — cocok saat mode pendaftaran ditutup.
 */
export const createTeacherAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    email: string;
    password: string;
    fullName: string;
    subject?: string;
    schoolIdNumber?: string;
  }) => {
    const email = (input?.email ?? "").trim().toLowerCase();
    const password = (input?.password ?? "").trim();
    const fullName = (input?.fullName ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email tidak valid.");
    if (password.length < 6) throw new Error("Password minimal 6 karakter.");
    if (password.length > 72) throw new Error("Password maksimal 72 karakter.");
    if (!fullName) throw new Error("Nama lengkap wajib diisi.");
    return {
      email,
      password,
      fullName,
      subject: (input?.subject ?? "").trim() || null,
      schoolIdNumber: (input?.schoolIdNumber ?? "").trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create the auth user (email pre-confirmed).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        subject: data.subject,
        school_id_number: data.schoolIdNumber,
      },
    });
    if (createErr) throw createErr;
    const uid = created.user?.id;
    if (!uid) throw new Error("Gagal membuat akun.");

    // 2. Ensure profile row exists (handle_new_user trigger inserts a default;
    //    patch subject/name for safety).
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, subject: data.subject })
      .eq("id", uid);

    // 3. Promote to teacher role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "guru" });
    if (roleErr) throw roleErr;

    return { ok: true, userId: uid };
  });
