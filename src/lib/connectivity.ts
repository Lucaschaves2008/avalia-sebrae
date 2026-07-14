import { useSyncExternalStore } from "react";

// Monitor de conectividade com o banco de dados.
//
// Em redes corporativas filtradas (ex.: Zscaler no SEBRAE) as chamadas ao
// banco podem falhar mesmo com o site aberto. Sem este monitor, as telas
// simplesmente ficam vazias — o usuário acha que "o banco sumiu". O fetch
// resiliente reporta sucesso/falha aqui e o ConnectionBanner avisa o
// usuário com orientação clara em vez de falhar em silêncio.

export type ConnectivityStatus = "ok" | "no-internet" | "backend-unreachable";

let status: ConnectivityStatus = "ok";
let browserListenersAttached = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setStatus(next: ConnectivityStatus) {
  if (status === next) return;
  status = next;
  notify();
}

function attachBrowserListeners() {
  if (browserListenersAttached || typeof window === "undefined") return;
  browserListenersAttached = true;
  window.addEventListener("offline", () => setStatus("no-internet"));
  window.addEventListener("online", () => {
    // Voltou a ter rede local; o próximo request confirma se o banco responde.
    if (status === "no-internet") setStatus("ok");
  });
}

export function reportBackendSuccess() {
  setStatus("ok");
}

// Chamado apenas depois de esgotadas todas as tentativas (timeout + retries),
// então uma única chamada já indica indisponibilidade real, não um soluço.
export function reportBackendFailure() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus("no-internet");
  } else {
    setStatus("backend-unreachable");
  }
}

export function getConnectivityStatus(): ConnectivityStatus {
  return status;
}

export function useConnectivity(): ConnectivityStatus {
  return useSyncExternalStore(
    (callback) => {
      attachBrowserListeners();
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => status,
    () => "ok" as const,
  );
}

// Testa o caminho navegador → servidor do app (sem tocar no Supabase).
export async function pingAppServer(timeoutMs = 8000): Promise<boolean> {
  if (typeof window === "undefined") return true;
  try {
    const response = await fetch(`${window.location.origin}/supa-api/ping`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
