import { reportBackendFailure, reportBackendSuccess } from "./connectivity";

// Fetch com timeout e novas tentativas, usado pelo cliente Supabase.
//
// Proxies corporativos (ex.: Zscaler) podem derrubar conexões TLS no meio
// do caminho ou deixá-las penduradas indefinidamente. Sem timeout, a tela
// fica "carregando" para sempre; sem retry, um único reset vira erro para
// o usuário. Aqui cada chamada tem prazo máximo e falhas transitórias são
// reexecutadas com backoff antes de desistir.

const TIMEOUT_MS = 20_000;
const RETRY_BACKOFF_MS = [600, 1800];
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCallerAbort(signal: AbortSignal | null | undefined, error: unknown) {
  return Boolean(signal?.aborted) && error instanceof Error && error.name === "AbortError";
}

export const resilientFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const callerSignal = init?.signal ?? request?.signal ?? undefined;
  const idempotent = method === "GET" || method === "HEAD";
  // Um Request com corpo em stream não pode ser reenviado; o supabase-js
  // sempre chama fetch(url, init), então na prática retries ficam ativos.
  const canRetry = !(request && method !== "GET" && method !== "HEAD");
  const maxAttempts = canRetry ? 1 + RETRY_BACKOFF_MS.length : 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (callerSignal?.aborted) throw lastError ?? new DOMException("Aborted", "AbortError");

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener("abort", onCallerAbort);
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });

      // Resposta chegou: a rede até o servidor funciona. 5xx de gateway em
      // método idempotente ainda é retentável antes de reportar indisponível.
      if (RETRYABLE_STATUSES.has(response.status) && idempotent && attempt < maxAttempts - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      if (RETRYABLE_STATUSES.has(response.status)) {
        reportBackendFailure();
      } else {
        reportBackendSuccess();
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isCallerAbort(callerSignal, error)) throw error;
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  reportBackendFailure();
  throw lastError;
};
