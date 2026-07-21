import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Loader2, LogOut, Mail, Save, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Portfólio de Cursos SEBRAE" },
      {
        name: "description",
        content: "Gerencie suas informações de conta, senha e preferências.",
      },
    ],
  }),
  component: () => (
    <AuthProvider>
      <ProfilePage />
    </AuthProvider>
  ),
});

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function formatMemberSince(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function ProfilePage() {
  const { user, logout, refresh } = useAuth() as ReturnType<typeof useAuth> & {
    refresh?: () => Promise<void>;
  };
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const memberSince = useMemo(() => formatMemberSince((user as any)?.createdAt ?? null), [user]);

  if (!user) {
    return (
      <AppShell>
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Carregando perfil...
        </div>
      </AppShell>
    );
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (savingInfo) return;
    setSavingInfo(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), phone: phone.trim() })
      .eq("id", user!.id);
    setSavingInfo(false);
    if (error) {
      toast.error("Não foi possível salvar as informações.");
      return;
    }
    toast.success("Informações atualizadas.");
    if (typeof refresh === "function") await refresh();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPwd) return;
    if (newPwd.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSavingPwd(true);
    // Reautenticação para validar a senha atual
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email,
      password: currentPwd,
    });
    if (signInErr) {
      setSavingPwd(false);
      toast.error("Senha atual incorreta.");
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (updErr) {
      toast.error("Não foi possível atualizar a senha.");
      return;
    }
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    toast.success("Senha alterada com sucesso.");
  }

  const roleLabel = user.role === "admin" ? "Gestor Nacional" : `Gestor Regional — ${user.region}`;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header card */}
        <Card className="border-border/70">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground ring-1 ring-primary/20">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-foreground">{user.name}</h1>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Membro desde {memberSince}</span>
                </div>
                <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {roleLabel}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>Suas informações de cadastro e login.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveInfo} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" value={user.email} disabled className="bg-muted/40" />
                <p className="text-xs text-muted-foreground">
                  O e-mail é utilizado para login e não pode ser alterado aqui.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input value={user.unit ?? ""} disabled className="bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Label>Região / UF</Label>
                  <Input
                    value={`${user.region}${user.state ? " — " + user.state : ""}`}
                    disabled
                    className="bg-muted/40"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingInfo} className="gap-2">
                  {savingInfo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Foto de perfil */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Imagem de perfil</CardTitle>
            <CardDescription>Faça o upload da sua imagem de perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                {initials(user.name)}
              </div>
              <div className="flex-1">
                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Escolher arquivo</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG ou WEBP até 2 MB</span>
                  <span className="mt-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Em breve
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alterar senha */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
            <CardDescription>
              Escolha uma senha forte. Recomendamos ao menos 8 caracteres com números e letras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Senha atual</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new">Nova senha</Label>
                  <Input
                    id="new"
                    type="password"
                    autoComplete="new-password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPwd} className="gap-2">
                  {savingPwd ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                  Atualizar senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
