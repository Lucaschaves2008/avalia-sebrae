import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreateUserPayload = {
  name: string;
  email: string;
  phone: string;
  unit: string;
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
  role: "admin" | "gestor";
  password: string;
};

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateUserPayload) => input)
  .handler(async ({ data, context }) => {
    // Caller must be admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem criar usuários.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Create the auth user (email auto-confirmed -> row exists in auth.users immediately)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email.trim(),
        password: data.password,
        email_confirm: true,
        user_metadata: {
          name: data.name,
          phone: data.phone,
          unity: data.unit,
          region: data.region,
        },
      });
    if (createErr) throw new Error(createErr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário.");

    // Trigger handle_new_user already created profile + default role. Promote if needed.
    if (data.role === "admin") {
      const { error: upErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: newUserId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      if (upErr) throw new Error(upErr.message);
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId)
        .neq("role", "admin");
    }

    // Mark first access true
    await supabaseAdmin
      .from("profiles")
      .update({ is_first_access: true })
      .eq("id", newUserId);

    return { ok: true as const, userId: newUserId };
  });
