import { createFileRoute } from "@tanstack/react-router";

// Proxy same-origin para o Supabase.
//
// Redes corporativas com filtragem TLS (ex.: Zscaler, usado no SEBRAE)
// frequentemente bloqueiam ou degradam chamadas do navegador para
// *.supabase.co, fazendo o app carregar mas "perder" o banco de dados.
// Esta rota recebe as chamadas do supabase-js no MESMO domínio do site
// (/supa-api/...) e as repassa, do lado do servidor, para o Supabase —
// tráfego same-origin não depende de liberação de domínios de terceiros.
//
// Segurança: encaminha apenas os prefixos abaixo, sempre para o
// SUPABASE_URL fixo do projeto, sem injetar nenhuma credencial —
// o token do usuário e a publishable key vêm do próprio navegador,
// portanto RLS e permissões continuam valendo integralmente.
const ALLOWED_PREFIXES = ["auth/v1", "rest/v1", "storage/v1", "functions/v1"];

// Cabeçalhos que não devem ser repassados ao Supabase (hop-by-hop,
// específicos do proxy/CDN ou do contexto same-origin do navegador).
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "accept-encoding",
  "cookie",
  "origin",
  "referer",
  "upgrade",
  "keep-alive",
  "te",
  "trailer",
  "forwarded",
  "cdn-loop",
]);
const STRIP_REQUEST_HEADER_PREFIXES = ["x-forwarded-", "cf-", "sec-", "proxy-"];

const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "access-control-max-age",
]);

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (STRIP_REQUEST_HEADERS.has(k)) return;
    if (STRIP_REQUEST_HEADER_PREFIXES.some((p) => k.startsWith(p))) return;
    headers.set(key, value);
  });
  return headers;
}

async function proxySupabase({
  request,
  params,
}: {
  request: Request;
  params: { _splat?: string };
}): Promise<Response> {
  const splat = (params._splat ?? "").replace(/^\/+/, "");

  // Endpoint local de verificação: responde sem tocar no Supabase.
  // Usado pelo monitor de conectividade e pela página /diagnostico.
  if (splat === "ping") {
    return Response.json(
      { ok: true, service: "avalia-sebrae", ts: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (!ALLOWED_PREFIXES.some((p) => splat === p || splat.startsWith(`${p}/`))) {
    return Response.json({ error: "Rota não permitida pelo proxy." }, { status: 404 });
  }

  // Ler dentro do handler: em alguns runtimes (Cloudflare) o env só
  // existe em tempo de requisição.
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!SUPABASE_URL) {
    return Response.json({ error: "SUPABASE_URL não configurada no servidor." }, { status: 500 });
  }

  const incoming = new URL(request.url);
  const target = `${SUPABASE_URL.replace(/\/+$/, "")}/${splat}${incoming.search}`;

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  // Corpo bufferizado: payloads aqui são JSON pequenos e isso evita
  // diferenças de streaming entre runtimes (Node dev × Workers prod).
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: buildUpstreamHeaders(request),
      body,
      redirect: "manual",
    });
  } catch (error) {
    console.error("[supa-api] Falha ao contatar o Supabase:", error);
    return Response.json(
      {
        error: "O servidor do aplicativo não conseguiu contatar o banco de dados.",
        code: "UPSTREAM_UNREACHABLE",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/supa-api/$")({
  server: {
    handlers: {
      ANY: proxySupabase,
    },
  },
});
