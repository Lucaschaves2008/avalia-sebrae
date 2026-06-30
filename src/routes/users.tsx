import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2, UserCog, ArrowLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { adminSetUserPassword } from "@/lib/admin-users.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import {
  AuthProvider,
  DEFAULT_PASSWORD,
  REGIONS,
  STATES_BY_REGION,
  createUser,
  deleteUser,
  updateUser,
  useAuth,
  useUsersList,
  type AuthUser,
  type Region,
  type UserInput,
  type UserRole,
  type UserStatus,
} from "@/lib/auth";
import { SebraeLogo } from "@/components/SebraeLogo";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [{ title: "Gestão de Usuários — SEBRAE" }],
  }),
  component: () => (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <UsersPage />
    </AuthProvider>
  ),
});

const baseSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo"),
  unit: z.string().trim().min(2, "Informe a unidade").max(80),
  role: z.enum(["admin", "gestor"]),
  status: z.enum(["Ativo", "Inativo"]),
  region: z.union([
    z.literal(""),
    z.enum(["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]),
  ]),
  state: z.string().nullable(),
});

const userSchema = baseSchema.superRefine((val, ctx) => {
  if (val.role === "gestor") {
    if (!val.region) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: "Região é obrigatória para Gestor Regional.",
      });
    }
    if (!val.state) {
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "Estado é obrigatório para Gestor Regional.",
      });
    }
  }
});

type FormState = UserInput;

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  unit: "",
  region: "",
  state: null,
  role: "gestor",
  status: "Ativo",
};

function UsersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const users = useUsersList();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const setUserPasswordFn = useServerFn(adminSetUserPassword);
  const isSuperAdmin =
    user?.email?.toLowerCase() === "jusmar.chaves@providence.solutions";

  async function handleChangePassword() {
    if (!editing) return;
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    setSavingPassword(true);
    try {
      await setUserPasswordFn({
        data: { userId: editing.id, newPassword },
      });
      toast.success(`Senha de ${editing.name} atualizada com sucesso.`);
      setNewPassword("");
      setShowPassword(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  // Admin guard
  useEffect(() => {
    if (user === null) return;
    if (user.role !== "admin") {
      toast.error("Acesso restrito ao Administrador.");
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.region.toLowerCase().includes(q),
    );
  }, [users, query]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setNewPassword("");
    setShowPassword(false);
    setIsModalOpen(true);
  }

  function openEdit(u: AuthUser) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone,
      unit: u.unit,
      region: u.region,
      state: u.state,
      role: u.role,
      status: u.status,
    });
    setErrors({});
    setNewPassword("");
    setShowPassword(false);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = userSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (editing) {
      const r = await updateUser(editing.id, parsed.data);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Usuário atualizado com sucesso.");
    } else {
      const r = await createUser(parsed.data);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Usuário criado. Senha padrão: ${DEFAULT_PASSWORD} (troca obrigatória no 1º acesso).`,
      );
    }
    setIsModalOpen(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.id === user?.id) {
      toast.error("Você não pode excluir o próprio usuário.");
      setConfirmDelete(null);
      return;
    }
    const r = await deleteUser(confirmDelete.id);
    if (!r.ok) {
      toast.error(r.error);
      setConfirmDelete(null);
      return;
    }
    if (r.mode === "physical") {
      toast.success("Usuário excluído definitivamente.");
    } else {
      toast.success(
        "Usuário possui avaliações vinculadas — desativado (exclusão lógica).",
      );
    }
    setConfirmDelete(null);
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verificando permissões...
      </div>
    );
  }

  const isNational = form.role === "admin";
  const availableStates = form.region
    ? STATES_BY_REGION[form.region as Region]
    : [];

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
              <UserCog className="h-3.5 w-3.5" />
              Administração
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
              Gestão de Usuários
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre, edite e gerencie o acesso dos gestores ao Portfólio de Cursos.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] hover:bg-[var(--primary-hover)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou região..."
                className="h-10 pl-9"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} de {users.length} usuários
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Região / UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.role === "admin" ? "Gestor Nacional" : "Gestor Regional"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.phone}</TableCell>
                      <TableCell className="text-sm">{u.unit}</TableCell>
                      <TableCell className="text-sm">
                        {u.role === "admin" && !u.state ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {u.region}
                            {u.state ? ` / ${u.state}` : ""}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            u.status === "Ativo"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-zinc-300 bg-zinc-100 text-zinc-600"
                          }
                        >
                          <span
                            className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                              u.status === "Ativo" ? "bg-emerald-500" : "bg-zinc-400"
                            }`}
                          />
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(u)}
                            aria-label={`Editar ${u.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(u)}
                            aria-label={`Excluir ${u.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Create / Edit modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar usuário" : "Novo usuário"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize as informações do usuário."
                : `Será atribuída a senha padrão "${DEFAULT_PASSWORD}" e a troca será obrigatória no primeiro acesso.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                maxLength={20}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    role: v as UserRole,
                    // Resetting region/state for clarity when switching to national
                    region: v === "admin" ? "" : form.region || "Sudeste",
                    state: v === "admin" ? null : form.state,
                  })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Gestor Nacional</SelectItem>
                  <SelectItem value="gestor">Gestor Regional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">
                Unidade de Vinculação <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="Ex.: SEBRAE/PE"
                maxLength={80}
              />
              {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">
                Região{" "}
                {isNational ? (
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Select
                value={form.region || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    region: v === "__none__" ? "" : (v as Region),
                    state: null,
                  })
                }
              >
                <SelectTrigger id="region">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {isNational && (
                    <SelectItem value="__none__">— Não vinculado —</SelectItem>
                  )}
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.region && (
                <p className="text-xs text-destructive">{errors.region}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">
                Estado (UF){" "}
                {isNational ? (
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Select
                value={form.state ?? "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, state: v === "__none__" ? null : v })
                }
                disabled={!form.region}
              >
                <SelectTrigger id="state">
                  <SelectValue
                    placeholder={
                      form.region ? "Selecione a UF..." : "Selecione a região antes"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isNational && (
                    <SelectItem value="__none__">— Não vinculado —</SelectItem>
                  )}
                  {availableStates.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && (
                <p className="text-xs text-destructive">{errors.state}</p>
              )}
            </div>

            {editing && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editing && (
              <div className="sm:col-span-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                O novo usuário será criado automaticamente com status{" "}
                <span className="font-semibold text-foreground">Ativo</span>.
              </div>
            )}

            <DialogFooter className="gap-2 sm:col-span-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
              >
                {editing ? "Salvar alterações" : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{confirmDelete?.name}</span>{" "}
              será removido. Se houver avaliações vinculadas, o usuário será apenas
              desativado (exclusão lógica). Caso contrário, será excluído
              definitivamente do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
