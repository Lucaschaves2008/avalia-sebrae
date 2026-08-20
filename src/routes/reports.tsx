import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/ErrorState";
import { AuthPending } from "@/components/AuthPending";
import { useEffect, useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";



import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";


import { useCoursesListWhen, type Course } from "@/lib/courses";
import {
  useJudgmentsListWhen,
  DECISION_LABELS as REGIONAL_DECISION_LABELS,
  PRIORITY_STYLES,
  type Judgment,
} from "@/lib/judgments";
import {
  useProcessesListWhen,
  effectiveStatus,
  type EvaluationProcess,
} from "@/lib/processes";
import {
  useFinalOpinionsListWhen,
  findOpinionByProcess,
  DECISION_LABELS as GN_DECISION_LABELS,
  PRIORITY_LABELS as GN_PRIORITY_LABELS,
  STATUS_LABELS as OPINION_STATUS_LABELS,
  type FinalDecision,
  type FinalPriority,
  type FinalOpinionItem,
} from "@/lib/final-opinions";
import sebraeLogoAsset from "@/assets/sebrae-logo.svg.asset.json";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Relatórios — Portfólio SEBRAE" }],
  }),
  component: ReportsPage,
  errorComponent: ({ error, reset }) => (
    <ErrorState error={error} reset={reset} boundary="route:reports" />
  ),
});

function ReportsPage() {
  const { user, loading, authError } = useAuth();
  const navigate = useNavigate();
  const canFetchData = !loading && !!user;
  const processes = useProcessesListWhen(canFetchData);
  const [processId, setProcessId] = useState<string>("");

  useEffect(() => {
    // Falha de rede não é logout: sem authError na condição, uma
    // instabilidade do proxy expulsaria o usuário para o login.
    if (!loading && !user && !authError) navigate({ to: "/login" });
  }, [loading, user, authError, navigate]);

  useEffect(() => {
    if (processId || processes.length === 0) return;
    const active = processes.find((p) => effectiveStatus(p) === "ATIVO");
    setProcessId((active ?? processes[0]).id);
  }, [processes, processId]);

  if (loading || !user) {
    return <AuthPending authError={authError} />;
  }

  const selectedProcess = processes.find((p) => p.id === processId);

  return (
    <AppShell
      pageKey="reports"
      eyebrow={
        <span className="inline-flex items-center gap-2.5 pl-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary [box-shadow:inset_2px_0_0_0_var(--color-primary)]">
          <FileText className="h-3 w-3" />
          Central de Relatórios
        </span>
      }
      title="Relatórios"
      subtitle="Relatório otimizado para impressão ou exportação em PDF (via janela de impressão do navegador)."
    >
      <div data-tour="reports-title" />
      <div className="print:px-0 print:py-0">



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

        <div className="space-y-10 print:space-y-0">
          {selectedProcess ? (
            <GlobalEvaluationReport process={selectedProcess} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground print:hidden">
              Selecione um processo avaliativo para visualizar o relatório.
            </div>
          )}
        </div>
      </div>

      <PrintStyles />
    </AppShell>

  );
}

// ---------- Print header with SEBRAE logo + synthetic KPIs ----------

interface Kpis {
  totalCourses: number;
  regionalCoveragePct: number;
  regionalTotalJudgments: number;
  gnDecidedCount: number;
  gnCompletionPct: number;
  gnCounts: Record<FinalDecision, number>;
  gnPriorities: Record<FinalPriority, number>;
  opinionStatusLabel: string;
  regionalRegions: number;
}

function PrintHeader({
  process,
  kpis,
}: {
  process: EvaluationProcess;
  kpis: Kpis;
}) {
  return (
    <div className="hidden print:block print-header">
      <div className="flex items-start justify-between gap-4 border-b-4 border-[#005CA9] pb-3">
        <div className="flex items-center gap-3">
          <img
            src={sebraeLogoAsset.url}
            alt="SEBRAE"
            style={{ height: 44, width: "auto" }}
          />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#005CA9]">
              SEBRAE — Portfólio de Cursos
            </div>
            <div className="text-lg font-bold text-[#005CA9]">
              Avaliação Global e Priorização
            </div>
            <div className="text-xs text-gray-700">
              Processo: <strong>{process.name}</strong> · Período{" "}
              {process.startDate} a {process.endDate} ·{" "}
              {OPINION_STATUS_LABELS[
                (kpis.opinionStatusLabel as keyof typeof OPINION_STATUS_LABELS) ??
                  "NAO_INICIADO"
              ] ?? kpis.opinionStatusLabel}
            </div>
          </div>
        </div>
        <div className="text-right text-[10px] text-gray-500">
          Emitido em
          <div className="text-gray-700">
            {new Date().toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Synthetic KPI strip (dashboard-like) */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-[10px]">
        <KpiCell
          label="Cursos no processo"
          value={String(kpis.totalCourses)}
          hint={`${kpis.regionalRegions} região(ões) participante(s)`}
        />
        <KpiCell
          label="Avaliação regional"
          value={`${kpis.regionalCoveragePct}%`}
          hint={`${kpis.regionalTotalJudgments} julgamento(s) das regionais`}
        />
        <KpiCell
          label="Parecer da GN"
          value={`${kpis.gnCompletionPct}%`}
          hint={`${kpis.gnDecidedCount}/${kpis.totalCourses} cursos decididos`}
        />
        <KpiCell
          label="Decisões finais"
          value={`${kpis.gnCounts.MANTER} M · ${kpis.gnCounts.ATUALIZAR} A · ${kpis.gnCounts.INATIVAR} I`}
          hint={`Prioridades — Alta ${kpis.gnPriorities.ALTA} · Média ${kpis.gnPriorities.MEDIA} · Baixa ${kpis.gnPriorities.BAIXA}`}
        />
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white px-2 py-1.5">
      <div className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm font-bold text-[#005CA9]">{value}</div>
      {hint && <div className="text-[9px] text-gray-600">{hint}</div>}
    </div>
  );
}

// ---------- Screen KPI summary (dashboard-like, also prints) ----------

function ScreenKpiSummary({ kpis }: { kpis: Kpis }) {
  const cards: {
    label: string;
    value: string;
    hint: string;
    ink?: string;
  }[] = [
    {
      label: "Cursos no processo",
      value: String(kpis.totalCourses),
      hint: `${kpis.regionalRegions} região(ões) participante(s)`,
    },
    {
      label: "Cobertura regional",
      value: `${kpis.regionalCoveragePct}%`,
      hint: `${kpis.regionalTotalJudgments} julgamentos das regionais`,
    },
    {
      label: "Completude do parecer",
      value: `${kpis.gnCompletionPct}%`,
      hint: `${kpis.gnDecidedCount}/${kpis.totalCourses} cursos decididos pela GN`,
      ink: "var(--effort-ready-ink)",
    },
    {
      label: "Decisões finais",
      value: `${kpis.gnCounts.MANTER} · ${kpis.gnCounts.ATUALIZAR} · ${kpis.gnCounts.INATIVAR}`,
      hint: `Manter · Atualizar · Inativar`,
      ink: "var(--effort-mid-ink)",
    },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      {cards.map((c) => (
        <div key={c.label} className="bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-px rounded-full"
              style={{ background: c.ink ?? "var(--primary)" }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {c.label}
            </span>
          </div>
          <div
            className="mt-2 text-2xl font-semibold tabular-nums tracking-tight"
            style={{ color: c.ink ?? "var(--foreground)" }}
          >
            {c.value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}


function ReportCard({
  title,
  description,
  children,
  printHeader,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  printHeader: React.ReactNode;
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
        {printHeader}
        {children}
      </div>
    </section>
  );
}

// ---------- Relatório: Avaliação Global ----------

interface ConsolidatedItem {
  course: Course;
  judgments: Judgment[];
  regionalCounts: { MANTIDO: number; ATUALIZADO: number; INATIVACAO: number };
  gnDecision: FinalDecision | null;
  gnPriority: FinalPriority | null;
  gnObservation: string;
}

function GlobalEvaluationReport({ process }: { process: EvaluationProcess }) {
  const allCourses = useCoursesListWhen(true);
  const allJudgments = useJudgmentsListWhen(true);
  const allOpinions = useFinalOpinionsListWhen(true);

  const { items, kpis, opinionStatus } = useMemo(() => {
    const courseIds = new Set(process.courseIds);
    const courses = allCourses.filter((c) => courseIds.has(c.id));
    const judgments = allJudgments.filter((j) => j.processId === process.id);

    const byCourse = new Map<string, Judgment[]>();
    for (const j of judgments) {
      const arr = byCourse.get(j.courseId) ?? [];
      arr.push(j);
      byCourse.set(j.courseId, arr);
    }

    const opinion = findOpinionByProcess(allOpinions, process.id);
    const opinionByCourse = new Map<string, FinalOpinionItem>();
    for (const it of opinion?.items ?? []) opinionByCourse.set(it.courseId, it);

    const items: ConsolidatedItem[] = courses.map((course) => {
      const js = byCourse.get(course.id) ?? [];
      const op = opinionByCourse.get(course.id);
      return {
        course,
        judgments: js,
        regionalCounts: {
          MANTIDO: js.filter((j) => j.decision === "MANTIDO").length,
          ATUALIZADO: js.filter((j) => j.decision === "ATUALIZADO").length,
          INATIVACAO: js.filter((j) => j.decision === "INATIVACAO").length,
        },
        gnDecision: op?.decision ?? null,
        gnPriority: op?.priority ?? null,
        gnObservation: op?.observation ?? "",
      };
    });

    const totalCourses = courses.length;
    const coursesWithRegional = items.filter(
      (i) => i.judgments.length > 0,
    ).length;
    const regionalCoveragePct =
      totalCourses > 0
        ? Math.round((coursesWithRegional / totalCourses) * 100)
        : 0;
    const gnDecidedCount = items.filter((i) => i.gnDecision !== null).length;
    const gnCompletionPct =
      totalCourses > 0 ? Math.round((gnDecidedCount / totalCourses) * 100) : 0;
    const gnCounts: Record<FinalDecision, number> = {
      MANTER: items.filter((i) => i.gnDecision === "MANTER").length,
      ATUALIZAR: items.filter((i) => i.gnDecision === "ATUALIZAR").length,
      INATIVAR: items.filter((i) => i.gnDecision === "INATIVAR").length,
    };
    const gnPriorities: Record<FinalPriority, number> = {
      ALTA: items.filter((i) => i.gnPriority === "ALTA").length,
      MEDIA: items.filter((i) => i.gnPriority === "MEDIA").length,
      BAIXA: items.filter((i) => i.gnPriority === "BAIXA").length,
    };
    const regionalRegions = new Set(judgments.map((j) => j.region)).size;

    const kpis: Kpis = {
      totalCourses,
      regionalCoveragePct,
      regionalTotalJudgments: judgments.length,
      gnDecidedCount,
      gnCompletionPct,
      gnCounts,
      gnPriorities,
      opinionStatusLabel: opinion?.status ?? "NAO_INICIADO",
      regionalRegions,
    };

    return { items, kpis, opinionStatus: opinion?.status ?? "NAO_INICIADO" };
  }, [allCourses, allJudgments, allOpinions, process]);

  const decided = items.filter((i) => i.gnDecision !== null);
  const pending = items.filter((i) => i.gnDecision === null);

  const groups: Array<{
    decision: FinalDecision;
    accent: DecisionTone;
    items: ConsolidatedItem[];
    calloutNode?: React.ReactNode;
  }> = [
    {
      decision: "MANTER",
      accent: "ready",
      items: decided.filter((i) => i.gnDecision === "MANTER"),
      calloutNode: (
        <Callout tone="ready">
          <strong>Decisão da Gerência Nacional:</strong> estes cursos devem ser{" "}
          <strong>mantidos</strong> no portfólio conforme parecer final.
        </Callout>
      ),
    },
    {
      decision: "ATUALIZAR",
      accent: "mid",
      items: decided.filter((i) => i.gnDecision === "ATUALIZAR"),
      calloutNode: (
        <Callout tone="mid">
          <strong>Aviso de Priorização:</strong> estes cursos devem ser
          <strong> priorizados para atualização</strong> — desenvolvimento e
          confecção de materiais didáticos conforme apontamentos das regionais.
        </Callout>
      ),
    },
    {
      decision: "INATIVAR",
      accent: "high",
      items: decided.filter((i) => i.gnDecision === "INATIVAR"),
    },
  ];


  return (
    <ReportCard
      title="Relatório de Avaliação Global e Priorização"
      description={`Parecer final da Gerência Nacional para o processo "${process.name}", consolidado com as avaliações das regionais.`}
      printHeader={<PrintHeader process={process} kpis={kpis} />}
    >
      <div className="mb-6 space-y-4">
        <ScreenKpiSummary kpis={kpis} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Este processo não possui cursos vinculados.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g, idx) => (
            <div key={g.decision}>
              <SectionBlock
                title={sectionTitle(g.decision)}
                count={g.items.length}
                accent={g.accent}
              >
                {g.calloutNode}
                <CoursesList items={g.items} />
              </SectionBlock>
              {idx < groups.length - 1 && <div className="print-break" />}
            </div>
          ))}

          {pending.length > 0 && (
            <>
              <div className="print-break" />
              <SectionBlock
                title="Cursos aguardando parecer da Gerência Nacional"
                count={pending.length}
                accent="neutral"
              >

                <div className="mb-3 text-xs text-muted-foreground">
                  Parecer final:{" "}
                  <strong>{OPINION_STATUS_LABELS[opinionStatus]}</strong>. Os
                  cursos abaixo ainda não receberam decisão final da GN — as
                  avaliações regionais consolidadas são apresentadas como
                  subsídio.
                </div>
                <CoursesList items={pending} pending />
              </SectionBlock>
            </>
          )}
        </div>
      )}
    </ReportCard>
  );
}

function sectionTitle(d: FinalDecision): string {
  switch (d) {
    case "MANTER":
      return "Cursos com Parecer Final: Manter";
    case "ATUALIZAR":
      return "Cursos com Parecer Final: Atualizar";
    case "INATIVAR":
      return "Cursos com Parecer Final: Inativar";
  }
}

type DecisionTone = "ready" | "mid" | "high" | "neutral";

function toneVars(tone: DecisionTone) {
  if (tone === "neutral") {
    return {
      base: "var(--muted-foreground)",
      ink: "var(--foreground)",
      wash: "var(--muted)",
    };
  }
  return {
    base: `var(--effort-${tone})`,
    ink: `var(--effort-${tone}-ink)`,
    wash: `var(--effort-${tone}-wash)`,
  };
}

/** Marca geométrica autoral (sem ícone genérico de círculo). */
function DecisionMark({ tone }: { tone: DecisionTone }) {
  const { base, ink } = toneVars(tone);
  return (
    <span
      aria-hidden
      className="grid h-4 w-4 shrink-0 place-items-center"
      style={{ border: `1.5px solid ${ink}` }}
    >
      {tone === "ready" && (
        <span className="h-1.5 w-1.5" style={{ background: base }} />
      )}
      {tone === "mid" && (
        <span className="h-[1.5px] w-2.5" style={{ background: base }} />
      )}
      {tone === "high" && (
        <span
          className="h-[1.5px] w-3 rotate-45"
          style={{ background: base }}
        />
      )}
      {tone === "neutral" && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: base }}
        />
      )}
    </span>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: DecisionTone;
  children: React.ReactNode;
}) {
  const { ink, wash } = toneVars(tone);
  return (
    <div
      className="mb-4 rounded-lg border-l-2 px-4 py-3 text-sm leading-relaxed"
      style={{ borderColor: ink, background: wash, color: ink }}
    >
      {children}
    </div>
  );
}

function SectionBlock({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: DecisionTone;
  children: React.ReactNode;
}) {
  const { ink, wash } = toneVars(accent);
  return (
    <div className="overflow-hidden rounded-xl border border-border print:border-gray-300">
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-t-xl border-b border-border px-4 py-3 sm:px-5"
        style={{ background: wash, borderLeft: `3px solid ${ink}` }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs"
            style={{ color: ink }}
          >
            {title}
          </span>
        </div>
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] tabular-nums"
          style={{ color: ink }}
        >
          {String(count).padStart(2, "0")} curso{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="rounded-b-xl p-4 sm:p-5 print:p-4">{children}</div>
    </div>
  );
}


function CoursesList({
  items,
  pending = false,
}: {
  items: ConsolidatedItem[];
  pending?: boolean;
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
      {items.map((item) => (
        <li
          key={item.course.id}
          className="rounded-xl border border-border bg-card p-4 print:break-inside-avoid print:border-gray-300"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-muted-foreground">
                {item.course.codigo}
              </div>
              <div className="font-semibold text-foreground">
                {item.course.solucao}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.course.publicoAlvo} · {item.course.modalidade}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {!pending && item.gnDecision && (
                <Badge
                  variant="outline"
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${gnBadgeStyle(item.gnDecision)}`}
                >
                  GN: {GN_DECISION_LABELS[item.gnDecision]}
                </Badge>
              )}
              {item.gnPriority && (
                <Badge
                  variant="outline"
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${gnPriorityStyle(item.gnPriority)}`}
                >
                  Prioridade GN: {GN_PRIORITY_LABELS[item.gnPriority]}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-muted/40 p-3 print:bg-gray-50">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Avaliações consolidadas das regionais (
              {item.judgments.length} julgamento
              {item.judgments.length === 1 ? "" : "s"})
            </div>
            {item.judgments.length === 0 ? (
              <div className="text-xs italic text-muted-foreground">
                Nenhuma avaliação regional registrada.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    <strong className="tabular-nums text-[var(--effort-ready-ink)]">
                      {item.regionalCounts.MANTIDO}
                    </strong>{" "}
                    {REGIONAL_DECISION_LABELS.MANTIDO}
                  </span>
                  <span>
                    <strong className="tabular-nums text-[var(--effort-mid-ink)]">
                      {item.regionalCounts.ATUALIZADO}
                    </strong>{" "}
                    {REGIONAL_DECISION_LABELS.ATUALIZADO}
                  </span>
                  <span>
                    <strong className="tabular-nums text-[var(--effort-high-ink)]">
                      {item.regionalCounts.INATIVACAO}
                    </strong>{" "}
                    {REGIONAL_DECISION_LABELS.INATIVACAO}
                  </span>
                </div>

                <ul className="mt-2 space-y-1">
                  {item.judgments.map((j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-foreground"
                    >
                      <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {j.region}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${regionalDecisionStyle(j.decision)}`}
                      >
                        {REGIONAL_DECISION_LABELS[j.decision]}
                      </span>
                      {j.priority && (
                        <Badge
                          variant="outline"
                          className={`rounded-full border px-1.5 py-0 text-[9px] font-semibold ${PRIORITY_STYLES[j.priority]}`}
                        >
                          {j.priority}
                        </Badge>
                      )}
                      {j.decision === "ATUALIZADO" && j.updatesNeeded && (
                        <span className="text-muted-foreground">
                          — {j.updatesNeeded}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {!pending && item.gnObservation && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 print:border-gray-400 print:bg-gray-50">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Observação da Gerência Nacional
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap">
                {item.gnObservation}
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const TONE_CHIP: Record<Exclude<DecisionTone, "neutral">, string> = {
  ready:
    "border-[var(--effort-ready)]/45 bg-[var(--effort-ready-wash)] text-[var(--effort-ready-ink)]",
  mid: "border-[var(--effort-mid)]/45 bg-[var(--effort-mid-wash)] text-[var(--effort-mid-ink)]",
  high: "border-[var(--effort-high)]/45 bg-[var(--effort-high-wash)] text-[var(--effort-high-ink)]",
};

function gnBadgeStyle(d: FinalDecision): string {
  switch (d) {
    case "MANTER":
      return TONE_CHIP.ready;
    case "ATUALIZAR":
      return TONE_CHIP.mid;
    case "INATIVAR":
      return TONE_CHIP.high;
  }
}
function gnPriorityStyle(p: FinalPriority): string {
  switch (p) {
    case "ALTA":
      return TONE_CHIP.high;
    case "MEDIA":
      return TONE_CHIP.mid;
    case "BAIXA":
      return "border-primary/30 bg-primary/5 text-primary";
  }
}

function regionalDecisionStyle(d: Judgment["decision"]): string {
  switch (d) {
    case "MANTIDO":
      return `border ${TONE_CHIP.ready}`;
    case "ATUALIZADO":
      return `border ${TONE_CHIP.mid}`;
    case "INATIVACAO":
      return `border ${TONE_CHIP.high}`;
  }
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
