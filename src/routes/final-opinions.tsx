import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  LogOut,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider, SUPER_ADMIN_EMAIL, useAuth } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { HelpTourButton } from "@/components/HelpTourButton";
import { TourAutoStart } from "@/lib/tour/TourProvider";
import { useCoursesListWhen, type Course } from "@/lib/courses";
import {
  effectiveStatus,
  useProcessesListWhen,
  type EvaluationProcess,
} from "@/lib/processes";
import { useJudgmentsListWhen, type Judgment } from "@/lib/judgments";
import {
  DECISION_BTN_STYLES,
  DECISION_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  overrideOpinionStatus,
  saveOpinionItem,
  useFinalOpinionsListWhen,
  type FinalDecision,
  type FinalOpinion,
  type FinalOpinionItem,
  type FinalPriority,
  type OpinionStatus,
} from "@/lib/final-opinions";


export const Route = createFileRoute("/final-opinions")({
  head: () => ({ meta: [{ title: "Parecer Final — SEBRAE" }] }),
  component: () => (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <FinalOpinionsPage />
    </AuthProvider>
  ),
});

const REGIONAL_DECISIONS = ["MANTIDO", "ATUALIZADO", "INATIVACAO"] as const;
const REGIONAL_LABEL: Record<(typeof REGIONAL_DECISIONS)[number], string> = {
  MANTIDO: "Manter",
  ATUALIZADO: "Atualizar",
  INATIVACAO: "Inativar",
};
const REGIONAL_STYLE: Record<(typeof REGIONAL_DECISIONS)[number], string> = {
  MANTIDO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATUALIZADO: "bg-amber-100 text-amber-800 border-amber-200",
  INATIVACAO: "bg-rose-100 text-rose-800 border-rose-200",
};

function FinalOpinionsPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const canFetchData = !loading && !!user;
  const opinions = useFinalOpinionsListWhen(canFetchData);
  const processes = useProcessesListWhen(canFetchData);
  const courses = useCoursesListWhen(canFetchData);
  const judgments = useJudgmentsListWhen(canFetchData);

  const canManage = user?.role === "admin";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const [query, setQuery] = useState("");
  const [openProcessId, setOpenProcessId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  useEffect(() => {
    if (!loading && user && !canManage) navigate({ to: "/dashboard" });
  }, [loading, user, canManage, navigate]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return processes
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .map((p) => {
        const op = opinions.find((o) => o.processId === p.id);
        const total = op?.items.length ?? p.courseIds.length;
        const decided = op?.items.filter((i) => i.decision).length ?? 0;
        return { process: p, opinion: op, total, decided };
      });
  }, [opinions, processes, query]);

  const openProcess = openProcessId
    ? processes.find((p) => p.id === openProcessId)
    : null;
  const openOpinion = openProcessId
    ? opinions.find((o) => o.processId === openProcessId)
    : null;

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <AppShell
      pageKey="final-opinions"
      eyebrow={
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Gerência Nacional
        </span>
      }
      title="Parecer Final"
      subtitle="Selecione um processo avaliativo para emitir o parecer final por curso. Cada parecer é criado automaticamente junto ao processo."
    >
      <div data-tour="final-opinions-title" />


        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar processos..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Amplitude</TableHead>
                <TableHead>Status do processo</TableHead>
                <TableHead>Status do parecer</TableHead>
                <TableHead className="w-56">Progresso</TableHead>
                <TableHead className="w-24 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum processo cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ process: p, opinion, total, decided }) => {
                const pct = total ? Math.round((decided / total) * 100) : 0;
                const st: OpinionStatus = opinion?.status ?? "NAO_INICIADO";
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(`${p.startDate}T00:00:00`).toLocaleDateString("pt-BR")} —{" "}
                        {new Date(`${p.endDate}T00:00:00`).toLocaleDateString("pt-BR")}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{p.scope}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{effectiveStatus(p)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[st]}>
                        {STATUS_LABELS[st]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2" />
                        <span className="w-16 text-right text-xs text-muted-foreground">
                          {decided}/{total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setOpenProcessId(p.id)}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      

      <Dialog
        open={!!openProcessId}
        onOpenChange={(o) => !o && setOpenProcessId(null)}
      >
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Parecer Final — {openProcess?.name}
            </DialogTitle>
            <DialogDescription>
              Emita o parecer final de cada curso. As alterações são salvas
              automaticamente.
            </DialogDescription>
          </DialogHeader>

          {openProcess && openOpinion && (
            <OpinionEditor
              process={openProcess}
              opinion={openOpinion}
              courses={courses}
              judgments={judgments}
              userId={user.id}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          <DialogFooter className="border-t bg-card px-6 py-3">
            <Button variant="outline" onClick={() => setOpenProcessId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>

  );
}

// ============ Editor ============

function OpinionEditor({
  process,
  opinion,
  courses,
  judgments,
  userId,
  isSuperAdmin,
}: {
  process: EvaluationProcess;
  opinion: FinalOpinion;
  courses: Course[];
  judgments: Judgment[];
  userId: string;
  isSuperAdmin: boolean;
}) {
  const coursesById = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  const judgByCourse = useMemo(() => {
    const m = new Map<string, Judgment[]>();
    for (const j of judgments) {
      if (j.processId !== process.id) continue;
      const arr = m.get(j.courseId) ?? [];
      arr.push(j);
      m.set(j.courseId, arr);
    }
    return m;
  }, [judgments, process.id]);

  const total = opinion.items.length;
  const decided = opinion.items.filter((i) => i.decision).length;
  const pct = total ? Math.round((decided / total) * 100) : 0;

  const regionalCoverage = useMemo(() => {
    const total = opinion.items.length;
    const evaluated = opinion.items.filter(
      (i) => (judgByCourse.get(i.courseId)?.length ?? 0) > 0,
    ).length;
    return {
      total,
      evaluated,
      pct: total ? Math.round((evaluated / total) * 100) : 0,
    };
  }, [opinion.items, judgByCourse]);

  const locked = opinion.status === "FINALIZADO" && !isSuperAdmin;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Process meta */}
      <div className="mb-4 grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Período
          </div>
          <div className="text-sm font-medium">
            {new Date(`${process.startDate}T00:00:00`).toLocaleDateString("pt-BR")} —{" "}
            {new Date(`${process.endDate}T00:00:00`).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pareceres emitidos
          </div>
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground">
              {decided}/{total} ({pct}%)
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Avaliação regional (cobertura)
          </div>
          <div className="flex items-center gap-2">
            <Progress value={regionalCoverage.pct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground">
              {regionalCoverage.evaluated}/{regionalCoverage.total} ({regionalCoverage.pct}%)
            </span>
          </div>
        </div>
      </div>

      {locked ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Este parecer está <strong>finalizado</strong> e não permite alterações.
        </div>
      ) : (
        <FinalizeOpinionBar
          opinion={opinion}
          decided={decided}
          total={total}
        />
      )}

      {isSuperAdmin && (
        <SuperAdminOverride opinion={opinion} />
      )}


      <div className="space-y-3">
        {opinion.items.map((item) => {
          const course = coursesById.get(item.courseId);
          const regionalJudgments = judgByCourse.get(item.courseId) ?? [];
          return (
            <CourseOpinionRow
              key={item.id}
              item={item}
              course={course}
              regionalJudgments={regionalJudgments}
              userId={userId}
              disabled={locked}
            />
          );
        })}
      </div>
    </div>
  );
}

function FinalizeOpinionBar({
  opinion,
  decided,
  total,
}: {
  opinion: FinalOpinion;
  decided: number;
  total: number;
}) {
  const [saving, setSaving] = useState(false);
  const allDecided = total > 0 && decided === total;
  async function finalize() {
    if (!allDecided) return;
    if (!confirm("Ao finalizar, o parecer será encerrado e o processo avaliativo será concluído. Deseja continuar?")) return;
    setSaving(true);
    try {
      await overrideOpinionStatus(opinion.id, "FINALIZADO");
      toast.success("Parecer finalizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao finalizar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        {allDecided
          ? "Todos os pareceres foram emitidos. Você pode finalizar quando desejar."
          : `Emita todos os pareceres (${decided}/${total}) para habilitar a finalização.`}
      </div>
      <Button size="sm" onClick={finalize} disabled={!allDecided || saving}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {saving ? "Finalizando..." : "Finalizar parecer"}
      </Button>
    </div>
  );
}

function SuperAdminOverride({ opinion }: { opinion: FinalOpinion }) {

  const [saving, setSaving] = useState(false);
  async function change(status: OpinionStatus) {
    setSaving(true);
    try {
      await overrideOpinionStatus(opinion.id, status);
      toast.success("Status atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <ShieldCheck className="h-4 w-4" />
      <span>Super administrador — alterar status:</span>
      <Select
        value={opinion.status}
        onValueChange={(v) => change(v as OpinionStatus)}
        disabled={saving}
      >
        <SelectTrigger className="h-7 w-40 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NAO_INICIADO">Não iniciado</SelectItem>
          <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
          <SelectItem value="FINALIZADO">Finalizado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CourseOpinionRow({
  item,
  course,
  regionalJudgments,
  userId,
  disabled,
}: {
  item: FinalOpinionItem;
  course: Course | undefined;
  regionalJudgments: Judgment[];
  userId: string;
  disabled: boolean;
}) {
  const [decision, setDecision] = useState<FinalDecision | null>(item.decision);
  const [priority, setPriority] = useState<FinalPriority | null>(item.priority);
  const [obs, setObs] = useState(item.observation);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [expanded, setExpanded] = useState(false);

  // Aggregate regional counts
  const counts = { MANTIDO: 0, ATUALIZADO: 0, INATIVACAO: 0 };
  for (const j of regionalJudgments) counts[j.decision] += 1;

  async function persist(
    nextDecision: FinalDecision | null,
    nextPriority: FinalPriority | null,
    nextObs: string,
  ) {
    if (disabled) return;
    setSaving("saving");
    try {
      await saveOpinionItem({
        itemId: item.id,
        decision: nextDecision,
        priority: nextPriority,
        observation: nextObs,
        userId,
      });
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    } catch (e) {
      setSaving("idle");
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  function pickDecision(d: FinalDecision) {
    if (disabled) return;
    const next = d === decision ? null : d;
    setDecision(next);
    void persist(next, priority, obs);
  }

  function pickPriority(p: FinalPriority | "NONE") {
    if (disabled) return;
    const next = p === "NONE" ? null : p;
    setPriority(next);
    void persist(decision, next, obs);
  }

  // Autosave observation on blur
  function blurObs() {
    if (obs === item.observation) return;
    void persist(decision, priority, obs);
  }


  const cardBorder = decision
    ? decision === "MANTER"
      ? "border-l-4 border-l-emerald-500"
      : decision === "ATUALIZAR"
        ? "border-l-4 border-l-amber-500"
        : "border-l-4 border-l-rose-500"
    : "border-l-4 border-l-slate-200";

  return (
    <div className={`rounded-lg border bg-card p-4 ${cardBorder}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {item.courseId}
            </span>
            <h4 className="text-sm font-semibold text-foreground">
              {course?.solucao ?? "(curso não encontrado)"}
            </h4>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Regionais:</span>
            {REGIONAL_DECISIONS.map((k) => (
              <span
                key={k}
                className={`rounded border px-2 py-0.5 ${REGIONAL_STYLE[k]}`}
              >
                {REGIONAL_LABEL[k]} · <strong>{counts[k]}</strong>
              </span>
            ))}
            {regionalJudgments.length === 0 && (
              <span className="italic text-muted-foreground">
                nenhuma avaliação regional
              </span>
            )}
            {regionalJudgments.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 text-xs font-medium text-primary underline"
              >
                {expanded ? "ocultar" : "ver detalhes"}
              </button>
            )}
          </div>

          {expanded && regionalJudgments.length > 0 && (
            <div className="mt-2 overflow-hidden rounded border bg-muted/30">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">Gestor</th>
                    <th className="px-2 py-1">Região</th>
                    <th className="px-2 py-1">Decisão</th>
                    <th className="px-2 py-1">Prioridade</th>
                    <th className="px-2 py-1">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {regionalJudgments.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="px-2 py-1">{j.userName || j.userEmail}</td>
                      <td className="px-2 py-1">{j.region}</td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 ${REGIONAL_STYLE[j.decision]}`}
                        >
                          {REGIONAL_LABEL[j.decision]}
                        </span>
                      </td>
                      <td className="px-2 py-1">{j.priority ?? "—"}</td>
                      <td className="px-2 py-1">{j.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Decision buttons + priority */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex gap-1">
            {(Object.keys(DECISION_LABELS) as FinalDecision[]).map((d) => {
              const active = decision === d;
              const s = DECISION_BTN_STYLES[d];
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDecision(d)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active ? s.active : `bg-white ${s.idle}`
                  }`}
                >
                  {DECISION_LABELS[d]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              Priorização final:
            </span>
            <Select
              value={priority ?? "NONE"}
              onValueChange={(v) => pickPriority(v as FinalPriority | "NONE")}
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-32 bg-white text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {(Object.keys(PRIORITY_LABELS) as FinalPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {saving === "saving"
              ? "Salvando..."
              : saving === "saved"
                ? "Salvo ✓"
                : decision
                  ? "Parecer emitido"
                  : "Aguardando parecer"}
          </span>
        </div>

      </div>

      <div className="mt-3">
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={blurObs}
          disabled={disabled}
          placeholder="Observação / justificativa (opcional)"
          rows={2}
          className="text-sm"
        />
      </div>
    </div>
  );
}
