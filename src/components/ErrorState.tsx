import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Eraser } from "lucide-react";

import { clearAllCaches } from "@/lib/cache-persist";
import { reportLovableError } from "@/lib/lovable-error-reporting";

// Tela exibida quando uma página quebra em tempo de render.
//
// Além de informar, ela precisa permitir SAIR do erro. A causa mais comum de
// um erro que "volta toda hora" é dado inválido guardado no localStorage
// (cache de uma versão anterior do app): recarregar não resolve, porque o
// mesmo dado é lido de novo. Por isso a ação de limpar os dados locais fica
// à mão do usuário, sem precisar de suporte técnico.

interface ErrorStateProps {
  error: Error;
  reset?: () => void;
  /** Identifica o limite de erro que capturou a falha (para telemetria). */
  boundary?: string;
  /** Compacto: usado quando a tela já está dentro do AppShell. */
  inline?: boolean;
}

export function ErrorState({ error, reset, boundary = "route", inline = false }: ErrorStateProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  useEffect(() => {
    console.error(`[${boundary}]`, error);
    reportLovableError(error, { boundary });
  }, [error, boundary]);

  function limparDadosLocais() {
    clearAllCaches();
    window.location.reload();
  }

  return (
    <div
      className={
        inline
          ? "flex min-h-[50vh] items-center justify-center px-4"
          : "flex min-h-screen items-center justify-center bg-background px-4"
      }
    >
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Não foi possível exibir esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Houve uma falha ao montar a tela. Tente novamente; se o erro voltar sempre no mesmo lugar,
          limpe os dados salvos neste navegador — isso costuma resolver.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {reset && (
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          )}
          <button
            onClick={limparDadosLocais}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Eraser className="h-4 w-4" />
            Limpar dados locais e recarregar
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </a>
        </div>

        <button
          type="button"
          onClick={() => setDetalhesAbertos((v) => !v)}
          className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {detalhesAbertos ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
        </button>
        {detalhesAbertos && (
          <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
            {error?.message ?? "Erro desconhecido"}
            {error?.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
