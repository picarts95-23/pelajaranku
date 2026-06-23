import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Securely elevate the signed-in user to the teacher ("guru") role.
 * Roles are NEVER assigned from client signup metadata; new accounts are always
 * students. Teachers must provide the shared teacher access code, which is
 * validated server-side against the TEACHER_ACCESS_CODE secret.
 */
export const claimTeacherRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input || typeof input.code !== "string") throw new Error("Kode tidak valid.");
    return { code: input.code.trim() };
  })
  .handler(async ({ data, context }) => {
    const expected = process.env.TEACHER_ACCESS_CODE;
    if (!expected) {
      throw new Error("Pendaftaran guru belum dikonfigurasi. Hubungi admin.");
    }
    if (!data.code || data.code !== expected) {
      throw new Error("Kode akses guru salah.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "guru" });
    if (error) throw error;
    return { ok: true };
  });
