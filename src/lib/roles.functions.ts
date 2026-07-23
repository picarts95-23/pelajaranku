import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Securely elevate the signed-in user to the teacher ("guru") role.
 * Roles are NEVER assigned from client signup metadata; new accounts are always
 * students. The admin controls how teachers can self-register via app_settings:
 *   - "auto"    : anyone with the correct teacher access code becomes a teacher
 *   - "invite"  : self-signup with code is blocked; must redeem an invite
 *   - "closed"  : self-signup blocked entirely; admin creates teacher accounts
 *
 * The teacher access code stored in app_settings.teacher_access_code takes
 * precedence over the legacy TEACHER_ACCESS_CODE secret (kept as fallback).
 */
export const claimTeacherRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input || typeof input.code !== "string") throw new Error("Kode tidak valid.");
    return { code: input.code.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("teacher_signup_mode, teacher_access_code")
      .eq("id", "singleton")
      .maybeSingle();

    const mode = (settings?.teacher_signup_mode as "auto" | "invite" | "closed" | undefined) ?? "invite";
    if (mode === "closed") {
      throw new Error("Pendaftaran guru sedang ditutup. Hubungi admin untuk dibuatkan akun.");
    }
    if (mode === "invite") {
      throw new Error("Pendaftaran guru hanya melalui tautan undangan dari admin.");
    }

    const expected = (settings?.teacher_access_code as string | null) ?? process.env.TEACHER_ACCESS_CODE;
    if (!expected) {
      throw new Error("Kode akses guru belum diatur. Hubungi admin.");
    }
    if (!data.code || data.code !== expected) {
      throw new Error("Kode akses guru salah.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "guru" });
    if (error) throw error;
    return { ok: true };
  });

/**
 * Public helper: signup page calls this (no auth needed) to know whether to
 * show the "Kode Akses Guru" field or nudge the user toward the invite flow.
 */
export const getTeacherSignupMode = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("teacher_signup_mode")
    .eq("id", "singleton")
    .maybeSingle();
  return {
    mode: ((data?.teacher_signup_mode as "auto" | "invite" | "closed" | undefined) ?? "invite"),
  };
});
