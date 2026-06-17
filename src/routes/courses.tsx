import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

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
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider, useAuth } from "@/lib/auth";
import {
  BCG_OPTIONS,
  FGV_FIELD_LABELS,
  FGV_LABELS,
  FGV_OPTIONS,
  MATERIAL_LABELS,
  appendCourses,
  deleteCourse,
  downloadCsvTemplate,
  emptyCourse,
  parseCoursesCsv,
  upsertCourse,
  useCoursesList,
  type BCG,
  type Course,
  type CourseFgv,
  type CourseMaterials,
  type FgvRating,
} from "@/lib/courses";
import { SebraeLogo } from "@/components/SebraeLogo";

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

function CoursesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const courses = useCoursesList();
  const isAdmin = user?.role === "admin";

  const [query, setQuery] = useState("");
  const [bcgFilter, setBcgFilter] = useState<string>("all");
  const [viewing, setViewing] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user === null) {
      const t = setTimeout(() => {
        if (!user) navigate({ to: "/login" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (bcgFilter !== "all" && c.bcg !== bcgFilter) return false;
      if (!q) return true;
      return (
        c.solucao.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        c.publicoAlvo.toLowerCase().includes(q) ||
        c.modalidade.toLowerCase().includes(q)
      );
    });
  }, [courses, query, bcgFilter]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const result = await parseCoursesCsv(file);
      if (result.courses.length === 0) {
        toast.error("Nenhum curso válido encontrado no arquivo.");
      } else {
        appendCourses(result.courses);
        setImportSummary({
          imported: result.courses.length,
          skipped: result.skipped,
          errors: result.errors,
        });
        toast.success(`${result.courses.length} curso(s) importado(s) com sucesso.`);
      }
    } catch (err) {
      toast.error("Falha ao processar o CSV.");
      console.error(err);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header
        className="border-b border-white/10"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <SebraeLogo />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Painel
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

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Portfólio
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
              Gestão de Cursos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Importe, edite e gerencie as soluções educacionais do portfólio."
                : "Consulte o portfólio de soluções educacionais do SEBRAE (somente leitura)."}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
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
        </div>

        {importSummary && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-[var(--shadow-card)]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="flex-1">
              <div className="font-semibold">Importação concluída</div>
              <div className="text-sm text-emerald-800">
                {importSummary.imported} curso(s) adicionado(s) ou atualizado(s).
                {importSummary.skipped > 0 &&
                  ` ${importSummary.skipped} linha(s) ignorada(s).`}
              </div>
              {importSummary.errors.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">
                    {importSummary.errors.length} aviso(s) durante o parse
                  </summary>
                  <ul className="mt-1 list-disc pl-5">
                    {importSummary.errors.slice(0, 5).map((e, i) => (
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

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por código, solução, público..."
                  className="h-10 pl-9"
                />
              </div>
              <Select value={bcgFilter} onValueChange={setBcgFilter}>
                <SelectTrigger className="h-10 w-full sm:w-48">
                  <SelectValue placeholder="Matriz BCG" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as classificações</SelectItem>
                  {BCG_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} de {courses.length} cursos
            </div>
          </div>

          <div className="overflow-x-auto">
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum curso encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30">
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
                        {c.bcg ? <BcgBadge value={c.bcg} /> : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setViewing(c)}
                            aria-label="Detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* View dialog */}
      <CourseViewDialog course={viewing} onClose={() => setViewing(null)} />

      {/* Edit dialog (admin) */}
      {isAdmin && (
        <CourseEditDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            upsertCourse(c);
            toast.success("Curso salvo com sucesso.");
            setEditing(null);
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
              onClick={() => {
                if (confirmDelete) {
                  deleteCourse(confirmDelete.id);
                  toast.success("Curso excluído.");
                  setConfirmDelete(null);
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

function FgvBadge({ value }: { value: FgvRating }) {
  const styles: Record<FgvRating, string> = {
    SA: "border-emerald-300 bg-emerald-50 text-emerald-800",
    PA: "border-amber-300 bg-amber-50 text-amber-800",
    NA: "border-rose-300 bg-rose-50 text-rose-800",
    NAP: "border-zinc-300 bg-zinc-100 text-zinc-600",
  };
  return (
    <Badge variant="outline" className={styles[value]}>
      {value}
    </Badge>
  );
}

function CourseViewDialog({ course, onClose }: { course: Course | null; onClose: () => void }) {
  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        {course && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{course.codigo}</span>
                <span>{course.solucao}</span>
              </DialogTitle>
              <DialogDescription>
                {course.publicoAlvo} • {course.modalidade} • {course.instrumento}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
              <Stat label="Idade (meses)" value={String(course.idadeMeses)} />
              <Stat label="Atendimentos" value={course.atendimentosAno.toLocaleString("pt-BR")} />
              <Stat label="IDS" value={String(course.ids)} />
              <Stat label="BCG" value={course.bcg || "—"} />
            </div>

            {course.link && (
              <a
                href={course.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Abrir solução →
              </a>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Materiais Existentes</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(MATERIAL_LABELS) as (keyof CourseMaterials)[]).map((k) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    {course.materials[k] ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-zinc-400" />
                    )}
                    <span className={course.materials[k] ? "text-foreground" : "text-muted-foreground"}>
                      {MATERIAL_LABELS[k]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Avaliação Qualitativa FGV
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(FGV_FIELD_LABELS) as (keyof CourseFgv)[]).map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{FGV_FIELD_LABELS[k]}</span>
                    <FgvBadge value={course.fgv[k]} />
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Legenda:{" "}
                {FGV_OPTIONS.map((o, i) => (
                  <span key={o}>
                    <strong>{o}</strong> {FGV_LABELS[o]}
                    {i < FGV_OPTIONS.length - 1 ? " • " : ""}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
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
            <Field label="Classificação BCG" className="sm:col-span-2">
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
