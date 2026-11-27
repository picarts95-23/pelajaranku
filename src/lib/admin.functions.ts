import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin is determined by a single fixed email stored in the ADMIN_EMAIL secret.
 * No admin role is ever assigned from client input. When the account whose email
 * matches ADMIN_EMAIL signs in, this function promotes it to the admin role.
 */
export const syncMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const myEmail = ((context.claims as Record<string, unknown>)?.email as string | undefined)
      ?.trim()
      .toLowerCase();
    // Only a confirmed email may claim the admin address.
    const { data: userData } = await context.supabase.auth.getUser();
    const confirmed = !!userData?.user?.email_confirmed_at;
    if (!adminEmail || !myEmail || adminEmail !== myEmail || !confirmed) {
      return { role: null as "admin" | null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "admin" });
      if (error) throw error;
    }
    return { role: "admin" as const };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Hanya admin yang dapat melakukan tindakan ini.");
}

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "guru" | "siswa" | "admin" | null;
  class_name: string | null;
  subject: string | null;
  avatar_url: string | null;
  archived_at: string | null;
  created_at: string;
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailById = new Map<string, string | null>();
    const roleById = new Map<string, AdminUserRow["role"]>();
    const profiles: Record<string, any>[] = [];
    const pageSize = 500;
    for (let page = 1; ; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: pageSize });
      if (error) throw error;
      const batch = data.users;
      for (const account of batch) emailById.set(account.id, account.email ?? null);
      if (batch.length < pageSize) break;
    }
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseAdmin.from("profiles")
        .select("id, full_name, class_name, subject, avatar_url, archived_at, created_at")
        .order("id").range(offset, offset + pageSize - 1);
      if (error) throw error;
      profiles.push(...(data ?? []));
      if ((data ?? []).length < pageSize) break;
    }
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, role")
        .order("id").range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        const previous = roleById.get(row.user_id);
        if (previous !== "admin" && (previous !== "guru" || row.role === "admin")) roleById.set(row.user_id, row.role);
      }
      if ((data ?? []).length < pageSize) break;
    }
    return profiles
      .map((p: Record<string, any>) => ({
        id: p.id as string,
        full_name: (p.full_name as string) ?? null,
        email: emailById.get(p.id) ?? null,
        role: (roleById.get(p.id) as AdminUserRow["role"]) ?? null,
        class_name: (p.class_name as string) ?? null,
        subject: (p.subject as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        archived_at: (p.archived_at as string) ?? null,
        created_at: p.created_at as string,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });

export const setUserArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; archived: boolean }) => {
    if (!input?.userId) throw new Error("User tidak valid.");
    return { userId: input.userId, archived: !!input.archived };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Anda tidak dapat mengarsipkan akun sendiri.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetRoles, error: roleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (roleError) throw roleError;
    if (targetRoles?.some((row) => row.role === "admin")) throw new Error("Akun admin tidak dapat diarsipkan.");
    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.userId).select("id").maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Pengguna tidak ditemukan.");
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("User tidak valid.");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Anda tidak dapat menghapus akun sendiri.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetRoles, error: roleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (roleError) throw roleError;
    if (targetRoles?.some((row) => row.role === "admin")) throw new Error("Akun admin tidak dapat dihapus.");
    // Hard delete: remove the auth user first, then clean up app-side rows that
    // are not linked to auth.users by a cascading foreign key.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    // profiles -> cascades to profile_private and assignments.assigned_student_id.
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    return { ok: true };
  });

/**
 * Admin can reset/replace a user's password. The original password can never be
 * read (it is stored only as a one-way hash); admin can only set a new value.
 */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input?.userId) throw new Error("User tidak valid.");
    const password = (input.password ?? "").trim();
    if (password.length < 6) throw new Error("Password minimal 6 karakter.");
    if (password.length > 72) throw new Error("Password maksimal 72 karakter.");
    return { userId: input.userId, password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });
