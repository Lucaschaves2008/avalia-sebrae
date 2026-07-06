import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profs, error } = await admin.from("profiles").select("id,email").like("email", "teste-%@sebrae.com.br");
if (error) throw error;
console.log("found", profs.length);

for (const p of profs) {
  const uf = p.email.replace("teste-", "").split("@")[0];
  const newEmail = `${uf}@sebrae.com.br`;
  const newName = `GESTOR ${uf.toUpperCase()}`;

  const { error: aErr } = await admin.auth.admin.updateUserById(p.id, {
    email: newEmail,
    password: "Sebrae@2026",
    email_confirm: true,
    user_metadata: { name: newName },
  });
  if (aErr) { console.error(p.email, aErr.message); continue; }

  const { error: pErr } = await admin.from("profiles").update({ email: newEmail, name: newName }).eq("id", p.id);
  if (pErr) { console.error("profile", p.email, pErr.message); continue; }

  console.log("ok", p.email, "->", newEmail);
}
