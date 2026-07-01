import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Printer,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle2,
  ClipboardList,
  Users,
  Layers,
  Gauge,
} from "lucide-react";

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
  DECISION_LABELS as REGIONAL_DECISION_LABELS,
  PRIORITY_STYLES,
  type Judgment,
} from "@/lib/judgments";
import {
  useProcessesList,
  effectiveStatus,
  type EvaluationProcess,
} from "@/lib/processes";
import {
  useFinalOpinionsList,
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
    <div className="rounded border border-gray-300 bg-white px-2 py-1.5">
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
    icon: React.ReactNode;
    label: string;
    value: string;
    hint: string;
    tone: string;
  }[] = [
    {
      icon: <Layers className="h-5 w-5" />,
      label: "Cursos no processo",
      value: String(kpis.totalCourses),
      hint: `${kpis.regionalRegions} região(ões) participante(s)`,
      tone: "bg-primary/5 text-primary border-primary/20",
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "Cobertura regional",
      value: `${kpis.regionalCoveragePct}%`,
      hint: `${kpis.regionalTotalJudgments} julgamentos das regionais`,
      tone: "bg-sky-50 text-sky-800 border-sky-200",
    },
    {
      icon: <Gauge className="h-5 w-5" />,
      label: "Completude do parecer",
      value: `${kpis.gnCompletionPct}%`,
      hint: `${kpis.gnDecidedCount}/${kpis.totalCourses} cursos decididos pela GN`,
      tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: "Decisões finais",
      value: `${kpis.gnCounts.MANTER} · ${kpis.gnCounts.ATUALIZAR} · ${kpis.gnCounts.INATIVAR}`,
      hint: `Manter · Atualizar · Inativar`,
      tone: "bg-amber-50 text-amber-800 border-amber-200",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border p-4 shadow-sm ${c.tone}`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            {c.icon}
            {c.label}
          </div>
          <div className="mt-2 text-2xl font-bold">{c.value}</div>
          <div className="mt-1 text-xs opacity-80">{c.hint}</div>
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
  const allCourses = useCoursesList();
  const allJudgments = useJudgmentsList();
  const allOpinions = useFinalOpinionsList();

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
    icon: React.ReactNode;
    accent: "emerald" | "amber" | "rose";
    items: ConsolidatedItem[];
    calloutNode?: React.ReactNode;
  }> = [
    {
      decision: "MANTER",
      icon: <CheckCircle2 className="h-5 w-5" />,
      accent: "emerald",
      items: decided.filter((i) => i.gnDecision === "MANTER"),
      calloutNode: (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 print:border-emerald-400">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
          <div className="text-sm text-emerald-900">
            <strong>Decisão da Gerência Nacional:</strong> estes cursos devem
            ser <strong>mantidos</strong> no portfólio conforme parecer final.
          </div>
        </div>
      ),
    },
    {
      decision: "ATUALIZAR",
      icon: <RefreshCw className="h-5 w-5" />,
      accent: "amber",
      items: decided.filter((i) => i.gnDecision === "ATUALIZAR"),
      calloutNode: (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 print:border-amber-400">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <strong>Aviso de Priorização:</strong> estes cursos devem ser
            <strong> priorizados para atualização</strong> — desenvolvimento e
            confecção de materiais didáticos conforme apontamentos das
            regionais.
          </div>
        </div>
      ),
    },
    {
      decision: "INATIVAR",
      icon: <XCircle className="h-5 w-5" />,
      accent: "rose",
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
                icon={g.icon}
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
                icon={<ClipboardList className="h-5 w-5" />}
                title="Cursos aguardando parecer da Gerência Nacional"
                count={pending.length}
                accent="slate"
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
  accent: "emerald" | "amber" | "rose" | "slate";
  children: React.ReactNode;
}) {
  const accentMap = {
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
    slate: "bg-slate-600 text-white",
  };
  return (
    <div className="rounded-lg border border-border print:border-gray-300">
      <div
        className={`flex items-center justify-between rounded-t-lg px-5 py-3 ${accentMap[accent]}`}
      >
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
          className="rounded-md border border-border bg-card p-4 print:break-inside-avoid print:border-gray-300"
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

          <div className="mt-3 rounded-md bg-muted/40 p-3 print:bg-gray-50">
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
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>
                    <strong className="text-emerald-700">
                      {item.regionalCounts.MANTIDO}
                    </strong>{" "}
                    {REGIONAL_DECISION_LABELS.MANTIDO}
                  </span>
                  <span>
                    <strong className="text-amber-700">
                      {item.regionalCounts.ATUALIZADO}
                    </strong>{" "}
                    {REGIONAL_DECISION_LABELS.ATUALIZADO}
                  </span>
                  <span>
                    <strong className="text-rose-700">
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
                      <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {j.region}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${regionalDecisionStyle(j.decision)}`}
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
            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 print:border-gray-400 print:bg-gray-50">
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

function gnBadgeStyle(d: FinalDecision): string {
  switch (d) {
    case "MANTER":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "ATUALIZAR":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "INATIVAR":
      return "border-rose-300 bg-rose-50 text-rose-800";
  }
}
function gnPriorityStyle(p: FinalPriority): string {
  switch (p) {
    case "ALTA":
      return "border-rose-300 bg-rose-50 text-rose-800";
    case "MEDIA":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "BAIXA":
      return "border-sky-300 bg-sky-50 text-sky-800";
  }
}
function regionalDecisionStyle(d: Judgment["decision"]): string {
  switch (d) {
    case "MANTIDO":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "ATUALIZADO":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "INATIVACAO":
      return "bg-rose-50 text-rose-800 border border-rose-200";
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
