import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { AuthProvider, useAuth, REGIONS, STATES_BY_REGION, type Region } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { PrvdFooter } from "@/components/PrvdFooter";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div
      className={`flex items-center gap-2 text-xs ${met ? "text-emerald-600" : "text-muted-foreground"}`}
    >
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
      <span>{label}</span>
    </div>
  );
}

function LoginPage() {
  const { user, login, signUp, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Signup state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suRegion, setSuRegion] = useState<Region | "">("");
  const [suState, setSuState] = useState<string>("");
  const [suUnit, setSuUnit] = useState("");
  const [suError, setSuError] = useState<string | null>(null);
  const [suLoading, setSuLoading] = useState(false);

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

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (suLoading) return;
    setSuError(null);

    if (!suName.trim() || !suEmail.trim() || !suUnit.trim() || !suRegion || !suState) {
      setSuError("Preencha todos os campos para continuar.");
      return;
    }
    if (suPassword.length < 8) {
      setSuError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (suPassword !== suConfirm) {
      setSuError("As senhas não coincidem.");
      return;
    }

    setSuLoading(true);
    const result = await signUp({
      name: suName.trim(),
      email: suEmail.trim(),
      phone: "",
      unit: suUnit.trim(),
      region: suRegion,
      state: suState,
      role: "gestor",
      status: "Ativo",
      password: suPassword,
    });
    setSuLoading(false);

    if (!result.ok) {
      const msg = /registered|exists|already/i.test(result.error)
        ? "Este e-mail já está cadastrado. Faça login."
        : result.error;
      setSuError(msg);
      toast.error(msg);
      return;
    }
    toast.success(`Conta criada com sucesso! Bem-vindo(a), ${result.user.name.split(" ")[0]}.`);
    navigate({ to: "/dashboard" });
  }


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
          <h1 className="text-4xl font-bold leading-tight text-white">
            Sistema de avaliação do Portfólio de Cursos da&nbsp;
            <span className="text-secondary">Educação Empreendedora</span>
          </h1>
          <p className="max-w-md text-base text-white/80">{"\n"}</p>
        </div>
        <div className="relative space-y-3">
          <PrvdFooter variant="onDark" className="justify-start" />
          <div className="text-xs text-white/60">
            © {new Date().getFullYear()}&nbsp;— Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <SebraeLogo variant="onLight" height={36} />
          </div>

          {mode === "login" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Acesso ao sistema
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe suas credenciais para continuar.
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
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotSent(false);
                        setForgotError(null);
                        setForgotOpen(true);
                      }}
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
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Criar conta
                </button>
              </p>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Problemas para entrar nesta rede?{" "}
                <Link to="/diagnostico" className="font-medium text-primary hover:underline">
                  Executar diagnóstico de conexão
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Criar conta</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre-se como Gestor Regional para avaliar os cursos.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="suName">Nome completo</Label>
                  <Input
                    id="suName"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suEmail">E-mail</Label>
                  <Input
                    id="suEmail"
                    type="email"
                    autoComplete="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    required
                    placeholder="seu.nome@sebrae.com.br"
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="suPassword">Senha</Label>
                    <Input
                      id="suPassword"
                      type="password"
                      autoComplete="new-password"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suConfirm">Confirmar senha</Label>
                    <Input
                      id="suConfirm"
                      type="password"
                      autoComplete="new-password"
                      value={suConfirm}
                      onChange={(e) => setSuConfirm(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="suRegion">Região</Label>
                    <Select
                      value={suRegion}
                      onValueChange={(v) => {
                        setSuRegion(v as Region);
                        setSuState("");
                      }}
                    >
                      <SelectTrigger id="suRegion" className="h-11">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suState">UF</Label>
                    <Select
                      value={suState}
                      onValueChange={setSuState}
                      disabled={!suRegion}
                    >
                      <SelectTrigger id="suState" className="h-11">
                        <SelectValue placeholder={suRegion ? "Selecione" : "Escolha a região"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(suRegion ? STATES_BY_REGION[suRegion] : []).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suUnit">Unidade</Label>
                  <Input
                    id="suUnit"
                    value={suUnit}
                    onChange={(e) => setSuUnit(e.target.value)}
                    required
                    placeholder="Ex.: SEBRAE SP"
                    className="h-11"
                  />
                </div>

                {suError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {suError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={suLoading}
                  aria-busy={suLoading}
                  className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-all hover:bg-[var(--primary-hover)]"
                >
                  {suLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando conta...
                    </span>
                  ) : (
                    "Criar conta"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setSuError(null);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Entrar
                </button>
              </p>
            </>
          )}
        </div>
      </div>


      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              {forgotSent
                ? "Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha em instantes."
                : "Informe seu e-mail corporativo e enviaremos um link para você definir uma nova senha."}
            </DialogDescription>
          </DialogHeader>

          {!forgotSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="forgotEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu.nome@sebrae.com.br"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              {forgotError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {forgotError}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={forgotLoading}
                  onClick={() => setForgotOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  aria-busy={forgotLoading}
                  className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                >
                  {forgotLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
              >
                Entendi
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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
              Por segurança, é obrigatório definir uma nova senha antes de acessar a plataforma.
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
              <div className="mb-1 text-xs font-semibold text-foreground">
                Critérios de segurança
              </div>
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
