import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

// Tela exibida quando uma página quebra em tempo de render.
//
// A interface pública deliberadamente não expõe stack traces nem ações
// destrutivas. A falha continua sendo enviada à telemetria para investigação.

interface ErrorStateProps {
  error: Error;
  reset?: () => void;
  /** Identifica o limite de erro que capturou a falha (para telemetria). */
  boundary?: string;
  /** Compacto: usado quando a tela já está dentro do AppShell. */
  inline?: boolean;
}

export function ErrorState({ error, reset, boundary = "route", inline = false }: ErrorStateProps) {
  useEffect(() => {
    console.error(`[${boundary}]`, error);
    reportLovableError(error, { boundary });
  }, [error, boundary]);

  return (
    <div
      className={
        inline
          ? "flex min-h-[50vh] items-center justify-center px-4"
          : "flex min-h-screen items-center justify-center bg-background px-4"
      }
    >
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex w-fit items-center gap-2.5 border-l-2 border-[var(--effort-high-ink)] pl-3 text-left">
          <span
            aria-hidden
            className="grid h-4 w-4 shrink-0 place-items-center"
            style={{ border: "1.5px solid var(--effort-high-ink)" }}
          >
            <span
              className="h-[1.5px] w-3 rotate-45"
              style={{ background: "var(--effort-high)" }}
            />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--effort-high-ink)]">
            Falha ao carregar
          </span>
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Não foi possível exibir esta página
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          O sistema encontrou uma instabilidade ao abrir esta página. Tente novamente ou retorne ao
          início para continuar.
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
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export default ErrorState;
