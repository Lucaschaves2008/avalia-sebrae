import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import {
  pingAppServer,
  reportBackendFailure,
  reportBackendSuccess,
  useConnectivity,
} from "@/lib/connectivity";

// Aviso fixo exibido quando o banco de dados está inacessível (queda de
// internet ou bloqueio de rede corporativa, como o Zscaler do SEBRAE).
// Sem ele, as telas apenas ficam vazias e o usuário não sabe o motivo.
export function ConnectionBanner() {
  const status = useConnectivity();
  const [checking, setChecking] = useState(false);

  if (status === "ok") return null;

  const isOffline = status === "no-internet";

  async function handleRetry() {
    setChecking(true);
    const ok = await pingAppServer();
    if (ok) {
      reportBackendSuccess();
      // Recarrega para refazer as consultas que falharam.
      window.location.reload();
    } else {
      reportBackendFailure();
    }
    setChecking(false);
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-amber-500 px-4 py-2.5 text-sm font-medium text-amber-950 shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        {isOffline
          ? "Sem conexão com a internet. Verifique sua rede."
          : "Não foi possível conectar ao banco de dados. Pode ser instabilidade ou um bloqueio da rede (proxy/firewall corporativo)."}
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRetry}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20 disabled:opacity-60"
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Tentar novamente
        </button>
        <Link
          to="/diagnostico"
          className="rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20"
        >
          Diagnóstico
        </Link>
      </span>
    </div>
  );
}
