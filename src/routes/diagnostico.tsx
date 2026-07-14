import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SebraeLogo } from "@/components/SebraeLogo";

// Página pública de diagnóstico de conectividade.
//
// Criada por causa dos bloqueios do Zscaler na rede do SEBRAE: quando o
// sistema "perde o banco de dados", esta página mostra exatamente qual
// trecho do caminho está bloqueado e gera um relatório copiável para
// enviar à equipe de TI. Não expõe nenhum dado do sistema — apenas testa
// endpoints públicos de saúde.

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de Conexão — AVALIA SEBRAE" },
      {
        name: "description",
        content: "Verificação de conectividade do sistema AVALIA SEBRAE com o banco de dados.",
      },
    ],
  }),
  component: DiagnosticoPage,
});

type TestResult = {
  status: "pending" | "running" | "ok" | "fail";
  latencyMs?: number;
  detail?: string;
};

type TestKey = "internet" | "appServer" | "dbViaApp" | "dbDirect";

const TEST_LABELS: Record<TestKey, { title: string; description: string }> = {
  internet: {
    title: "1. Internet (rede local)",
    description: "Verifica se este computador está conectado a alguma rede.",
  },
  appServer: {
    title: "2. Servidor do aplicativo",
    description: "Verifica se o site AVALIA SEBRAE responde neste computador.",
  },
  dbViaApp: {
    title: "3. Banco de dados através do aplicativo",
    description:
      "Caminho usado pelo sistema: o banco é acessado pelo próprio domínio do site, imune a bloqueios de domínios externos.",
  },
  dbDirect: {
    title: "4. Acesso direto ao Supabase (informativo)",
    description:
      "Testa o acesso direto ao banco (*.supabase.co). Se falhar e o teste 3 passar, a rede está bloqueando o Supabase — mas o sistema continua funcionando pelo caminho do teste 3.",
  },
};

const INITIAL_RESULTS: Record<TestKey, TestResult> = {
  internet: { status: "pending" },
  appServer: { status: "pending" },
  dbViaApp: { status: "pending" },
  dbDirect: { status: "pending" },
};

async function timedFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<TestResult> {
  const { timeoutMs = 10_000, ...rest } = init;
  const start = performance.now();
  try {
    const response = await fetch(url, {
      ...rest,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (response.ok) {
      return { status: "ok", latencyMs, detail: `HTTP ${response.status}` };
    }
    return { status: "fail", latencyMs, detail: `HTTP ${response.status}` };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return {
      status: "fail",
      latencyMs,
      detail: isTimeout
        ? `Sem resposta em ${Math.round(timeoutMs / 1000)}s (conexão bloqueada ou instável)`
        : "Falha de rede (bloqueio de proxy/firewall ou sem conexão)",
    };
  }
}

function interpret(results: Record<TestKey, TestResult>): {
  tone: "ok" | "warn" | "fail";
  message: string;
} {
  const { internet, appServer, dbViaApp, dbDirect } = results;
  const done = [internet, appServer, dbViaApp, dbDirect].every(
    (r) => r.status === "ok" || r.status === "fail",
  );
  if (!done) return { tone: "warn", message: "Executando testes..." };

  if (internet.status === "fail") {
    return {
      tone: "fail",
      message:
        "Este computador está sem conexão de rede. Verifique o Wi-Fi/cabo e tente novamente.",
    };
  }
  if (appServer.status === "fail") {
    return {
      tone: "fail",
      message:
        "O domínio do site está bloqueado ou inacessível nesta rede. Solicite à TI a liberação do endereço do sistema (copie o relatório abaixo e envie junto).",
    };
  }
  if (dbViaApp.status === "fail") {
    return {
      tone: "fail",
      message:
        "O site responde, mas o servidor do aplicativo não conseguiu falar com o banco de dados. Isso não é um bloqueio da sua rede — informe o suporte do sistema com o relatório abaixo.",
    };
  }
  if (dbDirect.status === "fail") {
    return {
      tone: "ok",
      message:
        "Tudo funcionando. Observação: esta rede bloqueia o acesso direto ao Supabase (comportamento típico do Zscaler), mas o sistema não depende mais desse caminho — todos os dados trafegam pelo próprio domínio do site.",
    };
  }
  return { tone: "ok", message: "Tudo funcionando. Nenhum bloqueio detectado nesta rede." };
}

function buildReport(results: Record<TestKey, TestResult>): string {
  const lines = [
    "=== Relatório de diagnóstico — AVALIA SEBRAE ===",
    `Data/hora: ${new Date().toLocaleString("pt-BR")}`,
    `Página: ${window.location.origin}`,
    `Navegador: ${navigator.userAgent}`,
    `navigator.onLine: ${navigator.onLine}`,
    "",
    ...Object.entries(TEST_LABELS).map(([key, label]) => {
      const r = results[key as TestKey];
      const icon = r.status === "ok" ? "OK  " : r.status === "fail" ? "ERRO" : "--  ";
      const latency = r.latencyMs != null ? ` (${r.latencyMs} ms)` : "";
      return `[${icon}] ${label.title}${latency}${r.detail ? ` — ${r.detail}` : ""}`;
    }),
    "",
    `Conclusão: ${interpret(results).message}`,
  ];
  return lines.join("\n");
}

function StatusIcon({ status }: { status: TestResult["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "fail") return <XCircle className="h-5 w-5 text-red-600" />;
  if (status === "running")
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return <Activity className="h-5 w-5 text-muted-foreground/50" />;
}

function DiagnosticoPage() {
  const [results, setResults] = useState<Record<TestKey, TestResult>>(INITIAL_RESULTS);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const setResult = (key: TestKey, result: TestResult) =>
    setResults((prev) => ({ ...prev, [key]: result }));

  const runTests = useCallback(async () => {
    setRunning(true);
    setCopied(false);
    setResults({
      internet: { status: "running" },
      appServer: { status: "running" },
      dbViaApp: { status: "running" },
      dbDirect: { status: "running" },
    });

    const origin = window.location.origin;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    setResult("internet", {
      status: navigator.onLine ? "ok" : "fail",
      detail: navigator.onLine ? "Rede detectada" : "Sem rede detectada pelo navegador",
    });

    const [appServer, dbViaApp, dbDirect] = await Promise.all([
      timedFetch(`${origin}/supa-api/ping`),
      timedFetch(`${origin}/supa-api/auth/v1/health`, {
        headers: supabaseKey ? { apikey: supabaseKey } : undefined,
      }),
      supabaseUrl
        ? timedFetch(`${supabaseUrl}/auth/v1/health`, {
            headers: supabaseKey ? { apikey: supabaseKey } : undefined,
            timeoutMs: 8_000,
          })
        : Promise.resolve<TestResult>({
            status: "fail",
            detail: "URL do Supabase não configurada no build",
          }),
    ]);

    setResult("appServer", appServer);
    setResult("dbViaApp", dbViaApp);
    setResult("dbDirect", dbDirect);
    setRunning(false);
  }, []);

  useEffect(() => {
    void runTests();
  }, [runTests]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReport(results));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard bloqueado: mostra o relatório para cópia manual.
      window.prompt("Copie o relatório abaixo:", buildReport(results));
    }
  }

  const conclusion = interpret(results);
  const toneClasses =
    conclusion.tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : conclusion.tone === "fail"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <SebraeLogo variant="onLight" height={36} />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao acesso
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico de conexão</CardTitle>
            <CardDescription>
              Verifica se este computador consegue acessar o sistema e o banco de dados. Em redes
              corporativas com filtro de conteúdo (ex.: Zscaler), use o relatório desta página para
              solicitar liberações à equipe de TI.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(Object.keys(TEST_LABELS) as TestKey[]).map((key) => {
              const result = results[key];
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <StatusIcon status={result.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {TEST_LABELS[key].title}
                      {result.latencyMs != null && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {result.latencyMs} ms
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {TEST_LABELS[key].description}
                    </p>
                    {result.detail && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {result.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            <div className={`rounded-lg border p-3 text-sm ${toneClasses}`}>
              {conclusion.message}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void runTests()} disabled={running} variant="default">
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Executar novamente
              </Button>
              <Button onClick={() => void copyReport()} disabled={running} variant="outline">
                <ClipboardCopy className="h-4 w-4" />
                {copied ? "Copiado!" : "Copiar relatório para a TI"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
