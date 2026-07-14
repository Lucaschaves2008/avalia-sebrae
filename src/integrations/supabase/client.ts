// CUSTOMIZADO (originalmente gerado pela Lovable — manter estas alterações
// se o arquivo for regenerado):
//  1. No navegador, o cliente aponta para o proxy same-origin /supa-api
//     (src/routes/supa-api.$.tsx) em vez de *.supabase.co, porque redes
//     corporativas com Zscaler (caso do SEBRAE) bloqueiam domínios de
//     terceiros e derrubavam login e dados do sistema.
//  2. fetch com timeout + retry (resilientFetch) contra quedas de conexão.
//  3. storageKey fixado no ref do projeto para preservar sessões existentes.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { resilientFetch } from "@/lib/resilient-fetch";

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const SUPABASE_PROJECT_ID =
    import.meta.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const isBrowser = typeof window !== "undefined";
  // No navegador todo o tráfego vai para o próprio domínio do site
  // (indistinguível do site para filtros de rede); no SSR o servidor
  // fala direto com o Supabase. VITE_SUPABASE_DIRECT="true" desativa
  // o proxy caso um dia seja necessário voltar ao acesso direto.
  const useProxy = isBrowser && import.meta.env.VITE_SUPABASE_DIRECT !== "true";
  const url = useProxy ? `${window.location.origin}/supa-api` : SUPABASE_URL;

  // Mesmo storageKey do acesso direto (sb-<ref>-auth-token) para que as
  // sessões já salvas continuem válidas após a troca de URL.
  const projectRef = SUPABASE_PROJECT_ID || new URL(SUPABASE_URL).hostname.split(".")[0];

  return createClient<Database>(url, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: isBrowser ? localStorage : undefined,
      storageKey: `sb-${projectRef}-auth-token`,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: resilientFetch,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
