import { Loader2, WifiOff } from "lucide-react";

// Estado intermediário das páginas protegidas: ou a sessão ainda está sendo
// carregada, ou o perfil não pôde ser lido por falha de conexão.
//
// O segundo caso importa: antes ele era indistinguível de "não há usuário
// logado", e uma instabilidade da rede (comum atrás do proxy corporativo)
// expulsava a pessoa para a tela de login no meio do trabalho. Agora ela
// permanece na página, vê o motivo e pode tentar de novo.
export function AuthPending({ authError }: { authError?: string | null }) {
  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <WifiOff className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Não foi possível carregar seu perfil
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua sessão continua válida, mas o sistema não conseguiu falar com o banco de dados. Pode
            ser instabilidade de rede ou bloqueio do proxy corporativo.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Tentar novamente
            </button>
            <a
              href="/diagnostico"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Executar diagnóstico
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando...
    </div>
  );
}

export default AuthPending;
