import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only. Returns the full concatenated Supabase migration SQL so a buyer
 * can install the schema on their own Supabase project (Bring-Your-Own-Supabase).
 */
export const exportSchemaDump = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw error;
    if (!isAdmin) throw new Error("Hanya admin yang dapat mengunduh skema.");
    const { buildSchemaDump } = await import("./schema-dump.server");
    return { sql: buildSchemaDump(), generatedAt: new Date().toISOString() };
  });
