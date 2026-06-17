import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpen, FileText, GraduationCap, LogOut, MapPin, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Painel — Portfólio de Cursos SEBRAE" }],
  }),
  component: () => (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  ),
});

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      const t = setTimeout(() => {
        if (!user) navigate({ to: "/login" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const stats =
    user.role === "admin"
      ? [
          { label: "Cursos ativos", value: "148", icon: BookOpen },
          { label: "Turmas em andamento", value: "412", icon: GraduationCap },
          { label: "Empreendedores", value: "32.8k", icon: Users },
          { label: "Regiões atendidas", value: "5", icon: MapPin },
        ]
      : [
          { label: "Cursos na região", value: "37", icon: BookOpen },
          { label: "Turmas em andamento", value: "84", icon: GraduationCap },
          { label: "Empreendedores", value: "6.2k", icon: Users },
          { label: "Estados", value: "9", icon: MapPin },
        ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header
        className="border-b border-white/10"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <SebraeLogo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-white sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-white/70">
                {user.role === "admin" ? "Administrador" : `Gestor — ${user.region}`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/courses" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Cursos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/reports" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatórios
            </Button>
            {user.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/users" })}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <UserCog className="mr-2 h-4 w-4" />
                Usuários
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {user.role === "admin" ? "Acesso total" : `Região ${user.region}`}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Bem-vindo(a), {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Portfólio de Cursos de Educação Empreendedora — visão geral.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold text-foreground">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">
            Próximos passos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta é a base do portal. Em seguida, podemos implementar o
            cadastro de cursos, gestão de turmas, indicadores e relatórios.
          </p>
        </div>
      </main>
    </div>
  );
}
