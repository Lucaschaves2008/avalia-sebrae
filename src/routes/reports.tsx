import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowLeft, FileText, Printer, AlertTriangle, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthProvider, useAuth, useUsersList } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { useCoursesList, type Course } from "@/lib/courses";
import {
  useJudgmentsList,
  DECISION_LABELS,
  PRIORITY_STYLES,
  type Judgment,
} from "@/lib/judgments";

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      const t = setTimeout(() => {
        if (!user) navigate({ to: "/login" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

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
            Gere relatórios consolidados em layout SEBRAE — otimizados para
            impressão ou exportação em PDF (via janela de impressão do
            navegador).
          </p>
        </div>

        <div className="space-y-10 print:space-y-0">
          <ManagersPerformanceReport />
          <div className="print-break" />
          <GlobalEvaluationReport />
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

// ---------- Relatório 1: Performance dos Gestores ----------

function ManagersPerformanceReport() {
  const users = useUsersList();
  const courses = useCoursesList();
  const judgments = useJudgmentsList();

  const rows = useMemo(() => {
    const gestores = users.filter((u) => u.role === "gestor");
    const totalCourses = courses.length;
    return gestores.map((g) => {
      const userJudgments = judgments.filter((j) => j.userId === g.id);
      const julgados = userJudgments.length;
      const pendentes = Math.max(totalCourses - julgados, 0);
      const mantidos = userJudgments.filter((j) => j.decision === "MANTIDO").length;
      const atualizados = userJudgments.filter((j) => j.decision === "ATUALIZADO").length;
      const inativacoes = userJudgments.filter((j) => j.decision === "INATIVACAO").length;
      return {
        user: g,
        julgados,
        pendentes,
        mantidos,
        atualizados,
        inativacoes,
        progresso: totalCourses ? Math.round((julgados / totalCourses) * 100) : 0,
      };
    });
  }, [users, courses, judgments]);

  const totalCourses = courses.length;

  return (
    <ReportCard
      title="Relatório de Performance dos Gestores"
      description="Visualize o engajamento de cada Gestor Regional no processo de julgamento dos cursos do portfólio."
      printTitle="Performance dos Gestores Regionais"
      printSubtitle={`Total de cursos no portfólio: ${totalCourses}`}
    >
      <div className="overflow-hidden rounded-lg border border-border print:border-gray-300">
        <table className="w-full text-sm">
          <thead className="bg-primary text-white print:bg-[#005CA9]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Gestor</th>
              <th className="px-4 py-3 text-left font-semibold">Regional</th>
              <th className="px-4 py-3 text-center font-semibold">Julgados</th>
              <th className="px-4 py-3 text-center font-semibold">Pendentes</th>
              <th className="px-4 py-3 text-center font-semibold">Mantidos</th>
              <th className="px-4 py-3 text-center font-semibold">Atualizar</th>
              <th className="px-4 py-3 text-center font-semibold">Inativar</th>
              <th className="px-4 py-3 text-center font-semibold">Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum gestor cadastrado.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.user.id} className="hover:bg-muted/40 print:hover:bg-transparent">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.user.name}</div>
                  <div className="text-xs text-muted-foreground">{r.user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {r.user.region}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                  {r.julgados}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-amber-700">
                  {r.pendentes}
                </td>
                <td className="px-4 py-3 text-center">{r.mantidos}</td>
                <td className="px-4 py-3 text-center">{r.atualizados}</td>
                <td className="px-4 py-3 text-center">{r.inativacoes}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted print:bg-gray-200">
                      <div
                        className="h-full bg-primary print:bg-[#005CA9]"
                        style={{ width: `${r.progresso}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold">
                      {r.progresso}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

// ---------- Relatório 2: Avaliação Global ----------

function GlobalEvaluationReport() {
  const courses = useCoursesList();
  const judgments = useJudgmentsList();

  const sections = useMemo(() => {
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
        // Decisão dominante (maior contagem; empate -> ordem MANTIDO > ATUALIZADO > INATIVACAO)
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
  }, [courses, judgments]);

  const total =
    sections.mantidos.length + sections.atualizados.length + sections.inativacoes.length;

  return (
    <ReportCard
      title="Relatório de Avaliação Global e Priorização"
      description="Consolidação dos julgamentos das regionais, agrupando os cursos por decisão dominante."
      printTitle="Avaliação Global e Priorização do Portfólio"
      printSubtitle={`${total} curso(s) julgado(s) pelas regionais`}
    >
      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Ainda não há julgamentos registrados pelas regionais.
        </div>
      ) : (
        <div className="space-y-8">
          {/* MANTIDOS */}
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
            <CoursesList
              items={sections.mantidos}
              renderExtra={() => null}
            />
          </SectionBlock>

          <div className="print-break" />

          {/* ATUALIZADOS */}
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

          {/* INATIVACOES */}
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
        const priorities = item.judgments.map((j) => j.priority);
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
                  <span
                    key={i}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[p]}`}
                  >
                    {p}
                  </span>
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

// ---------- Print styles ----------

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
