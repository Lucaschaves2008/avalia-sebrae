// Persistência simples de cache em localStorage com política SWR.
//
// Objetivo: no primeiro paint depois de um F5, os módulos já mostram os
// dados da sessão anterior (instantâneo, sem query no banco), enquanto uma
// revalidação em segundo plano atualiza a memória e o localStorage. Isso
// reduz drasticamente a latência percebida — sobretudo em redes com
// proxy corporativo (Zscaler) onde cada round-trip ao Supabase é caro.
//
// IMPORTANTE: o conteúdo do localStorage é dado NÃO CONFIÁVEL. Ele pode ter
// sido gravado por uma versão anterior do app (com outro formato), ficado
// truncado por falta de quota ou sido editado à mão. Como esses dados vão
// direto para o render, um registro fora do formato derruba a página inteira
// para a tela de erro — e, por estar persistido, o erro se repete a cada
// carregamento até alguém limpar o navegador. Por isso todo cache é
// validado/normalizado na leitura (ver `parse` em loadCache) e descartado
// silenciosamente quando não bate com o formato esperado.

const PREFIX = "sebrae:cache:v1:";
// Considera dados "frescos" por 60s — dentro desse período, mutações
// de outros módulos não causam re-fetch. Após isso, ainda mostramos o
// que temos e revalidamos em background (stale-while-revalidate).
export const FRESH_TTL_MS = 60_000;

interface Envelope<T> {
  t: number; // timestamp de gravação
  d: T; // dados
}

/**
 * Lê um cache persistido.
 *
 * @param parse Normalizador obrigatório para caches de dados: recebe o valor
 *   cru do localStorage e devolve o dado já no formato esperado, ou `null`
 *   para descartar o cache (formato antigo/corrompido). Sem ele, dados de
 *   uma versão anterior chegariam crus ao render.
 */
export function loadCache<T>(
  key: string,
  parse?: (raw: unknown) => T | null,
): { data: T; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<unknown>;
    if (!env || typeof env.t !== "number") return null;

    const data = parse ? parse(env.d) : (env.d as T);
    if (data === null || data === undefined) {
      // Formato incompatível: joga fora para não repetir o erro no próximo load.
      clearCache(key);
      return null;
    }
    return { data, savedAt: env.t };
  } catch {
    // JSON inválido ou normalizador que lançou — trata como cache ausente.
    clearCache(key);
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

// ---------- Helpers de normalização ----------

/**
 * Aplica `mapItem` a cada elemento de um cache de lista. Se qualquer item
 * estiver fora do formato, descarta o cache inteiro (retorna null) — meia
 * lista silenciosamente incompleta seria pior que um refetch.
 */
export function parseCachedList<T>(
  raw: unknown,
  mapItem: (item: Record<string, unknown>) => T | null,
): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const mapped = mapItem(item as Record<string, unknown>);
    if (mapped === null) return null;
    out.push(mapped);
  }
  return out;
}

/**
 * Normaliza uma lista vinda da REDE (banco). Diferente de `parseCachedList`,
 * descarta apenas os itens irrecuperáveis e mantém o resto: uma linha
 * estranha no banco não deve esconder todas as outras — mas também não pode
 * chegar crua ao render e derrubar a tela.
 */
export function sanitizeFetchedList<T>(
  raw: unknown,
  mapItem: (item: Record<string, unknown>) => T | null,
  rotulo: string,
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  let descartados = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      descartados++;
      continue;
    }
    const mapped = mapItem(item as Record<string, unknown>);
    if (mapped === null) {
      descartados++;
      continue;
    }
    out.push(mapped);
  }
  if (descartados) {
    console.warn(
      `[${rotulo}] ${descartados} registro(s) fora do formato esperado foram ignorados.`,
    );
  }
  return out;
}

export function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function asBoolean(v: unknown): boolean {
  return v === true;
}

export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
