import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Printer, AlertTriangle, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { useCoursesList, type Course } from "@/lib/courses";
import {
  useJudgmentsList,
  DECISION_LABELS,
  PRIORITY_STYLES,
  type Judgment,
} from "@/lib/judgments";
import { useProcessesList, effectiveStatus, type EvaluationProcess } from "@/lib/processes";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Relatórios — Portfólio SEBRAE" }],
  }),
  component: () => (
    <AuthProvider>
      <ReportsPage />
    </AuthProvider>
  ),
});

function ReportsPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const processes = useProcessesList();
  const [processId, setProcessId] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Auto-select most recent ATIVO process
  useEffect(() => {
    if (processId || processes.length === 0) return;
    const active = processes.find((p) => effectiveStatus(p) === "ATIVO");
    setProcessId((active ?? processes[0]).id);
  }, [processes, processId]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const selectedProcess = processes.find((p) => p.id === processId);

  return (
    <div className="min-h-screen bg-muted/30">
      <header
        className="border-b border-white/10 print:hidden"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <SebraeLogo />
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 print:px-0 print:py-0">
        <div className="mb-6 print:hidden">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <FileText className="h-3 w-3" />
            Central de Relatórios
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Relatórios
          </h1>
          <p className="mt-1 text-muted-foreground">
            Relatório otimizado para impressão ou exportação em PDF (via janela
            de impressão do navegador).
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex-1 min-w-[260px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Processo avaliativo
              </label>
              <Select value={processId} onValueChange={setProcessId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um processo..." />
                </SelectTrigger>
                <SelectContent>
                  {processes.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nenhum processo cadastrado.
                    </div>
                  )}
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {effectiveStatus(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProcess && (
              <div className="text-xs text-muted-foreground">
                Período: {selectedProcess.startDate} a {selectedProcess.endDate}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-10 print:space-y-0">
          {selectedProcess ? (
            <GlobalEvaluationReport process={selectedProcess} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground print:hidden">
              Selecione um processo avaliativo para visualizar o relatório.
            </div>
          )}
        </div>
      </main>

      <PrintStyles />
    </div>
  );
}

function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="hidden print:block print-header">
      <div className="flex items-center justify-between border-b-4 border-[#005CA9] pb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[#005CA9]">
            SEBRAE — Portfólio de Cursos
          </div>
          <div className="text-xl font-bold text-[#005CA9]">{title}</div>
          {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
        </div>
        <div className="h-10 w-10 rounded-md bg-[#FFCC00]" />
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        Emitido em {new Date().toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  children,
  printTitle,
  printSubtitle,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  printTitle: string;
  printSubtitle?: string;
}) {
  const onPrint = () => {
    document.body.classList.add("printing");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing"), 200);
    }, 50);
  };
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] print:rounded-none print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-6 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={onPrint} className="bg-primary hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" />
          Gerar PDF / Imprimir
        </Button>
      </div>
      <div className="p-6 print:p-0">
        <PrintHeader title={printTitle} subtitle={printSubtitle} />
        {children}
      </div>
    </section>
  );
}

// ---------- Relatório: Avaliação Global ----------

function GlobalEvaluationReport({ process }: { process: EvaluationProcess }) {
  const allCourses = useCoursesList();
  const allJudgments = useJudgmentsList();

  const sections = useMemo(() => {
    const courseIds = new Set(process.courseIds);
    const courses = allCourses.filter((c) => courseIds.has(c.id));
    const judgments = allJudgments.filter((j) => j.processId === process.id);

    const byCourse = new Map<string, Judgment[]>();
    for (const j of judgments) {
      const arr = byCourse.get(j.courseId) ?? [];
      arr.push(j);
      byCourse.set(j.courseId, arr);
    }

    const items = courses
      .map((course) => {
        const js = byCourse.get(course.id) ?? [];
        if (js.length === 0) return null;
        const counts = {
          MANTIDO: js.filter((j) => j.decision === "MANTIDO").length,
          ATUALIZADO: js.filter((j) => j.decision === "ATUALIZADO").length,
          INATIVACAO: js.filter((j) => j.decision === "INATIVACAO").length,
        };
        const order: Array<keyof typeof counts> = ["MANTIDO", "ATUALIZADO", "INATIVACAO"];
        const dominant = order.reduce((a, b) => (counts[b] > counts[a] ? b : a));
        return { course, judgments: js, counts, dominant };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      mantidos: items.filter((i) => i.dominant === "MANTIDO"),
      atualizados: items.filter((i) => i.dominant === "ATUALIZADO"),
      inativacoes: items.filter((i) => i.dominant === "INATIVACAO"),
    };
  }, [allCourses, allJudgments, process]);

  const total =
    sections.mantidos.length + sections.atualizados.length + sections.inativacoes.length;

  return (
    <ReportCard
      title="Relatório de Avaliação Global e Priorização"
      description={`Consolidação das avaliações das regionais para o processo "${process.name}", agrupando os cursos por decisão dominante.`}
      printTitle="Avaliação Global e Priorização do Portfólio"
      printSubtitle={`Processo: ${process.name} · ${total} curso(s) avaliado(s) pelas regionais`}
    >
      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Ainda não há avaliações registradas para este processo.
        </div>
      ) : (
        <div className="space-y-8">
          <SectionBlock
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Cursos Indicados para Manutenção"
            count={sections.mantidos.length}
            accent="emerald"
          >
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 print:border-amber-400">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <div className="text-sm text-amber-900">
                <strong>Aviso de Priorização:</strong> estes cursos{" "}
                <strong>devem ser priorizados</strong> para o desenvolvimento e
                confecção de materiais didáticos, garantindo sua continuidade
                no portfólio.
              </div>
            </div>
            <CoursesList items={sections.mantidos} renderExtra={() => null} />
          </SectionBlock>

          <div className="print-break" />

          <SectionBlock
            icon={<RefreshCw className="h-5 w-5" />}
            title="Cursos Indicados para Atualização"
            count={sections.atualizados.length}
            accent="amber"
          >
            <CoursesList
              items={sections.atualizados}
              renderExtra={(item) => (
                <div className="mt-3 rounded-md bg-amber-50/60 p-3 print:bg-amber-50">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Melhorias apontadas pelas regionais
                  </div>
                  <ul className="space-y-2">
                    {item.judgments
                      .filter((j) => j.decision === "ATUALIZADO" && j.updatesNeeded)
                      .map((j) => (
                        <li key={j.id} className="text-sm text-foreground">
                          <span className="mr-2 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {j.region}
                          </span>
                          {j.updatesNeeded}
                        </li>
                      ))}
                    {item.judgments.filter(
                      (j) => j.decision === "ATUALIZADO" && j.updatesNeeded,
                    ).length === 0 && (
                      <li className="text-xs italic text-muted-foreground">
                        Nenhuma melhoria detalhada informada.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            />
          </SectionBlock>

          <div className="print-break" />

          <SectionBlock
            icon={<XCircle className="h-5 w-5" />}
            title="Cursos Indicados para Inativação"
            count={sections.inativacoes.length}
            accent="rose"
          >
            <CoursesList items={sections.inativacoes} renderExtra={() => null} />
          </SectionBlock>
        </div>
      )}
    </ReportCard>
  );
}

function SectionBlock({
  icon,
  title,
  count,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accent: "emerald" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const accentMap = {
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
  };
  return (
    <div className="rounded-lg border border-border print:border-gray-300">
      <div className={`flex items-center justify-between rounded-t-lg px-5 py-3 ${accentMap[accent]}`}>
        <div className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
          {count} curso{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-5 print:p-4">{children}</div>
    </div>
  );
}

interface ConsolidatedItem {
  course: Course;
  judgments: Judgment[];
  counts: { MANTIDO: number; ATUALIZADO: number; INATIVACAO: number };
  dominant: "MANTIDO" | "ATUALIZADO" | "INATIVACAO";
}

function CoursesList({
  items,
  renderExtra,
}: {
  items: ConsolidatedItem[];
  renderExtra: (item: ConsolidatedItem) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm italic text-muted-foreground">
        Nenhum curso nesta categoria.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const priorities = item.judgments
          .map((j) => j.priority)
          .filter((p): p is NonNullable<typeof p> => !!p);
        return (
          <li
            key={item.course.id}
            className="rounded-md border border-border bg-card p-4 print:break-inside-avoid print:border-gray-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-muted-foreground">
                  {item.course.codigo}
                </div>
                <div className="font-semibold text-foreground">{item.course.solucao}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.course.publicoAlvo} · {item.course.modalidade}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {priorities.map((p, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[p]}`}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                <strong className="text-emerald-700">{item.counts.MANTIDO}</strong>{" "}
                {DECISION_LABELS.MANTIDO}
              </span>
              <span>
                <strong className="text-amber-700">{item.counts.ATUALIZADO}</strong>{" "}
                {DECISION_LABELS.ATUALIZADO}
              </span>
              <span>
                <strong className="text-rose-700">{item.counts.INATIVACAO}</strong>{" "}
                {DECISION_LABELS.INATIVACAO}
              </span>
              <span className="text-muted-foreground">
                · Regionais: {item.judgments.map((j) => j.region).join(", ")}
              </span>
            </div>

            {renderExtra(item)}
          </li>
        );
      })}
    </ul>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 14mm 12mm; }
        body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-break { break-after: page; page-break-after: always; }
        .print-header { margin-bottom: 12px; }
        nav, header.print\\:hidden { display: none !important; }
      }
    `}</style>
  );
}
