import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SebraeLogo } from "@/components/SebraeLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Portfólio de Cursos SEBRAE" },
      {
        name: "description",
        content: "Defina uma nova senha para acessar o Portfólio de Cursos SEBRAE.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function getCriteria(password: string) {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function CriteriaItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? "text-emerald-600" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
      <span>{label}</span>
    </div>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criteria = useMemo(() => getCriteria(newPassword), [newPassword]);
  const allCriteriaMet = Object.values(criteria).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Supabase parses the recovery hash automatically and emits PASSWORD_RECOVERY.
  // We also fall back to checking for an existing session.
  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setReady(true);
      } else {
        // Give Supabase a moment to consume the hash
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (cancelled) return;
            if (d2.session) setReady(true);
            else setInvalidLink(true);
          });
        }, 800);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!allCriteriaMet) {
      setError("A senha não atende a todos os critérios de segurança.");
      return;
    }
    if (!passwordsMatch) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      toast.error("Não foi possível atualizar a senha. Solicite um novo link.");
      return;
    }

    toast.success("Senha atualizada com sucesso! Faça login novamente.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-12 lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <SebraeLogo className="relative" />
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Redefinição segura de <span className="text-secondary">senha</span>
          </h1>
          <p className="max-w-md text-base text-white/80">
            Defina uma nova senha que atenda aos critérios de segurança SEBRAE
            para retornar ao Portfólio de Cursos.
          </p>
        </div>
        <div className="relative text-xs text-white/60">
          © {new Date().getFullYear()} SEBRAE — Todos os direitos reservados.
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Definir nova senha
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma senha forte para proteger sua conta.
            </p>
          </div>

          {invalidLink ? (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                Link inválido ou expirado. Solicite uma nova recuperação de senha.
              </div>
              <Button
                onClick={() => navigate({ to: "/login" })}
                className="h-11 w-full bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
              >
                Voltar ao login
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando link de recuperação...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <div className="mb-1 text-xs font-semibold text-foreground">
                  Critérios de segurança
                </div>
                <CriteriaItem met={criteria.minLength} label="Mínimo de 8 caracteres" />
                <CriteriaItem met={criteria.hasUpper} label="Pelo menos 1 letra maiúscula" />
                <CriteriaItem met={criteria.hasLower} label="Pelo menos 1 letra minúscula" />
                <CriteriaItem met={criteria.hasNumber} label="Pelo menos 1 número" />
                <CriteriaItem met={passwordsMatch} label="Senhas coincidem" />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !allCriteriaMet || !passwordsMatch}
                aria-busy={loading}
                className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-[var(--primary-hover)]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>

              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Após salvar, você será redirecionado para o login.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
