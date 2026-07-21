// Persistência simples de cache em localStorage com política SWR.
//
// Objetivo: no primeiro paint depois de um F5, os módulos já mostram os
// dados da sessão anterior (instantâneo, sem query no banco), enquanto uma
// revalidação em segundo plano atualiza a memória e o localStorage. Isso
// reduz drasticamente a latência percebida — sobretudo em redes com
// proxy corporativo (Zscaler) onde cada round-trip ao Supabase é caro.

const PREFIX = "sebrae:cache:v1:";
// Considera dados "frescos" por 60s — dentro desse período, mutações
// de outros módulos não causam re-fetch. Após isso, ainda mostramos o
// que temos e revalidamos em background (stale-while-revalidate).
export const FRESH_TTL_MS = 60_000;

interface Envelope<T> {
  t: number; // timestamp de gravação
  d: T;      // dados
}

export function loadCache<T>(key: string): { data: T; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env.t !== "number") return null;
    return { data: env.d, savedAt: env.t };
  } catch {
    return null;
  }
}

export function saveCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const env: Envelope<T> = { t: Date.now(), d: data };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    // Quota excedida ou modo privado — ignora silenciosamente.
  }
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function clearAllCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function isFresh(savedAt: number, ttl: number = FRESH_TTL_MS): boolean {
  return Date.now() - savedAt < ttl;
}
