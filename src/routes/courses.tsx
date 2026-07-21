import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Gavel,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import {
  appendCourses,
  BCG_OPTIONS,
  computeMaterialReadiness,
  deleteCourse,
  downloadCsvTemplate,
  emptyCourse,
  FGV_FIELD_LABELS,
  FGV_LABELS,
  FGV_OPTIONS,
  MATERIAL_LABELS,
  parseCoursesCsv,
  refreshCourses,
  upsertCourse,
  useCoursesListWhen,
  useCoursesStatusWhen,
  type BCG,
  type Course,
  type CourseFgv,
  type CourseMaterials,
  type FgvRating,
  type ReadinessLevel,
  type ReadinessResult,
} from "@/lib/courses";
import { SebraeLogo } from "@/components/SebraeLogo";
import { HelpTourButton } from "@/components/HelpTourButton";
import { TourAutoStart } from "@/lib/tour/TourProvider";
import {
  DECISION_LABELS,
  DECISION_STYLES,
  PRIORITY_STYLES,
  findUserJudgment,
  judgmentsForCourse,
  refreshJudgments,
  upsertJudgment,
  useJudgmentsListWhen,
  useJudgmentsStatusWhen,
  type Judgment,
  type JudgmentDecision,
  type JudgmentPriority,
} from "@/lib/judgments";
import {
  effectiveStatus,
  isWithinPeriod,
  SCOPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  refreshProcesses,
  useProcessesListWhen,
  useProcessesStatusWhen,
  type EvaluationProcess,
} from "@/lib/processes";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [{ title: "Gestão de Cursos — SEBRAE" }],
  }),
  component: () => (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <CoursesPage />
    </AuthProvider>
  ),
});

// FGV color tokens — SA verde, PA amarelo, NA vermelho, NAP azul claro
const FGV_STYLES: Record<FgvRating, { badge: string; dot: string; bar: string }> = {
  SA: {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  PA: {
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  NA: {
    badge: "border-rose-300 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
  NAP: {
    badge: "border-sky-300 bg-sky-50 text-sky-800",
    dot: "bg-sky-400",
    bar: "bg-sky-400",
  },
};

function CoursesPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const canFetchData = !loading && !!user;
  const courses = useCoursesListWhen(canFetchData);
  const judgments = useJudgmentsListWhen(canFetchData);
  const processes = useProcessesListWhen(canFetchData);
  const coursesStatus = useCoursesStatusWhen(canFetchData);
  const judgmentsStatus = useJudgmentsStatusWhen(canFetchData);
  const processesStatus = useProcessesStatusWhen(canFetchData);
  const isAdmin = user?.role === "admin";
  const isGestor = user?.role === "gestor";

  const [query, setQuery] = useState("");
  const [bcgFilter, setBcgFilter] = useState<string>("all");
  const [publicoFilter, setPublicoFilter] = useState<string>("all");
  const [modalidadeFilter, setModalidadeFilter] = useState<string>("all");
  const [esforcoFilter, setEsforcoFilter] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [detail, setDetail] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Active processes visible to current user
  const activeProcessesForUser = useMemo<EvaluationProcess[]>(() => {
    return processes.filter((p) => {
      if (effectiveStatus(p) !== "ATIVO") return false;
      if (!isWithinPeriod(p)) return false;
      if (isGestor) return p.scope === "REGIONAL" || p.scope === "AMBOS";
      if (isAdmin) return p.scope === "NACIONAL" || p.scope === "AMBOS";
      return false;
    });
  }, [processes, isGestor, isAdmin]);

  const selectedProcess = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );

  // Judgments filtered to the active process scope (when one is selected)
  const scopedJudgments = useMemo(() => {
    if (!selectedProcessId) return judgments;
    return judgments.filter((j) => j.processId === selectedProcessId);
  }, [judgments, selectedProcessId]);

  const publicos = useMemo(
    () => Array.from(new Set(courses.map((c) => c.publicoAlvo).filter(Boolean))).sort(),
    [courses],
  );
  const modalidades = useMemo(
    () => Array.from(new Set(courses.map((c) => c.modalidade).filter(Boolean))).sort(),
    [courses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // When a process is selected, restrict to the courses bound to that process
    const inProcess = selectedProcess
      ? courses.filter((c) => selectedProcess.courseIds.includes(c.id))
      : courses;
    return inProcess.filter((c) => {
      if (bcgFilter !== "all" && c.bcg !== bcgFilter) return false;
      if (publicoFilter !== "all" && c.publicoAlvo !== publicoFilter) return false;
      if (modalidadeFilter !== "all" && c.modalidade !== modalidadeFilter) return false;
      if (esforcoFilter !== "all") {
        const r = computeMaterialReadiness(c);
        if (r.level !== esforcoFilter) return false;
      }
      if (!q) return true;
      return (
        c.solucao.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        c.publicoAlvo.toLowerCase().includes(q) ||
        c.modalidade.toLowerCase().includes(q)
      );
    });
  }, [courses, selectedProcess, query, bcgFilter, publicoFilter, modalidadeFilter, esforcoFilter]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const result = await parseCoursesCsv(file);
      if (result.courses.length === 0) {
        setImportSummary({ imported: 0, skipped: result.skipped, errors: result.errors });
        toast.error(
          `0 cursos importados. ${result.errors.length} erro(s) encontrado(s).`,
        );
      } else {
        const { inserted, errors: dbErrors } = await appendCourses(result.courses);
        const allErrors = [...result.errors, ...dbErrors];
        setImportSummary({
          imported: inserted,
          skipped: result.skipped,
          errors: allErrors,
        });
        if (inserted === 0) {
          toast.error(
            `0 cursos importados. ${allErrors.length} erro(s) encontrado(s). Verifique o relatório.`,
          );
        } else {
          toast.success(
            `${inserted} curso(s) importado(s) com sucesso. ${allErrors.length} erro(s) encontrado(s).`,
          );
        }
      }
    } catch (err) {
      toast.error("Falha ao processar o CSV.");
      console.error(err);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  function clearFilters() {
    setQuery("");
    setBcgFilter("all");
    setPublicoFilter("all");
    setModalidadeFilter("all");
    setEsforcoFilter("all");
  }

  const hasFilters =
    !!query ||
    bcgFilter !== "all" ||
    publicoFilter !== "all" ||
    modalidadeFilter !== "all" ||
    esforcoFilter !== "all";

  const dataLoading =
    (coursesStatus.loading && !coursesStatus.fetched) ||
    (processesStatus.loading && !processesStatus.fetched) ||
    (judgmentsStatus.loading && !judgmentsStatus.fetched);
  const dataErrors = [
    coursesStatus.error ? `Cursos: ${coursesStatus.error}` : null,
    processesStatus.error ? `Processos: ${processesStatus.error}` : null,
    judgmentsStatus.error ? `Avaliações: ${judgmentsStatus.error}` : null,
  ].filter(Boolean) as string[];

  async function retryDataLoad() {
    await Promise.all([refreshCourses(), refreshProcesses(), refreshJudgments()]);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <AppShell
      pageKey="courses"
      eyebrow={
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Portfólio
        </span>
      }
      title="Avaliação de Cursos"
      subtitle={
        isAdmin
          ? "Importe, edite e gerencie as soluções educacionais do portfólio."
          : "Avaliação dos cursos o portfólio de soluções educacionais do SEBRAE"
      }
    >
      <div data-tour="courses-title" />
      <>
        {isAdmin && (
          <div className="mb-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={downloadCsvTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Modelo CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importando..." : "Importar CSV"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleFile}
            />
            <Button
              onClick={() => setEditing(emptyCourse())}
              className="bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-[var(--primary-hover)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo curso
            </Button>
          </div>
        )}


        {importSummary && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-[var(--shadow-card)]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="flex-1">
              <div className="font-semibold">Relatório de Importação</div>
              <div className="text-sm text-emerald-800">
                {importSummary.imported} curso(s) importado(s) com sucesso.{" "}
                {importSummary.errors.length} erro(s) encontrado(s).
                {importSummary.skipped > 0 &&
                  ` ${importSummary.skipped} linha(s) ignorada(s).`}
              </div>
              {importSummary.errors.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Ver detalhes dos erros</summary>
                  <ul className="mt-1 list-disc pl-5">
                    {importSummary.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportSummary(null)}
              className="text-emerald-900 hover:bg-emerald-100"
            >
              Fechar
            </Button>
          </div>
        )}

        {dataErrors.length > 0 ? (
          <DataLoadError errors={dataErrors} onRetry={retryDataLoad} />
        ) : dataLoading ? (
          <DataLoadingState />
        ) : (
          <>
        {(isGestor || isAdmin) && selectedProcess && (
          <SelectedProcessBanner
            process={selectedProcess}
            onChange={() => setSelectedProcessId(null)}
          />
        )}
        {isGestor && !selectedProcess && activeProcessesForUser.length > 0 && (
          <div className="mb-4">
            <GestorProcessPicker
              processes={activeProcessesForUser}
              onSelect={(p) => setSelectedProcessId(p.id)}
            />
          </div>
        )}

        {/* Filters bar */}
        <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]" data-tour="courses-filters">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por código, solução, público..."
                className="h-10 pl-9"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={publicoFilter} onValueChange={setPublicoFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Público-alvo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os públicos</SelectItem>
                  {publicos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Modalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as modalidades</SelectItem>
                  {modalidades.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={esforcoFilter} onValueChange={setEsforcoFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Esforço de confecção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="pronto">Pronto / Baixo Esforço</SelectItem>
                  <SelectItem value="medio">Médio Esforço</SelectItem>
                  <SelectItem value="alto">Alto Esforço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> de{" "}
              {courses.length} cursos
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-2 font-medium text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "cards" | "table")}
              className="rounded-md border border-border bg-muted/30 p-0.5"
            >
              <ToggleGroupItem value="cards" aria-label="Cartões" className="h-8 px-3">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tabela" className="h-8 px-3">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">Nenhum curso encontrado.</p>
          </div>
        )}

        {/* Cards view */}
        {filtered.length > 0 && view === "cards" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="courses-list">
            {filtered.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                onOpen={() => setDetail(c)}
                userJudgment={
                  user ? findUserJudgment(scopedJudgments, c.id, user.id) : undefined
                }
                showJudgmentStatus={isGestor && !!selectedProcessId}
              />
            ))}
          </div>
        )}

        {/* Table view */}
        {filtered.length > 0 && view === "table" && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Código</TableHead>
                  <TableHead>Solução Educacional</TableHead>
                  <TableHead>Público-alvo</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Atendimentos</TableHead>
                  <TableHead className="text-right">IDS</TableHead>
                  <TableHead>BCG</TableHead>
                  <TableHead>Prontidão</TableHead>
                  {isGestor && <TableHead>Julgamento</TableHead>}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const userJudgment = isGestor && user ? findUserJudgment(scopedJudgments, c.id, user.id) : undefined;
                  const judged = !!userJudgment;
                  return (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer hover:bg-muted/30 ${
                        isGestor
                          ? judged
                            ? "border-l-4 border-l-emerald-500"
                            : "border-l-4 border-l-rose-500"
                          : ""
                      }`}
                      onClick={() => setDetail(c)}
                    >
                      <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{c.solucao}</div>
                        {c.instrumento && (
                          <div className="text-xs text-muted-foreground">{c.instrumento}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.publicoAlvo}</TableCell>
                      <TableCell className="text-sm">{c.modalidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.atendimentosAno.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.ids}</TableCell>
                      <TableCell>
                        {c.bcg ? (
                          <BcgBadge value={c.bcg} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ReadinessBadge result={computeMaterialReadiness(c)} />
                      </TableCell>
                      {isGestor && (
                        <TableCell>
                          {judged ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 bg-emerald-50 text-emerald-800 gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {DECISION_LABELS[userJudgment.decision] ?? userJudgment.decision}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-rose-300 bg-rose-50 text-rose-800 gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => setEditing(c)}
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setConfirmDelete(c)}
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
          </>
        )}
      </>

      {/* Detail Sheet */}
      <CourseDetailSheet
        course={detail}
        onClose={() => setDetail(null)}
        isAdmin={isAdmin}
        isGestor={isGestor}
        currentUser={user}
        processId={selectedProcessId}
        processName={selectedProcess?.name ?? null}
        judgments={detail ? judgmentsForCourse(scopedJudgments, detail.id) : []}
        onEdit={(c) => {
          setDetail(null);
          setEditing(c);
        }}
      />

      {/* Edit dialog (admin) */}
      {isAdmin && (
        <CourseEditDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSave={async (c) => {
            const isNew = !courses.some((x) => x.id === (c.codigo || c.id).trim());
            try {
              await upsertCourse(c, { isNew });
              toast.success("Curso salvo com sucesso.");
              setEditing(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erro ao salvar curso.";
              toast.error(msg);
            }
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>
              O curso{" "}
              <span className="font-medium text-foreground">{confirmDelete?.solucao}</span>{" "}
              será removido do portfólio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) {
                  try {
                    await deleteCourse(confirmDelete.id);
                    toast.success("Curso excluído.");
                    setConfirmDelete(null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao excluir curso.");
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DataLoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card p-16 text-center shadow-[var(--shadow-card)]">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <p className="mt-3 text-sm font-medium text-foreground">Carregando cursos...</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Buscando dados pelo servidor do aplicativo.
      </p>
    </div>
  );
}

function DataLoadError({ errors, onRetry }: { errors: string[]; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold">Não foi possível carregar os dados de cursos.</div>
          <p className="mt-1 text-sm text-amber-900">
            Os cursos cadastrados não foram apagados. A consulta falhou durante o carregamento;
            tente novamente ou use o diagnóstico para enviar o relatório à TI.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900/90">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleRetry}
          disabled={retrying}
          className="border-amber-300 bg-white/70 text-amber-950 hover:bg-white"
        >
          {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function BcgBadge({ value }: { value: BCG }) {
  const styles: Record<BCG, string> = {
    Estrela: "border-amber-300 bg-amber-50 text-amber-800",
    "Vaca Leiteira": "border-emerald-300 bg-emerald-50 text-emerald-800",
    Interrogação: "border-blue-300 bg-blue-50 text-blue-800",
    Abacaxi: "border-rose-300 bg-rose-50 text-rose-800",
  };
  return (
    <Badge variant="outline" className={styles[value]}>
      {value}
    </Badge>
  );
}

function ReadinessBadge({ result }: { result: ReadinessResult }) {
  const styles: Record<ReadinessLevel, string> = {
    pronto: "border-emerald-300 bg-emerald-50 text-emerald-800",
    medio: "border-amber-300 bg-amber-50 text-amber-800",
    alto: "border-rose-300 bg-rose-50 text-rose-800",
  };
  return (
    <Badge variant="outline" className={styles[result.level]}>
      {result.label} ({result.pct}%)
    </Badge>
  );
}

function CourseCard({
  course,
  onOpen,
  userJudgment,
  showJudgmentStatus,
}: {
  course: Course;
  onOpen: () => void;
  userJudgment?: Judgment;
  showJudgmentStatus?: boolean;
}) {
  const readiness = computeMaterialReadiness(course);
  const materialsCount = Object.values(course.materials).filter(Boolean).length;
  const totalMaterials = Object.keys(course.materials).length;
  const fgvScores = Object.values(course.fgv);
  const saCount = fgvScores.filter((v) => v === "SA").length;

  const judged = !!userJudgment;
  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] ${
        showJudgmentStatus
          ? judged
            ? "border-emerald-300 hover:border-emerald-400"
            : "border-rose-300 hover:border-rose-400"
          : "border-border hover:border-primary/30"
      }`}
    >
      {showJudgmentStatus ? (
        <div
          className={`flex w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white ${
            judged ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {judged ? (
            <>
              <ClipboardCheck className="h-3.5 w-3.5" />
              Avaliação concluída
              {userJudgment?.decision && (
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                  {DECISION_LABELS[userJudgment.decision] ?? userJudgment.decision}
                </span>
              )}
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" />
              Pendente de avaliação — clique para avaliar
            </>
          )}
        </div>
      ) : (
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/60 to-secondary" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {course.codigo || "—"}
          </span>
          <div className="flex items-center gap-1.5">
            <ReadinessBadge result={readiness} />
            {course.bcg && <BcgBadge value={course.bcg} />}
          </div>
        </div>


        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {course.solucao}
        </h3>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {course.publicoAlvo && (
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
              {course.publicoAlvo}
            </Badge>
          )}
          {course.modalidade && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {course.modalidade}
            </Badge>
          )}
          {course.instrumento && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {course.instrumento}
            </Badge>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <MiniStat label="Atendimentos" value={course.atendimentosAno.toLocaleString("pt-BR")} />
          <MiniStat label="IDS" value={String(course.ids)} />
          <MiniStat label="Idade" value={`${course.idadeMeses}m`} />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{materialsCount}</span>
              <span className="text-muted-foreground">/{totalMaterials}</span> materiais
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-emerald-600">{saCount}</span>
              <span className="text-muted-foreground">/10</span> SA
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Detalhes
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function CourseDetailSheet({
  course,
  onClose,
  isAdmin,
  isGestor,
  currentUser,
  processId,
  processName,
  judgments,
  onEdit,
}: {
  course: Course | null;
  onClose: () => void;
  isAdmin: boolean;
  isGestor: boolean;
  currentUser: AuthUser | null;
  processId: string | null;
  processName: string | null;
  judgments: Judgment[];
  onEdit: (c: Course) => void;
}) {
  const myJudgment = currentUser
    ? judgments.find((j) => j.userId === currentUser.id)
    : undefined;
  return (
    <Sheet open={!!course} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {course && (
          <>
            <div
              className="px-6 pb-6 pt-8 text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[11px] backdrop-blur">
                  {course.codigo || "—"}
                </span>
                {course.bcg && (
                  <Badge className="border-0 bg-secondary text-primary hover:bg-secondary">
                    {course.bcg}
                  </Badge>
                )}
              </div>
              <SheetHeader className="space-y-1 p-0 text-left">
                <SheetTitle className="text-xl font-bold text-white">
                  {course.solucao}
                </SheetTitle>
                <SheetDescription className="text-white/70">
                  {[course.publicoAlvo, course.modalidade, course.instrumento]
                    .filter(Boolean)
                    .join(" • ")}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg bg-white/10 p-3 backdrop-blur">
                <HeaderStat label="Atendimentos" value={course.atendimentosAno.toLocaleString("pt-BR")} />
                <HeaderStat label="IDS" value={String(course.ids)} />
                <HeaderStat label="Idade" value={`${course.idadeMeses} meses`} />
              </div>
            </div>

            <div className="px-6 py-6">
              <Tabs defaultValue="info">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="materiais">Materiais</TabsTrigger>
                  <TabsTrigger value="fgv">Avaliação FGV</TabsTrigger>
                  <TabsTrigger value="julgamento" className="relative">
                    Avaliação
                    {isGestor && (
                      <span
                        className={`ml-1.5 h-1.5 w-1.5 rounded-full ${
                          myJudgment ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — Info */}
                <TabsContent value="info" className="mt-5 space-y-5">
                  <InfoRow label="Código do Produto" value={course.codigo || "—"} mono />
                  <InfoRow label="Solução Educacional" value={course.solucao} />
                  <InfoRow label="Público-alvo" value={course.publicoAlvo || "—"} />
                  <InfoRow label="Instrumento" value={course.instrumento || "—"} />
                  <InfoRow label="Modalidade" value={course.modalidade || "—"} />
                  <InfoRow label="Classificação BCG" value={course.bcg || "—"} />
                  <InfoRow
                    label="Data de habilitação"
                    value={formatHabilitacao(course.dataHabilitacao)}
                  />

                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Link de acesso
                    </div>
                    {course.link ? (
                      <a
                        href={course.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 break-all text-sm font-medium text-primary hover:underline"
                      >
                        {course.link}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Nenhum link cadastrado.
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => onEdit(course)}
                      className="w-full"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar curso
                    </Button>
                  )}
                </TabsContent>

                {/* Tab 2 — Materials */}
                <TabsContent value="materiais" className="mt-5">
                  <MaterialsChecklist course={course} />
                </TabsContent>

                {/* Tab 3 — FGV */}
                <TabsContent value="fgv" className="mt-5">
                  <FgvPanel course={course} />
                </TabsContent>

                {/* Tab 4 — Julgamento */}
                <TabsContent value="julgamento" className="mt-5">
                  <JudgmentPanel
                    course={course}
                    currentUser={currentUser}
                    isGestor={isGestor}
                    isAdmin={isAdmin}
                    processId={processId}
                    processName={processName}
                    judgments={judgments}
                    myJudgment={myJudgment}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-right text-sm font-medium text-foreground ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MaterialsChecklist({ course }: { course: Course }) {
  const materials = course.materials;
  const readiness = computeMaterialReadiness(course);
  const items = Object.keys(MATERIAL_LABELS) as (keyof CourseMaterials)[];
  const done = items.filter((k) => materials[k]).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Índice de Prontidão de Materiais
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {done}
              <span className="text-base font-normal text-muted-foreground"> / {items.length}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ReadinessBadge result={readiness} />
            <div className="text-sm font-semibold text-emerald-600">{pct}% prontos</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((k) => {
          const ok = materials[k];
          return (
            <li
              key={k}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                ok
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-zinc-400" />
                )}
                <span
                  className={`text-sm ${
                    ok ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {MATERIAL_LABELS[k]}
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  ok
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                    : "border-zinc-300 bg-zinc-100 text-zinc-500"
                }
              >
                {ok ? "Disponível" : "Indisponível"}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FgvPanel({ course }: { course: Course }) {
  const fgv = course.fgv;
  const items = Object.keys(FGV_FIELD_LABELS) as (keyof CourseFgv)[];
  const counts: Record<FgvRating, number> = { SA: 0, PA: 0, NA: 0, NAP: 0 };
  for (const k of items) counts[fgv[k]]++;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Distribuição da avaliação
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-border">
          {(["SA", "PA", "NA", "NAP"] as FgvRating[]).map((r) =>
            counts[r] > 0 ? (
              <div
                key={r}
                className={FGV_STYLES[r].bar}
                style={{ width: `${(counts[r] / items.length) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {(["SA", "PA", "NA", "NAP"] as FgvRating[]).map((r) => (
            <div key={r} className="rounded-md border border-border bg-card p-2">
              <div className="flex items-center justify-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${FGV_STYLES[r].dot}`} />
                <span className="font-semibold">{r}</span>
              </div>
              <div className="mt-0.5 text-base font-bold text-foreground">{counts[r]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Criteria grid */}
      <div className="grid grid-cols-1 gap-2">
        {items.map((k) => {
          const value = fgv[k];
          const style = FGV_STYLES[value];
          return (
            <div
              key={k}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span className="text-sm font-medium text-foreground">
                  {FGV_FIELD_LABELS[k]}
                </span>
              </div>
              <Badge variant="outline" className={style.badge}>
                <span className="font-mono text-[11px] font-bold">{value}</span>
                <span className="ml-1.5 hidden sm:inline">{FGV_LABELS[value]}</span>
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Campos descritivos complementares */}
      <div className="space-y-3">
        <FgvTextBlock
          label="Ferramentas de Inclusão"
          value={course.ferramentasInclusao}
          tone="sky"
        />
        <FgvTextBlock
          label="Síntese"
          value={course.sinteseAvaliacao}
          tone="emerald"
        />
        <FgvTextBlock
          label="Pontos de Atenção"
          value={course.pontosAtencao}
          tone="amber"
        />
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Legenda
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {FGV_OPTIONS.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${FGV_STYLES[r].dot}`} />
              <span className="font-mono font-bold text-foreground">{r}</span>
              <span className="text-muted-foreground">— {FGV_LABELS[r]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FgvTextBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber";
}) {
  const tones: Record<typeof tone, string> = {
    sky: "border-sky-200 bg-sky-50/60 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/60 text-amber-900",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm">
        {value?.trim() ? value : <span className="opacity-60">Não informado.</span>}
      </div>
    </div>
  );
}

function formatHabilitacao(value: string): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return value;
}

function CourseEditDialog({
  course,
  onClose,
  onSave,
}: {
  course: Course | null;
  onClose: () => void;
  onSave: (c: Course) => void;
}) {
  const [form, setForm] = useState<Course | null>(course);

  useEffect(() => setForm(course), [course]);

  if (!form) return null;
  const isNew = !course?.codigo;

  function update<K extends keyof Course>(key: K, value: Course[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo curso" : "Editar curso"}</DialogTitle>
          <DialogDescription>
            Preencha os dados básicos, marque os materiais existentes e avalie os critérios FGV.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basicos">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basicos">Dados Básicos</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="fgv">Avaliação FGV</TabsTrigger>
          </TabsList>

          <TabsContent value="basicos" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Código do Produto">
              <Input value={form.codigo} onChange={(e) => update("codigo", e.target.value)} />
            </Field>
            <Field label="Solução Educacional" className="sm:col-span-2">
              <Input value={form.solucao} onChange={(e) => update("solucao", e.target.value)} />
            </Field>
            <Field label="Link de Acesso" className="sm:col-span-2">
              <Input
                type="url"
                value={form.link}
                onChange={(e) => update("link", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label="Público-alvo">
              <Input
                value={form.publicoAlvo}
                onChange={(e) => update("publicoAlvo", e.target.value)}
                placeholder="Ex.: Professor, Ensino Médio"
              />
            </Field>
            <Field label="Instrumento">
              <Input value={form.instrumento} onChange={(e) => update("instrumento", e.target.value)} />
            </Field>
            <Field label="Modalidade">
              <Input value={form.modalidade} onChange={(e) => update("modalidade", e.target.value)} />
            </Field>
            <Field label="Idade do produto (meses)">
              <Input
                type="number"
                min={0}
                value={form.idadeMeses}
                onChange={(e) => update("idadeMeses", Number(e.target.value))}
              />
            </Field>
            <Field label="Atendimentos no ano">
              <Input
                type="number"
                min={0}
                value={form.atendimentosAno}
                onChange={(e) => update("atendimentosAno", Number(e.target.value))}
              />
            </Field>
            <Field label="IDS">
              <Input
                type="number"
                min={0}
                value={form.ids}
                onChange={(e) => update("ids", Number(e.target.value))}
              />
            </Field>
            <Field label="Classificação BCG">
              <Select
                value={form.bcg || "none"}
                onValueChange={(v) => update("bcg", v === "none" ? "" : (v as BCG))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não classificado</SelectItem>
                  {BCG_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data de habilitação">
              <Input
                type="date"
                value={form.dataHabilitacao}
                onChange={(e) => update("dataHabilitacao", e.target.value)}
              />
            </Field>
          </TabsContent>

          <TabsContent value="materiais" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(MATERIAL_LABELS) as (keyof CourseMaterials)[]).map((k) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  checked={form.materials[k]}
                  onCheckedChange={(v) =>
                    update("materials", { ...form.materials, [k]: !!v })
                  }
                />
                <span className="text-sm">{MATERIAL_LABELS[k]}</span>
              </label>
            ))}
          </TabsContent>

          <TabsContent value="fgv" className="mt-4 space-y-2">
            {(Object.keys(FGV_FIELD_LABELS) as (keyof CourseFgv)[]).map((k) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <span className="text-sm text-foreground">{FGV_FIELD_LABELS[k]}</span>
                <Select
                  value={form.fgv[k]}
                  onValueChange={(v) =>
                    update("fgv", { ...form.fgv, [k]: v as FgvRating })
                  }
                >
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FGV_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        <span className="font-mono text-xs font-semibold">{o}</span>{" "}
                        — {FGV_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <Field label="Ferramentas de Inclusão">
                <Input
                  value={form.ferramentasInclusao}
                  onChange={(e) => update("ferramentasInclusao", e.target.value)}
                  placeholder="Ex.: versão em libras, audiodescrição, fonte ampliada..."
                />
              </Field>
              <Field label="Síntese">
                <Textarea
                  rows={3}
                  value={form.sinteseAvaliacao}
                  onChange={(e) => update("sinteseAvaliacao", e.target.value)}
                  placeholder="Síntese geral da avaliação..."
                />
              </Field>
              <Field label="Pontos de Atenção">
                <Textarea
                  rows={3}
                  value={form.pontosAtencao}
                  onChange={(e) => update("pontosAtencao", e.target.value)}
                  placeholder="Aspectos que precisam de revisão ou acompanhamento..."
                />
              </Field>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!form.codigo.trim() || !form.solucao.trim()) {
                toast.error("Preencha pelo menos Código e Solução Educacional.");
                return;
              }
              onSave(form);
            }}
            className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function JudgmentPanel({
  course,
  currentUser,
  isGestor,
  isAdmin,
  processId,
  processName,
  judgments,
  myJudgment,
}: {
  course: Course;
  currentUser: AuthUser | null;
  isGestor: boolean;
  isAdmin: boolean;
  processId: string | null;
  processName: string | null;
  judgments: Judgment[];
  myJudgment?: Judgment;
}) {
  const [decision, setDecision] = useState<JudgmentDecision | "">(
    myJudgment?.decision ?? "",
  );
  const [updates, setUpdates] = useState<string>(myJudgment?.updatesNeeded ?? "");
  const [priority, setPriority] = useState<JudgmentPriority | "">(
    myJudgment?.priority ?? "",
  );
  const [reason, setReason] = useState<string>(myJudgment?.reason ?? "");

  useEffect(() => {
    setDecision(myJudgment?.decision ?? "");
    setUpdates(myJudgment?.updatesNeeded ?? "");
    setPriority(myJudgment?.priority ?? "");
    setReason(myJudgment?.reason ?? "");
  }, [myJudgment?.id, course.id]);

  const [saving, setSaving] = useState(false);

  const judgmentSchema = useMemo(
    () =>
      z
        .object({
          decision: z.enum(["MANTIDO", "ATUALIZADO", "INATIVACAO"], {
            errorMap: () => ({ message: "Selecione a decisão." }),
          }),
          priority: z.enum(["Alta", "Média", "Baixa"]).optional(),
          reason: z.string().trim().min(1, "Informe o motivo / observação."),
          updates: z.string().trim().optional(),
        })
        .superRefine((val, ctx) => {
          if (val.decision === "ATUALIZADO" && !val.updates) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["updates"],
              message:
                "Por favor, descreva quais as atualizações necessárias para este curso.",
            });
          }
          if (val.decision !== "INATIVACAO" && !val.priority) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["priority"],
              message: "Selecione a priorização.",
            });
          }
        }),
    [],
  );

  async function handleSave() {
    if (!currentUser) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!processId) {
      toast.error("Selecione um processo avaliativo antes de registrar a avaliação.");
      return;
    }
    const parsed = judgmentSchema.safeParse({ decision, priority: priority || undefined, reason, updates });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do formulário.");
      return;
    }
    setSaving(true);
    try {
      await upsertJudgment({
        processId,
        courseId: course.id,
        userId: currentUser.id, // captured from active session
        userName: currentUser.name,
        userEmail: currentUser.email,
        region: currentUser.region, // captured from logged-in profile
        decision: parsed.data.decision,
        updatesNeeded:
          parsed.data.decision === "ATUALIZADO" ? parsed.data.updates : undefined,
        priority: parsed.data.decision === "INATIVACAO" ? null : parsed.data.priority!,
        reason: parsed.data.reason,
      });
      toast.success(
        myJudgment ? "Avaliação atualizada." : "Avaliação registrada com sucesso.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Surface validation message from upsertJudgment; otherwise generic network/DB error
      if (msg.startsWith("Por favor")) {
        toast.error(msg);
      } else {
        console.error("[judgments] save error:", err);
        toast.error("Erro ao salvar avaliação. Tente novamente em instantes.");
      }
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="space-y-5">
      {/* Status summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Módulo de Avaliação
            </span>
          </div>
          {isGestor &&
            (myJudgment ? (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-emerald-800"
              >
                <ClipboardCheck className="mr-1 h-3 w-3" /> Avaliado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-800"
              >
                <Clock className="mr-1 h-3 w-3" /> Pendente
              </Badge>
            ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isGestor
            ? `Registre sua avaliação como Gestor da Região ${currentUser?.region}. A avaliação será vinculada ao seu usuário e à sua região.`
            : "Visualização consolidada das avaliações realizadas pelos gestores regionais."}
        </p>
      </div>

      {/* Form (gestor only) */}
      {isGestor && currentUser && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label>Decisão *</Label>
            <Select
              value={decision || undefined}
              onValueChange={(v) => setDecision(v as JudgmentDecision)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a decisão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANTIDO">Mantido</SelectItem>
                <SelectItem value="ATUALIZADO">Mantido com atualizações</SelectItem>
                <SelectItem value="INATIVACAO">Inativação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {decision === "ATUALIZADO" && (
            <div className="space-y-2">
              <Label>Quais atualizações são necessárias? *</Label>
              <Textarea
                value={updates}
                onChange={(e) => setUpdates(e.target.value)}
                placeholder="Descreva as atualizações necessárias para o curso..."
                rows={3}
                maxLength={1000}
              />
            </div>
          )}

          {decision !== "INATIVACAO" && (
            <div className="space-y-2">
              <Label>Priorização *</Label>
              <Select
                value={priority || undefined}
                onValueChange={(v) => setPriority(v as JudgmentPriority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo / Observação *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Justifique sua decisão..."
              rows={4}
              maxLength={1500}
              required
            />
            <div className="text-right text-[11px] text-muted-foreground">
              {reason.length}/1500
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-muted-foreground">
              Vinculado a{" "}
              <span className="font-medium text-foreground">{currentUser.name}</span>{" "}
              • Região{" "}
              <span className="font-medium text-foreground">{currentUser.region}</span>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
            >
              {saving
                ? "Salvando..."
                : myJudgment
                  ? "Atualizar avaliação"
                  : "Salvar avaliação"}
            </Button>
          </div>
        </div>
      )}

      {/* Existing judgments list (admin sees all; gestor sees others') */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Julgamentos registrados
          </h4>
          <span className="text-xs text-muted-foreground">
            {judgments.length} no total
          </span>
        </div>
        {judgments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nenhum julgamento registrado para este curso.
          </div>
        ) : (
          <ul className="space-y-2">
            {judgments.map((j) => {
              const isMine = currentUser?.id === j.userId;
              return (
                <li
                  key={j.id}
                  className={`rounded-lg border p-3 ${
                    isMine ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={DECISION_STYLES[j.decision]}
                      >
                        {DECISION_LABELS[j.decision]}
                      </Badge>
                      {j.priority && (
                        <Badge variant="outline" className={PRIORITY_STYLES[j.priority]}>
                          Prioridade {j.priority}
                        </Badge>
                      )}
                      {isMine && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Seu julgamento
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(j.updatedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{j.userName}</span> •{" "}
                    Região <span className="font-medium text-foreground">{j.region}</span>
                  </div>
                  {j.decision === "ATUALIZADO" && j.updatesNeeded && (
                    <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <span className="font-semibold">Atualizações:</span>{" "}
                      {j.updatesNeeded}
                    </div>
                  )}
                  <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {j.reason}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!isGestor && !isAdmin && null}
      </div>
    </div>
  );
}

// ============================================================================
// Process selection UI (used by Regional gestors and optionally by Admins)
// ============================================================================

function GestorProcessPicker({
  processes,
  onSelect,
}: {
  processes: EvaluationProcess[];
  onSelect: (p: EvaluationProcess) => void;
}) {
  if (processes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
        <Gavel className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">
          Nenhum processo avaliativo ativo
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aguarde a abertura de um novo processo pelo Gestor Nacional.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">
          Processos avaliativos ativos
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecione um processo para iniciar ou continuar suas avaliações.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {processes.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p)}
              className="group flex w-full flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {p.name}
                </h3>
                <Badge variant="outline" className={STATUS_STYLES[effectiveStatus(p)]}>
                  {STATUS_LABELS[effectiveStatus(p)]}
                </Badge>
              </div>
              {p.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {p.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(`${p.startDate}T00:00:00`).toLocaleDateString("pt-BR")} —{" "}
                  {new Date(`${p.endDate}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span className="font-medium text-foreground">
                  {p.courseIds.length} curso(s)
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectedProcessBanner({
  process,
  onChange,
}: {
  process: EvaluationProcess;
  onChange: () => void;
}) {
  const eff = effectiveStatus(process);
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Gavel className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{process.name}</h3>
            <Badge variant="outline" className={STATUS_STYLES[eff]}>
              {STATUS_LABELS[eff]}
            </Badge>
            <Badge variant="outline">{SCOPE_LABELS[process.scope]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Período:{" "}
            {new Date(`${process.startDate}T00:00:00`).toLocaleDateString("pt-BR")} —{" "}
            {new Date(`${process.endDate}T00:00:00`).toLocaleDateString("pt-BR")} •{" "}
            {process.courseIds.length} curso(s) vinculado(s)
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onChange}>
        Trocar processo
      </Button>
    </div>
  );
}
