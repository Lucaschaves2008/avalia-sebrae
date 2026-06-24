import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreateUserPayload = {
  name: string;
  email: string;
  phone: string;
  unit: string;
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
  state: string | null;
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
    let { data: created, error: createErr } =
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

    // Recover from orphan auth user (exists in auth.users but no profile row)
    if (createErr && /already been registered|email_exists/i.test(createErr.message)) {
      const email = data.email.trim().toLowerCase();
      let orphanId: string | null = null;
      for (let page = 1; page <= 10 && !orphanId; page++) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        const match = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (match) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", match.id)
            .maybeSingle();
          if (!prof) orphanId = match.id;
          else throw new Error("E-mail já está em uso por outro usuário.");
          break;
        }
        if (!list || list.users.length < 200) break;
      }
      if (orphanId) {
        await supabaseAdmin.auth.admin.deleteUser(orphanId);
        const retry = await supabaseAdmin.auth.admin.createUser({
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
        created = retry.data;
        createErr = retry.error;
      }
    }

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
