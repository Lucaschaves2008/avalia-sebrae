import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Gavel,
  ShieldCheck,
  FileText,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";

import { SebraeLogo } from "@/components/SebraeLogo";

import { HelpTourButton } from "@/components/HelpTourButton";
import { TourAutoStart } from "@/lib/tour/TourProvider";
import { useAuth, SUPER_ADMIN_EMAIL } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const now = useMemo(() => new Date(), []);

  const mainItems = MAIN_NAV.filter((i) => !i.adminOnly || isAdmin);
  const adminItems = ADMIN_NAV.filter((i) => !i.adminOnly || isAdmin);

  const roleLabel = isSuperAdmin
    ? "Super Administrador"
    : isAdmin
      ? "Gestor Nacional"
      : `Gestor Regional — ${user?.region ?? ""}`;

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={`relative sticky top-0 flex h-screen flex-col text-white transition-[width] duration-200 ${collapsed ? "w-[76px]" : "w-64"}`}
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* Logo */}
        <div className={`relative flex h-16 items-center border-b border-white/10 ${collapsed ? "justify-center px-4" : "justify-start px-5"}`}>
          <SebraeLogo variant="onDark" height={collapsed ? 26 : 30} />
        </div>

        {/* Collapse toggle — aligned with Workspace label */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-[72px] -right-3 z-20 hidden h-7 w-7 items-center justify-center rounded-full bg-transparent text-white/60 transition-colors hover:text-white focus:outline-none lg:inline-flex"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>


        {/* Section label */}
        {!collapsed && (
          <div className="px-5 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Workspace
          </div>
        )}


        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: item.to })}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-white text-primary shadow-sm"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Admin section at bottom */}
        {adminItems.length > 0 && (
          <div className="border-t border-white/10 px-3 py-3">
            {!collapsed && (
              <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Administração
              </div>
            )}
            <ul className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => navigate({ to: item.to })}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-white text-primary shadow-sm"
                          : "text-white/85 hover:bg-white/10 hover:text-white"
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}



      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
          {/* Left: date */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium capitalize">{formatDate(now)}</span>
          </div>

          {/* Right: help + avatar */}
          <div className="flex items-center gap-4">
            {pageKey && <HelpTourButton pageKey={pageKey} variant="default" />}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
        </header>

        {pageKey && user && <TourAutoStart pageKey={pageKey} userId={user.id} />}

        {/* Page content */}
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-7xl">
            {(title || eyebrow || subtitle || actions) && (
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {eyebrow}
                  {title && (
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
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
    </div>
  );
}

export default AppShell;
