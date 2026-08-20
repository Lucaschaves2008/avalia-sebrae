import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Gavel,
  ShieldCheck,
  FileText,
  UserCog,
  LogOut,
  User as UserIcon,
  Menu as MenuIcon,
} from "lucide-react";

import { ConnectionBanner } from "@/components/ConnectionBanner";
import { SebraeLogo } from "@/components/SebraeLogo";

import { useAuth, SUPER_ADMIN_EMAIL } from "@/lib/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { key: "courses", label: "Cursos", to: "/courses", icon: BookOpen },
  { key: "processes", label: "Processos", to: "/processes", icon: Gavel, adminOnly: true },
  { key: "final-opinions", label: "Parecer Final", to: "/final-opinions", icon: ShieldCheck, adminOnly: true },
  { key: "reports", label: "Relatórios", to: "/reports", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { key: "users", label: "Usuários", to: "/users", icon: UserCog, adminOnly: true },
];

function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(date: Date) {
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("pt-BR", { month: "short" });
  return `${weekday.replace(".", "")}., ${day} de ${month.replace(".", "")}.`;
}

export interface AppShellProps {
  pageKey?: string;
  title?: string;
  subtitle?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  pageKey,
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // A data é formatada no fuso do navegador. Renderizá-la já no SSR faz
  // servidor (UTC) e cliente (fuso local) discordarem perto da virada do
  // dia, quebrando a hidratação — por isso ela só aparece após montar.
  const [hoje, setHoje] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setHoje(new Date()), []);

  const mainItems = MAIN_NAV.filter((i) => !i.adminOnly || isAdmin);
  const adminItems = ADMIN_NAV.filter((i) => !i.adminOnly || isAdmin);

  const roleLabel = isSuperAdmin
    ? "Super Administrador"
    : isAdmin
      ? "Gestor Nacional"
      : `Gestor Regional — ${user?.region ?? ""}`;

  const allItems = [...mainItems, ...adminItems];

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Avisa quando o banco fica inacessível (queda de rede ou bloqueio de
          proxy corporativo). Sem ele as telas apenas ficavam vazias. */}
      <ConnectionBanner />

      {/* Top blue navbar */}
      <header
        className="sticky top-0 z-30 text-white shadow-md"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:gap-8">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 lg:hidden"
                  aria-label="Abrir menu"
                >
                  <MenuIcon className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[86vw] max-w-xs p-0">
                <SheetHeader className="border-b border-border px-5 py-4 text-left">
                  <SheetTitle className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Navegação
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-2">
                  {allItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.to);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate({ to: item.to });
                        }}
                        className={`flex min-h-[48px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-auto border-t border-border px-5 py-3 text-xs capitalize text-muted-foreground">
                  {hoje ? formatDate(hoje) : ""}
                </div>
              </SheetContent>
            </Sheet>

            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="flex items-center"
              aria-label="Início"
            >
              <SebraeLogo variant="onDark" height={30} />
            </button>

            <nav className="hidden items-center gap-1 lg:flex">

              {allItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate({ to: item.to })}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm capitalize text-white/70 md:inline">
              {hoje ? formatDate(hoje) : ""}
            </span>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 focus:outline-none"
                    aria-label="Perfil"
                  >
                    {initials(user.name)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{user.name}</span>
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {user.email}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {roleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => navigate({ to: "/profile" })}
                    className="rounded-md px-3 py-2 text-sm text-foreground focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => {
                      await logout();
                      navigate({ to: "/login" });
                    }}
                    className="rounded-md px-3 py-2 text-sm text-destructive focus:bg-muted focus:text-destructive data-[highlighted]:bg-muted data-[highlighted]:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          {(title || eyebrow || subtitle || actions) && (
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                {eyebrow}
                {title && (
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {title}
                  </h1>
                )}

                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}


export default AppShell;
