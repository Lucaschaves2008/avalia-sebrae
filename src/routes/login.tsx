import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso — Portfólio de Cursos SEBRAE" },
      {
        name: "description",
        content:
          "Acesso ao sistema de gestão do Portfólio de Cursos de Educação Empreendedora do SEBRAE.",
      },
    ],
  }),
  component: () => (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  ),
});

function getPasswordCriteria(password: string) {
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

function LoginPage() {
  const { user, login, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [firstAccessOpen, setFirstAccessOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError(null);
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      setForgotError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }
    setForgotSent(true);
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  const criteria = useMemo(() => getPasswordCriteria(newPassword), [newPassword]);
  const allCriteriaMet = Object.values(criteria).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (user?.isFirstAccess) setFirstAccessOpen(true);
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      const msg = /invalid|credentials|password|email/i.test(result.error)
        ? "Credenciais inválidas. Verifique os dados e tente novamente."
        : result.error;
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(`Bem-vindo, ${result.user.name.split(" ")[0]}!`);
    if (result.user.isFirstAccess) {
      setFirstAccessOpen(true);
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwLoading) return;
    setPwError(null);

    if (!allCriteriaMet) {
      setPwError("A senha não atende a todos os critérios de segurança.");
      return;
    }
    if (!passwordsMatch) {
      setPwError("As senhas não coincidem.");
      return;
    }

    setPwLoading(true);
    const r = await changePassword(newPassword);
    setPwLoading(false);
    if (!r.ok) {
      setPwError(r.error);
      toast.error(r.error);
      return;
    }
    toast.success("Senha atualizada com sucesso! Redirecionando para a Dashboard da sua Regional…");
    setFirstAccessOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between p-12 lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <SebraeLogo className="relative" />
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            Portal de Gestão
          </div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Portfólio de Cursos de{" "}
            <span className="text-secondary">Educação Empreendedora</span>
          </h1>
          <p className="max-w-md text-base text-white/80">
            Gerencie cursos, turmas e indicadores regionais em um único ambiente,
            com a qualidade e a segurança SEBRAE.
          </p>
        </div>
        <div className="relative text-xs text-white/60">
          © {new Date().getFullYear()} SEBRAE — Todos os direitos reservados.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-secondary text-sm font-black text-primary">
                Se
              </div>
              <span className="text-sm font-bold text-primary-foreground">
                SEBRAE
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Acessar plataforma
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe suas credenciais corporativas para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.nome@sebrae.com.br"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 px-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-all hover:bg-[var(--primary-hover)]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>

            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Ambiente protegido. O acesso é monitorado pela Segurança da
              Informação SEBRAE.
            </div>
          </form>

          <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <div className="mb-2 font-semibold text-foreground">
              Primeiro acesso
            </div>
            <p>
              Não possui cadastro? Solicite ao administrador o cadastro da sua
              conta. O primeiro usuário a se cadastrar no sistema é
              automaticamente promovido a Administrador.
            </p>
          </div>
        </div>
      </div>

      {/* First access modal — mandatory password change (blocks navigation) */}
      <Dialog
        open={firstAccessOpen}
        onOpenChange={(open) => {
          if (open) setFirstAccessOpen(true);
        }}
      >
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Primeiro acesso detectado</DialogTitle>
            <DialogDescription>
              Por segurança, é obrigatório definir uma nova senha antes de
              acessar a plataforma.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirme a Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-11"
              />
            </div>

            {/* Real-time validation checklist */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-1 text-xs font-semibold text-foreground">Critérios de segurança</div>
              <CriteriaItem met={criteria.minLength} label="Mínimo de 8 caracteres" />
              <CriteriaItem met={criteria.hasUpper} label="Pelo menos 1 letra maiúscula" />
              <CriteriaItem met={criteria.hasLower} label="Pelo menos 1 letra minúscula" />
              <CriteriaItem met={criteria.hasNumber} label="Pelo menos 1 número" />
              <CriteriaItem met={passwordsMatch} label="Senhas coincidem" />
            </div>

            {pwError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {pwError}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pwLoading}
                onClick={async () => {
                  await logout();
                  setFirstAccessOpen(false);
                }}
              >
                Sair
              </Button>
              <Button
                type="submit"
                disabled={pwLoading || !allCriteriaMet || !passwordsMatch}
                aria-busy={pwLoading}
                className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
              >
                {pwLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
