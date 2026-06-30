import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  GraduationCap,
  LogOut,
  MapPin,
  UserCog,
  ClipboardCheck,
  Gavel,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthProvider, REGIONS, useAuth, type Region } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { PrvdFooter } from "@/components/PrvdFooter";
import { supabase } from "@/integrations/supabase/client";
import { useCoursesList, computeMaterialReadiness, type Course } from "@/lib/courses";
import {
  effectiveStatus,
  useProcessesList,
  type EvaluationProcess,
} from "@/lib/processes";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Painel — Portfólio de Cursos SEBRAE" }],
  }),
  component: () => (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  ),
});

type DecisionKey = "MANTIDO" | "ATUALIZADO" | "INATIVAÇÃO";

const DECISION_LABEL: Record<DecisionKey, string> = {
  MANTIDO: "Mantido",
  ATUALIZADO: "Mantido com atualizações",
  "INATIVAÇÃO": "Inativação",
};
const DECISION_COLOR: Record<DecisionKey, string> = {
  MANTIDO: "#10b981",
  ATUALIZADO: "#f59e0b",
  "INATIVAÇÃO": "#ef4444",
};

interface JudgmentRow {
  id: string;
  course_id: string;
  user_id: string;
  region: string;
  decision: string;
}

function Dashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const courses = useCoursesList();

  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [judgments, setJudgments] = useState<JudgmentRow[]>([]);
  const [loadingJudgments, setLoadingJudgments] = useState(true);
  const [activeRegions, setActiveRegions] = useState<number>(0);
  const processes = useProcessesList();
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  // Auto-select the most recent active process on first load
  useEffect(() => {
    if (selectedProcessId) return;
    if (!user) return;
    const active = processes
      .filter((p) => effectiveStatus(p) === "ATIVO")
      .filter((p) =>
        user.role === "admin"
          ? p.scope === "NACIONAL" || p.scope === "AMBOS"
          : p.scope === "REGIONAL" || p.scope === "AMBOS",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (active.length) setSelectedProcessId(active[0].id);
  }, [processes, user, selectedProcessId]);

  const selectedProcess: EvaluationProcess | null = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );

  // Scope courses to selected process when applicable
  const scopedCourses: Course[] = useMemo(() => {
    if (!selectedProcess) return courses;
    const ids = new Set(selectedProcess.courseIds);
    return courses.filter((c) => ids.has(c.id));
  }, [courses, selectedProcess]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("region, email")
        .neq("email", "jusmar.chaves@providence.solutions");
      if (cancelled) return;
      if (error) {
        console.error("[dashboard] regions fetch error:", error);
        setActiveRegions(0);
        return;
      }
      const set = new Set(
        (data ?? [])
          .map((p: { region: string | null }) => p.region)
          .filter((r): r is string => !!r && (REGIONS as readonly string[]).includes(r)),
      );
      setActiveRegions(set.size);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Real-time fetch of judgments scoped by role
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingJudgments(true);

    async function load() {
      let query = supabase
        .from("judgments")
        .select("id, course_id, user_id, region, decision");

      if (user!.role === "gestor") {
        // Gestor: only own judgments
        query = query.eq("user_id", user!.id);
      } else if (regionFilter !== "all") {
        // Admin with region filter
        query = query.eq("region", regionFilter);
      }

      if (selectedProcessId) {
        query = query.eq("process_id", selectedProcessId);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("[dashboard] judgments fetch error:", error);
        setJudgments([]);
      } else {
        setJudgments((data ?? []) as JudgmentRow[]);
      }
      setLoadingJudgments(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, regionFilter, selectedProcessId]);

  // Material readiness aggregates (scoped to selected process when applicable)
  const readiness = useMemo(() => {
    const buckets = { pronto: 0, medio: 0, alto: 0 };
    let sumPct = 0;
    for (const c of scopedCourses) {
      const r = computeMaterialReadiness(c);
      buckets[r.level] += 1;
      sumPct += r.pct;
    }
    const avg = scopedCourses.length ? Math.round(sumPct / scopedCourses.length) : 0;
    return { ...buckets, avg, total: scopedCourses.length };
  }, [scopedCourses]);

  // Decision aggregates for pie chart
  const decisionData = useMemo(() => {
    const counts: Record<DecisionKey, number> = {
      MANTIDO: 0,
      ATUALIZADO: 0,
      "INATIVAÇÃO": 0,
    };
    for (const j of judgments) {
      const key = j.decision as DecisionKey;
      if (key in counts) counts[key] += 1;
    }
    return (Object.keys(counts) as DecisionKey[]).map((k) => ({
      key: k,
      name: DECISION_LABEL[k],
      value: counts[k],
      color: DECISION_COLOR[k],
    }));
  }, [judgments]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const judgedCourseIds = new Set(judgments.map((j) => j.course_id));
  const completude = scopedCourses.length
    ? Math.round((judgedCourseIds.size / scopedCourses.length) * 100)
    : 0;

  const adminStats = [
    { label: "Cursos para avaliar", value: String(scopedCourses.length), icon: BookOpen },
    {
      label: "Avaliações cadastradas",
      value: String(judgments.length),
      icon: ClipboardCheck,
    },
    {
      label: "Prontidão média de materiais",
      value: `${readiness.avg}%`,
      icon: GraduationCap,
    },
    {
      label: "Regiões ativas",
      value: `${activeRegions} / ${REGIONS.length} (${
        REGIONS.length ? Math.round((activeRegions / REGIONS.length) * 100) : 0
      }%)`,
      icon: MapPin,
    },
  ];

  const gestorStats = [
    { label: "Cursos para avaliar", value: String(scopedCourses.length), icon: BookOpen },
    { label: "Suas avaliações", value: String(judgments.length), icon: Gavel },
    { label: "% de completude", value: `${completude}%`, icon: ClipboardCheck },
    {
      label: "Cursos pendentes de avaliação",
      value: String(Math.max(scopedCourses.length - judgedCourseIds.size, 0)),
      icon: GraduationCap,
    },
  ];

  const stats = isAdmin ? adminStats : gestorStats;
  const hasJudgments = judgments.length > 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <header
        className="border-b border-white/10"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <SebraeLogo variant="onDark" height={36} />
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-white sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-white/70">
                {isAdmin
                  ? user.email === "jusmar.chaves@providence.solutions"
                    ? "Super Administrador"
                    : "Gestor Nacional"
                  : `Gestor Regional — ${user.region}`}
              </div>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/users" })}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <UserCog className="mr-2 h-4 w-4" />
                Usuários
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/courses" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              {isAdmin ? "Cursos" : "Avaliações"}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/processes" })}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Gavel className="mr-2 h-4 w-4" />
                Processos
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/reports" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatórios
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
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {isAdmin ? "Acesso total" : `Região ${user.region}`}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Bem-vindo(a), {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Avaliação do portfólio de Cursos da Educação Empreendedora — visão em tempo real.
          </p>
        </div>

        {(() => {
          const availableProcesses = processes
            .filter((p) =>
              isAdmin
                ? p.scope === "NACIONAL" || p.scope === "AMBOS"
                : p.scope === "REGIONAL" || p.scope === "AMBOS",
            )
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Processo avaliativo
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Os indicadores abaixo refletem o processo selecionado.
                  </div>
                </div>
              </div>
              <Select
                value={selectedProcessId ?? (isAdmin ? "all" : "")}
                onValueChange={(v) => setSelectedProcessId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Selecione um processo" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="all">Todos os processos (visão geral)</SelectItem>
                  )}
                  {availableProcesses.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {effectiveStatus(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold text-foreground">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pie chart: decisions */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isAdmin
                    ? "Distribuição das avaliações"
                    : "Suas decisões registradas"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAdmin
                    ? "Agrupamento de avaliações e decisão das regionais."
                    : "Resumo dos julgamentos que você registrou."}
                </p>
              </div>
              {isAdmin && (
                <Select
                  value={regionFilter}
                  onValueChange={(v) => setRegionFilter(v as Region | "all")}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue placeholder="Filtrar por região" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="mt-4 h-64">
              {loadingJudgments ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : !hasJudgments ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum julgamento{isAdmin && regionFilter !== "all"
                    ? ` para a região ${regionFilter}`
                    : ""}{" "}
                  ainda.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={decisionData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry) => `${entry.value}`}
                    >
                      {decisionData
                        .filter((d) => d.value > 0)
                        .map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Material readiness */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-foreground">
              Índice de Prontidão de Materiais
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Indicador do esforço para atualização e completude de materiais vinculados aos cursos
            </p>

            <div className="mt-5 space-y-3">
              <ReadinessRow
                label="Pronto / Baixo Esforço (≥ 76%)"
                count={readiness.pronto}
                total={readiness.total}
                color="bg-emerald-500"
              />
              <ReadinessRow
                label="Médio Esforço (41–75%)"
                count={readiness.medio}
                total={readiness.total}
                color="bg-amber-500"
              />
              <ReadinessRow
                label="Alto Esforço (≤ 40%)"
                count={readiness.alto}
                total={readiness.total}
                color="bg-rose-500"
              />
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Prontidão média do portfólio
              </div>
              <div className="mt-1 text-3xl font-bold text-foreground">
                {readiness.avg}%
              </div>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-foreground">
              Completude do seu julgamento
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cursos julgados ({judgedCourseIds.size}) ÷ total de cursos
              cadastrados ({courses.length}).
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${completude}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-semibold">
                {completude}%
              </span>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <PrvdFooter variant="onLight" />
        </div>
      </footer>
    </div>
  );
}

function ReadinessRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
