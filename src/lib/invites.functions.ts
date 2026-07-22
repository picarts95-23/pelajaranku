import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Hanya admin yang dapat melakukan tindakan ini.");
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[arr[i] % chars.length];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

export interface TeacherInviteRow {
  id: string;
  code: string;
  note: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  used_by_email?: string | null;
}

export const createTeacherInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note?: string; expiresInDays?: number }) => ({
    note: (input?.note ?? "").toString().slice(0, 120),
    expiresInDays: Math.min(Math.max(Number(input?.expiresInDays) || 30, 1), 365),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = generateCode();
    const expires = new Date(Date.now() + data.expiresInDays * 86400_000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("teacher_invites")
      .insert({
        code,
        note: data.note || null,
        created_by: context.userId,
        expires_at: expires,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as TeacherInviteRow;
  });

export const listTeacherInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeacherInviteRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("teacher_invites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = Array.from(new Set((rows ?? []).map((r) => r.used_by).filter(Boolean))) as string[];
    const emailById = new Map<string, string>();
    if (ids.length) {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of authList?.users ?? []) if (u.email) emailById.set(u.id, u.email);
    }
    return (rows ?? []).map((r) => ({
      ...(r as TeacherInviteRow),
      used_by_email: r.used_by ? emailById.get(r.used_by) ?? null : null,
    }));
  });

export const revokeTeacherInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Undangan tidak valid.");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teacher_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("used_at", null);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Called by the signed-in invitee on /undangan?code=XXX. Validates the invite
 * server-side, marks it used, and grants the teacher role in one step.
 * Invitees never see the word "role" — the activation page just confirms
 * "Selamat, akun guru Anda sudah aktif".
 */
export const redeemTeacherInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = (input?.code ?? "").toString().trim().toUpperCase();
    if (!code) throw new Error("Kode undangan wajib diisi.");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error: findErr } = await supabaseAdmin
      .from("teacher_invites")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!invite) throw new Error("Kode undangan tidak ditemukan.");
    if (invite.revoked_at) throw new Error("Undangan ini telah dicabut oleh admin.");
    if (invite.used_at) throw new Error("Undangan ini sudah pernah digunakan.");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("Undangan ini sudah kedaluwarsa. Minta undangan baru ke admin.");
    }

    // Promote to teacher and mark invite consumed. Order matters: mark first
    // so a concurrent redeem loses on the (id, used_at IS NULL) update.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("teacher_invites")
      .update({ used_by: context.userId, used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) throw new Error("Undangan ini sudah pernah digunakan.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "guru" });
    if (roleErr) throw roleErr;

    return { ok: true };
  });
