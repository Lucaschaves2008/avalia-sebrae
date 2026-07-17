import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Gavel, LogOut, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider, useAuth } from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";
import { useCoursesListWhen, type Course } from "@/lib/courses";
import {
  SCOPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  deleteProcess,
  effectiveStatus,
  upsertProcess,
  useProcessesListWhen,
  type EvaluationProcess,
  type ProcessScope,
  type ProcessStatus,
} from "@/lib/processes";

export const Route = createFileRoute("/processes")({
  head: () => ({ meta: [{ title: "Processos Avaliativos — SEBRAE" }] }),
  component: () => (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <ProcessesPage />
    </AuthProvider>
  ),
});

const schema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do processo."),
    description: z.string().trim().max(500).optional().default(""),
    startDate: z.string().min(1, "Informe a data inicial."),
    endDate: z.string().min(1, "Informe a data final."),
    scope: z.enum(["NACIONAL", "REGIONAL", "AMBOS"]),
    status: z.enum(["ATIVO", "INATIVO", "FINALIZADO"]),
    courseIds: z.array(z.string()).min(1, "Selecione pelo menos um curso."),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "A data final deve ser maior ou igual à inicial.",
  });

type FormState = {
  id?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  scope: ProcessScope;
  status: ProcessStatus;
  courseIds: string[];
};

const emptyForm: FormState = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  scope: "AMBOS",
  status: "ATIVO",
  courseIds: [],
};

function ProcessesPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const canFetchData = !loading && !!user;
  const processes = useProcessesListWhen(canFetchData);
  const courses = useCoursesListWhen(canFetchData);
  const canManage = user?.role === "admin";

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EvaluationProcess | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && !canManage) navigate({ to: "/dashboard" });
  }, [loading, user, canManage, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return processes;
    return processes.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [processes, query]);

  function openCreate() {
    setEditing({ ...emptyForm });
  }

  function openEdit(p: EvaluationProcess) {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      scope: p.scope,
      status: p.status,
      courseIds: [...p.courseIds],
    });
  }

  async function handleSave() {
    if (!editing) return;
    const parsed = schema.safeParse(editing);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }
    try {
      await upsertProcess({
        id: editing.id,
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        scope: parsed.data.scope,
        status: parsed.data.status,
        courseIds: parsed.data.courseIds,
      });
      toast.success(editing.id ? "Processo atualizado." : "Processo criado.");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteProcess(confirmDelete.id);
      toast.success("Processo excluído.");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
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
          <SebraeLogo variant="onDark" height={36} />
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
                void logout();
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
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <Gavel className="h-3.5 w-3.5" />
            Avaliação
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Processos Avaliativos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina períodos, amplitude e cursos a serem avaliados.
          </p>
        </div>

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
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Novo processo
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Amplitude</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Cursos</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum processo cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const eff = effectiveStatus(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{p.name}</div>
                      {p.description && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(`${p.startDate}T00:00:00`).toLocaleDateString("pt-BR")}{" "}
                      —{" "}
                      {new Date(`${p.endDate}T00:00:00`).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs">{SCOPE_LABELS[p.scope]}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[eff]}>
                        {STATUS_LABELS[eff]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {p.courseIds.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(p)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4">

            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              {editing?.id ? "Editar processo" : "Novo processo avaliativo"}
            </DialogTitle>
            <DialogDescription>
              Defina o período, a amplitude e os cursos vinculados ao processo.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="proc-name">Nome do processo *</Label>
                  <Input
                    id="proc-name"
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    placeholder="Ex.: Avaliação Anual 2026"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="proc-desc">Descrição</Label>
                  <Textarea
                    id="proc-desc"
                    value={editing.description}
                    onChange={(e) =>
                      setEditing({ ...editing, description: e.target.value })
                    }
                    placeholder="Contexto / observações sobre este processo"
                    rows={2}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="proc-start">Data inicial *</Label>
                    <Input
                      id="proc-start"
                      type="date"
                      value={editing.startDate}
                      onChange={(e) =>
                        setEditing({ ...editing, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="proc-end">Data final *</Label>
                    <Input
                      id="proc-end"
                      type="date"
                      value={editing.endDate}
                      onChange={(e) =>
                        setEditing({ ...editing, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Amplitude *</Label>
                    <Select
                      value={editing.scope}
                      onValueChange={(v) =>
                        setEditing({ ...editing, scope: v as ProcessScope })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NACIONAL">
                          {SCOPE_LABELS.NACIONAL}
                        </SelectItem>
                        <SelectItem value="REGIONAL">
                          {SCOPE_LABELS.REGIONAL}
                        </SelectItem>
                        <SelectItem value="AMBOS">{SCOPE_LABELS.AMBOS}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status *</Label>
                    <Select
                      value={editing.status}
                      onValueChange={(v) =>
                        setEditing({ ...editing, status: v as ProcessStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="INATIVO">Inativo</SelectItem>
                        <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Após o vencimento, o status efetivo passa a "Finalizado"
                      automaticamente.
                    </p>
                  </div>
                </div>

                <CourseSelector
                  courses={courses}
                  selected={editing.courseIds}
                  onChange={(ids) => setEditing({ ...editing, courseIds: ids })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t bg-card px-6 py-4">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Processos com avaliações registradas
              não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CourseSelector({
  courses,
  selected,
  onChange,
}: {
  courses: Course[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.solucao.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q),
    );
  }, [courses, query]);

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  }

  function toggleAll() {
    if (filtered.every((c) => selected.includes(c.id))) {
      onChange(selected.filter((id) => !filtered.some((c) => c.id === id)));
    } else {
      const merged = new Set(selected);
      filtered.forEach((c) => merged.add(c.id));
      onChange([...merged]);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>Cursos vinculados * ({selected.length} selecionado(s))</Label>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-primary hover:underline"
        >
          {filtered.every((c) => selected.includes(c.id))
            ? "Desmarcar todos"
            : "Selecionar todos"}
        </button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar curso..."
          className="pl-9"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Nenhum curso disponível.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40">
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.solucao}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.codigo} • {c.modalidade || "—"}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
